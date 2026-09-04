# specific_song/player.py
#
# Wraps OBS visibility toggling and media-state polling for a single song.
#
# Public API
# ----------
#   player.play(source_name)   — blocking; call from a daemon thread
#   player.play_async(source)  — non-blocking wrapper
#   player.pause()             — hide source mid-playback (OBS keeps running)
#   player.resume()            — un-hide source
#   player.abort()             — stop immediately and hide
#   player.is_busy             — True while a song is active
#   player.current_source      — name of the currently active source, or None

from __future__ import annotations

import threading
import time
from pathlib import Path

import obs  # root-level obs package — always on sys.path from hub
from lib.shared_media.single_source_state import SingleSourceStateStore

from .config import (
    SCENE,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    POLL_INTERVAL,
    MEDIA_START_TIMEOUT,
    MEDIA_TOTAL_TIMEOUT,
    BASS_ANIMATION_ENABLED,
    FULLSCREEN_POSITION_X,
    FULLSCREEN_POSITION_Y,
    FULLSCREEN_ALIGNMENT,
    ASSETS_DIR,
    OBS_SOURCE_PREFIX,
)
from .obs_helpers import get_scene_item_transform, set_scene_item_transform
from .bass_animator import BassAnimator

# The one OBS source shared by all songs in the SpecificSongs scene.
# Its local_file setting is swapped at play time via set_media_source_file().
SINGLE_SOURCE_NAME = f"{OBS_SOURCE_PREFIX}player"

_AUDIO_EXTENSIONS = (".mp4", ".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".webm")
_PROJECT_DIR = Path(__file__).resolve().parent


def _resolve_audio_file(source_name: str):
    """Return the audio/video file in ASSETS_DIR that matches this OBS source name."""
    stem = source_name.removeprefix(OBS_SOURCE_PREFIX)
    for ext in _AUDIO_EXTENSIONS:
        candidate = ASSETS_DIR / f"{stem}{ext}"
        if candidate.exists():
            return candidate
    return None

_TAG = "[specific_song]"

# OBS media state strings
_STATE_PLAYING = "OBS_MEDIA_STATE_PLAYING"
_STATES_ENDED  = {"OBS_MEDIA_STATE_STOPPED", "OBS_MEDIA_STATE_ENDED", "OBS_MEDIA_STATE_NONE"}
_STATE_STARTING = {"OBS_MEDIA_STATE_OPENING", "OBS_MEDIA_STATE_BUFFERING", "OBS_MEDIA_STATE_RESTARTING"}
_START_CONFIRM_POLLS = 3
_START_GRACE_SECONDS = 0.4
_END_CONFIRM_POLLS = 3
_END_GRACE_SECONDS = 1.0
_MIN_VALID_PLAY_SECONDS = 2.0
_FILE_APPLY_TIMEOUT = 2.0


class SongPlayer:
    """
    Plays songs via OBS source visibility toggling.

    NOTE: Scene-watching has been intentionally removed.  The player does NOT
    pause when the active OBS scene changes.  This supports setups where the
    SpecificSongs scene is embedded as a source inside another scene (e.g.
    "Test") — in that case obs.get_current_scene() never returns "SpecificSongs"
    even while the content is fully visible and playing.
    """

    def __init__(self) -> None:
        self._lock           = threading.Lock()
        self._is_busy        = False
        self._abort_flag     = False
        self._paused         = False
        self._current_source: str | None = None
        self._play_thread:   threading.Thread | None = None
        self._animator:      "BassAnimator | None"    = None
        self._stop_event     = threading.Event()
        self._state_store    = SingleSourceStateStore(
            project_dir=_PROJECT_DIR,
            scene=SCENE,
            source_name=SINGLE_SOURCE_NAME,
            tag=_TAG,
            include_transform=False,
            include_audio_volume=False,
        )

    def stop(self) -> None:
        """Shutdown the player (no-op watcher threads to join)."""
        self._stop_event.set()

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def is_busy(self) -> bool:
        with self._lock:
            return self._is_busy

    @property
    def current_source(self) -> str | None:
        with self._lock:
            return self._current_source

    @property
    def current_stem(self) -> str | None:
        with self._lock:
            if not self._current_source:
                return None
            return self._current_source.removeprefix(OBS_SOURCE_PREFIX)

    def _get_input_settings(self, source_name: str) -> dict:
        client = obs.get_obs()
        try:
            resp = client.send("GetInputSettings", {"inputName": source_name}, raw=True)
        except TypeError:
            try:
                resp = client.send("GetInputSettings", {"inputName": source_name})
            except Exception:
                return {}
        except Exception:
            return {}

        if isinstance(resp, dict):
            settings = resp.get("inputSettings") or resp.get("input_settings") or {}
            return settings if isinstance(settings, dict) else {}
        settings = getattr(resp, "input_settings", None) or getattr(resp, "inputSettings", None) or {}
        return settings if isinstance(settings, dict) else {}

    def _current_media_file(self, source_name: str) -> Path | None:
        settings = self._get_input_settings(source_name)
        local_file = str(settings.get("local_file") or "").strip()
        return Path(local_file) if local_file else None

    def _wait_for_media_file(self, source_name: str, expected_file: Path) -> bool:
        try:
            expected_norm = str(expected_file.resolve()).casefold()
        except Exception:
            expected_norm = str(expected_file).casefold()

        deadline = time.time() + _FILE_APPLY_TIMEOUT
        while time.time() < deadline:
            current = self._current_media_file(source_name)
            if current is not None:
                try:
                    current_norm = str(current.resolve()).casefold()
                except Exception:
                    current_norm = str(current).casefold()
                if current_norm == expected_norm:
                    return True
            time.sleep(POLL_INTERVAL)
        return False

    # ── Public API ────────────────────────────────────────────────────────────

    def play(self, source_name: str) -> None:
        """
        Point the single OBS source at source_name's media file, show it,
        wait for it to finish, then hide it.  Blocking — call from a daemon thread.

        ``source_name`` is still the logical ``{prefix}{stem}`` identifier used
        for logging and audio-file resolution; the actual OBS source used for
        all WebSocket calls is always SINGLE_SOURCE_NAME (``{prefix}player``).
        """
        with self._lock:
            if self._is_busy:
                print(f"{_TAG} ⚠  Already busy — ignoring play('{source_name}')")
                return
            self._is_busy        = True
            self._abort_flag     = False
            self._paused         = False
            self._current_source = source_name

        # Resolve the actual media file from the source stem.
        audio_file = _resolve_audio_file(source_name)

        try:
            print(f"{_TAG} ▶  Playing: '{source_name}'")

            # Pre-load audio for the visualizer before touching OBS.
            if BASS_ANIMATION_ENABLED:
                if audio_file:
                    print(f"{_TAG} 🎵  Preloading audio for visualizer: {audio_file.name}")
                else:
                    print(f"{_TAG} ⚠  No audio file found for '{source_name}' — visualizer will be flat.")
                # specific_song plays through one shared OBS source now, so the
                # visualizer has to target that shared source instead of the
                # old per-song OBS source names.
                self._animator = BassAnimator(
                    SINGLE_SOURCE_NAME,
                    audio_file=audio_file,
                    label=source_name,
                )
                self._animator.preload()

            # Point the single source at this song's file before showing it.
            if audio_file:
                try:
                    obs.stop_media(SINGLE_SOURCE_NAME)
                except Exception:
                    pass
                try:
                    obs.set_media_source_file(SINGLE_SOURCE_NAME, audio_file)
                except Exception as exc:
                    print(f"{_TAG} ⚠  Could not set media file for '{SINGLE_SOURCE_NAME}': {exc}")
                else:
                    if not self._wait_for_media_file(SINGLE_SOURCE_NAME, audio_file):
                        current = self._current_media_file(SINGLE_SOURCE_NAME)
                        current_name = current.name if current else "unknown"
                        print(
                            f"{_TAG} ⚠  OBS did not confirm file swap to '{audio_file.name}' "
                            f"(current: '{current_name}')."
                        )
            else:
                print(f"{_TAG} ⚠  No media file found for '{source_name}' — OBS source unchanged.")

            obs.show_source(SCENE, SINGLE_SOURCE_NAME)
            self._apply_fullscreen(SINGLE_SOURCE_NAME)
            self._set_monitor_and_output(SINGLE_SOURCE_NAME)
            self._state_store.apply_for_stem(source_name.removeprefix(OBS_SOURCE_PREFIX))

            try:
                obs.restart_media(SINGLE_SOURCE_NAME)
            except Exception as exc:
                print(f"{_TAG} ⚠  Could not restart media: {exc}")

            if BASS_ANIMATION_ENABLED and self._animator is not None:
                self._animator.start()

            ended_cleanly = self._poll_until_done(SINGLE_SOURCE_NAME, expected_file=audio_file)
            self._safe_hide(SINGLE_SOURCE_NAME)

            if self._abort_flag:
                print(f"{_TAG} ⏹  Aborted: '{source_name}'")
            elif ended_cleanly:
                print(f"{_TAG} ✅  Finished: '{source_name}'")
            else:
                print(f"{_TAG} ⏱  Timed out / never started: '{source_name}'")

        except Exception as exc:
            print(f"{_TAG} ❌  Unexpected error in play(): {exc}")
            self._safe_hide(SINGLE_SOURCE_NAME)

        finally:
            try:
                self._state_store.capture_override_for_stem(source_name.removeprefix(OBS_SOURCE_PREFIX))
            except Exception as exc:
                print(f"{_TAG} ⚠  Could not save single-source override for '{source_name}': {exc}")
            if self._animator is not None:
                self._animator.stop()
                self._animator = None
            with self._lock:
                self._is_busy        = False
                self._current_source = None
                self._paused         = False

    def play_async(self, source_name: str) -> None:
        """Non-blocking: aborts any current song, waits for its thread to exit,
        then spawns a new daemon thread that calls play()."""
        with self._lock:
            old_thread = self._play_thread
        if old_thread is not None and old_thread.is_alive():
            self.abort()
            old_thread.join(timeout=5)

        t = threading.Thread(
            target=self.play, args=(source_name,),
            daemon=True, name=f"specific_song:{source_name}"
        )
        with self._lock:
            self._play_thread = t
        t.start()

    def pause(self) -> None:
        """Pause the media at its current position."""
        with self._lock:
            if not self._is_busy or self._paused:
                return
            self._paused = True
            src = self._current_source  # logical name, for logging only
        try:
            obs.pause_media(SINGLE_SOURCE_NAME)
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not pause media: {exc}")
        print(f"{_TAG} ⏸  Paused: '{src}'")

    def resume(self) -> None:
        """Resume playback from the paused position."""
        with self._lock:
            if not self._is_busy or not self._paused:
                return
            self._paused = False
            src = self._current_source  # logical name, for logging only
        try:
            obs.play_media(SINGLE_SOURCE_NAME)
            print(f"{_TAG} ▶  Resumed: '{src}'")
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not resume: {exc}")

    def abort(self) -> None:
        """Signal the play loop to stop immediately and mark the player idle."""
        with self._lock:
            if not self._is_busy:
                return
            self._abort_flag = True
            self._paused     = False
        self._safe_hide(SINGLE_SOURCE_NAME)
        print(f"{_TAG} ⏹  Abort requested.")

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _apply_fullscreen(self, source_name: str) -> None:
        """Scale and position the source to fill the full canvas."""
        try:
            transform = get_scene_item_transform(SCENE, source_name)
            src_w = transform.get("sourceWidth",  0) or transform.get("width",  0)
            src_h = transform.get("sourceHeight", 0) or transform.get("height", 0)
            scale_x = (CANVAS_WIDTH  / src_w) if src_w else 1.0
            scale_y = (CANVAS_HEIGHT / src_h) if src_h else 1.0
            set_scene_item_transform(SCENE, source_name, {
                "positionX":  FULLSCREEN_POSITION_X,
                "positionY":  FULLSCREEN_POSITION_Y,
                "scaleX":     scale_x,
                "scaleY":     scale_y,
                "rotation":   0.0,
                "alignment":  FULLSCREEN_ALIGNMENT,
                "boundsType": "OBS_BOUNDS_NONE",
            })
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not apply fullscreen transform: {exc}")

    def _set_monitor_and_output(self, source_name: str) -> None:
        """Set audio monitoring to Monitor and Output, routed to tracks 2-6 only."""
        try:
            obs.configure_input_audio(
                source_name,
                monitor_type="OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT",
            )
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not set audio monitoring for '{source_name}': {exc}")

        try:
            obs.set_input_audio_tracks(source_name, {
                "1": False,
                "2": True, "3": True, "4": True, "5": True, "6": True,
            })
            print(f"{_TAG} 🎚  Audio tracks set: off=1, on=2-6 for '{source_name}'")
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not set audio tracks for '{source_name}': {exc}")

    def _poll_until_done(self, source_name: str, expected_file: Path | None = None) -> bool:
        """Block until the source's media ends, times out, or is aborted."""
        started = False
        t0      = time.time()
        play_streak = 0
        provisional_playing_since: float | None = None
        playing_since: float | None = None
        end_streak = 0

        while True:
            with self._lock:
                if self._abort_flag:
                    return False
                paused = self._paused

            if paused:
                time.sleep(POLL_INTERVAL)
                continue

            state   = obs.get_media_state(source_name)
            elapsed = time.time() - t0

            if expected_file is not None:
                current_file = self._current_media_file(source_name)
                if current_file is not None:
                    try:
                        expected_norm = str(expected_file.resolve()).casefold()
                        current_norm = str(current_file.resolve()).casefold()
                    except Exception:
                        expected_norm = str(expected_file).casefold()
                        current_norm = str(current_file).casefold()
                    if current_norm != expected_norm:
                        print(
                            f"{_TAG} ⚠  Media source switched files mid-play "
                            f"('{current_file.name}' != '{expected_file.name}')."
                        )
                        return False

            if state == _STATE_PLAYING:
                play_streak += 1
                if provisional_playing_since is None:
                    provisional_playing_since = time.time()
                if (
                    not started
                    and (
                        play_streak >= _START_CONFIRM_POLLS
                        or (time.time() - provisional_playing_since) >= _START_GRACE_SECONDS
                    )
                ):
                    started = True
                end_streak = 0
                if playing_since is None:
                    playing_since = time.time()
            elif not started:
                if state not in _STATE_STARTING:
                    play_streak = 0
                    provisional_playing_since = None

            if started and state in _STATES_ENDED:
                end_streak += 1
                if playing_since is not None:
                    played_for = time.time() - playing_since
                    if played_for < max(_END_GRACE_SECONDS, _MIN_VALID_PLAY_SECONDS):
                        time.sleep(POLL_INTERVAL)
                        continue
                if end_streak >= _END_CONFIRM_POLLS:
                    return True
            elif started:
                end_streak = 0

            if not started and elapsed > MEDIA_START_TIMEOUT:
                print(f"{_TAG} ⚠  '{source_name}' never reached PLAYING within {MEDIA_START_TIMEOUT}s")
                return False

            if elapsed > MEDIA_TOTAL_TIMEOUT:
                print(f"{_TAG} ⏱  Total timeout reached for '{source_name}'")
                return False

            time.sleep(POLL_INTERVAL)

    def _hide_all_except(self, keep: str | None = None) -> None:
        """Hide every source in SCENE except `keep` (best-effort)."""
        try:
            for name in obs.list_sources(SCENE):
                if name == keep:
                    continue
                self._safe_hide(name)
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not list sources for initial hide: {exc}")

    def _safe_hide(self, source_name: str) -> None:
        try:
            obs.hide_source(SCENE, source_name)
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not hide '{source_name}': {exc}")

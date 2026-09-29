# specific_song/player.py
#
# Wraps OBS visibility toggling and media-state polling for a single song.
#
# Public API
# ----------
#   player.play(source_name)   — blocking; call from a daemon thread
#   player.play_async(source)  — non-blocking wrapper
#   player.pause()             — pause media and visualizer analysis
#   player.resume()            — resume media and visualizer analysis
#   player.abort()             — stop immediately and hide
#   player.is_busy             — True while a song is active
#   player.current_source      — name of the currently active source, or None

from __future__ import annotations

import threading
import time
from pathlib import Path

import obs  # root-level obs package — always on sys.path from hub
from lib.project_settings import load_project_settings, shift_asset_volume_db, audio_settings_transaction
from lib.shared_media.controls import effective_volume_db
from lib.shared_media.playback_worker import PlaybackWorker
from lib.shared_media.config_overrides import load_config_overrides, audio_tracks_override
from lib.shared_media.media_startup import media_startup

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
        self._requests = PlaybackWorker("specific_song:playback")
        self._cancel_event = threading.Event()
        self._animator:      "BassAnimator | None"    = None
        self._stop_event     = threading.Event()
        try:
            obs.configure_media_source_properties(
                SINGLE_SOURCE_NAME,
                restart_on_activate=True,
                close_when_inactive=True,
                looping=False,
                clear_on_media_end=False,
            )
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not configure shared Music source: {exc}")
        self._stop_and_hide_source()

    def stop(self) -> None:
        """Cancel pending loads and stop the active source on shutdown."""
        self._stop_event.set()
        self.abort()

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def is_busy(self) -> bool:
        with self._lock:
            return self._is_busy or self._requests.busy

    def _cancelled(self) -> bool:
        return self._abort_flag or self._cancel_event.is_set()

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

    @property
    def loaded_stem(self) -> str | None:
        current = self._current_media_file(SINGLE_SOURCE_NAME)
        return current.stem if current else None

    def volume_for_stem(self, stem: str) -> float:
        settings = load_project_settings(
            _PROJECT_DIR,
            hotkeys_file=_PROJECT_DIR / "hotkeys.json",
            asset_dir=ASSETS_DIR,
            valid_extensions=set(_AUDIO_EXTENSIONS),
        )
        key = str(stem or "").strip().lower()
        category_db = 0.0
        categories = list(settings.sound_categories.get(key, ()))
        if categories:
            category_db = settings.category_volume_db.get(categories[0], 0.0)
        return effective_volume_db(
            project_volume_db=settings.project_volume_db,
            profile_volume_db=settings.profile_volume_db,
            category_offset_db=category_db,
            file_offset_db=settings.file_volume_offsets.get(key, 0.0),
        )

    @audio_settings_transaction
    def remember_obs_volume(self, stem: str | None = None) -> bool:
        """Persist the fader only for the actual asset loaded in OBS."""
        stem = str(stem or self.loaded_stem or "").strip()
        if not stem:
            return False
        if str(self.loaded_stem or '').casefold() != stem.casefold():
            return False
        live = obs.get_input_volume(SINGLE_SOURCE_NAME) or {}
        live_db = live.get("db")
        if live_db is None:
            return False
        expected_db = self.volume_for_stem(stem)
        delta = round(float(live_db) - expected_db, 2)
        if str(self.loaded_stem or '').casefold() != stem.casefold():
            return False
        changed = shift_asset_volume_db(
            _PROJECT_DIR,
            stem,
            delta,
        )
        if changed:
            print(f"{_TAG} Saved OBS volume for '{stem}': {float(live_db):.1f} dB.")
        return changed

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

    def play(self, source_name: str, *, cancelled: threading.Event | None = None) -> None:
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
            self._cancel_event = cancelled if cancelled is not None else threading.Event()

        # Resolve the actual media file from the source stem.
        audio_file = _resolve_audio_file(source_name)
        stem = source_name.removeprefix(OBS_SOURCE_PREFIX)
        volume_applied = False

        try:
            if self._cancelled():
                return
            if audio_file is None:
                raise FileNotFoundError(f"No media file found for '{source_name}'")
            print(f"{_TAG} ▶  Playing: '{source_name}'")

            # If the OBS fader was moved since the previous play, that was the
            # latest user action. Save it before applying this song's offset.
            self.remember_obs_volume()

            # Prepare the visualizer object; audio decoding starts with playback.
            if BASS_ANIMATION_ENABLED:
                if audio_file:
                    print(f"{_TAG} 🎵  Streaming visualizer audio: {audio_file.name}")
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
                # Analysis starts incrementally after playback; never decode a
                # whole song on the hotkey-to-playback path.

            if self._cancelled():
                return

            with media_startup(SINGLE_SOURCE_NAME, cancelled=self._cancelled, timeout=MEDIA_START_TIMEOUT):
                obs.stop_media(SINGLE_SOURCE_NAME)
                obs.hide_source(SCENE, SINGLE_SOURCE_NAME)
                obs.configure_media_source_properties(SINGLE_SOURCE_NAME, restart_on_activate=False, close_when_inactive=False)
                self._set_monitor_and_output(SINGLE_SOURCE_NAME)
                obs.set_input_volume_db(SINGLE_SOURCE_NAME, self.volume_for_stem(stem))
                volume_applied = True
                same_file = not obs.set_media_source_file(SINGLE_SOURCE_NAME, audio_file, managed_decode=True)
                if not self._wait_for_media_file(SINGLE_SOURCE_NAME, audio_file):
                    raise RuntimeError(f"OBS did not confirm file swap to '{audio_file.name}'.")
                if self._cancelled():
                    return
                obs.show_source(SCENE, SINGLE_SOURCE_NAME)
                if same_file:
                    obs.restart_media(SINGLE_SOURCE_NAME)
            # Decoder dimensions are now ready, rather than the previous file's.
            self._apply_fullscreen(SINGLE_SOURCE_NAME)
            if self._cancelled():
                return

            if BASS_ANIMATION_ENABLED and self._animator is not None:
                self._animator.start()

            ended_cleanly = self._poll_until_done(SINGLE_SOURCE_NAME, expected_file=audio_file)
            self._safe_hide(SINGLE_SOURCE_NAME)

            if self._cancelled():
                print(f"{_TAG} ⏹  Aborted: '{source_name}'")
            elif ended_cleanly:
                print(f"{_TAG} ✅  Finished: '{source_name}'")
            else:
                print(f"{_TAG} ⏱  Timed out / never started: '{source_name}'")

        except Exception as exc:
            print(f"{_TAG} ❌  Unexpected error in play(): {exc}")
            self._safe_hide(SINGLE_SOURCE_NAME)

        finally:
            # Hidden sources with restart_on_activate=False may keep decoding.
            # Every exit (abort, timeout, error, normal end) explicitly stops it.
            self._stop_and_hide_source()
            # A fader move made in OBS while this song was playing becomes the
            # saved level for this asset. UI changes already match the saved
            # value, so this is a no-op for changes made in the Hub.
            try:
                if volume_applied:
                    self.remember_obs_volume(stem)
            except Exception as exc:
                print(f"{_TAG} ⚠  Could not remember OBS volume: {exc}")
            if self._animator is not None:
                self._animator.stop()
                self._animator = None
            with self._lock:
                self._is_busy        = False
                self._current_source = None
                self._paused         = False

    def play_async(self, source_name: str) -> threading.Event:
        """Replace pending work; old cleanup finishes before the next file loads."""
        return self._requests.submit(lambda cancel: self.play(source_name, cancelled=cancel))

    def pause(self) -> None:
        """Pause the media at its current position."""
        with self._lock:
            if not self._is_busy or self._paused:
                return
            self._paused = True
            src = self._current_source  # logical name, for logging only
        try:
            obs.pause_media(SINGLE_SOURCE_NAME)
            if self._animator is not None:
                self._animator.pause()
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not pause media: {exc}")
            with self._lock:
                self._paused = False
            return
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
            if self._animator is not None:
                self._animator.resume()
            print(f"{_TAG} ▶  Resumed: '{src}'")
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not resume: {exc}")
            with self._lock:
                self._paused = True

    def abort(self) -> None:
        """Cancel pending/active playback; remain busy until cleanup finishes."""
        self._requests.cancel()
        with self._lock:
            if not self._is_busy:
                return
            self._abort_flag = True
            self._paused     = False
        self._stop_and_hide_source()
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
        """Honor saved routing, including desktop-monitored stream-only music."""
        routing = load_config_overrides(_PROJECT_DIR)
        try:
            obs.configure_input_audio(
                source_name,
                monitor_type=routing.get("monitor", "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT"),
            )
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not set audio monitoring for '{source_name}': {exc}")

        try:
            tracks = audio_tracks_override(routing)
            if tracks is not None:
                obs.set_input_audio_tracks(source_name, tracks)
                return
            track = obs.ensure_input_on_stream_track(source_name)
            print(f"{_TAG} 🎚  Streaming track {track} enabled for '{source_name}'; other tracks preserved")
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
        startup_retried = False

        while True:
            with self._lock:
                if self._cancelled():
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
                # OBS acknowledges STOP/file changes before the decoder has
                # finished processing them. A pending stop can swallow the
                # initial restart. Retry once after it settles, only before
                # any playback was observed, never after a song has ended.
                if (not startup_retried and playing_since is None
                        and state in _STATES_ENDED and elapsed >= 1.0):
                    obs.restart_media(source_name)
                    startup_retried = True

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

    def _stop_and_hide_source(self) -> None:
        try:
            obs.park_media_source(SCENE, SINGLE_SOURCE_NAME)
        except Exception as exc:
            print(f"{_TAG} Could not stop '{SINGLE_SOURCE_NAME}': {exc}")
        self._safe_hide(SINGLE_SOURCE_NAME)

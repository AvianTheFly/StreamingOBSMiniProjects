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

import obs  # root-level obs package — always on sys.path from hub

from .config import (
    SCENE,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    POLL_INTERVAL,
    MEDIA_START_TIMEOUT,
    MEDIA_TOTAL_TIMEOUT,
    RESTART_MEDIA_ON_PLAY,
    BASS_ANIMATION_ENABLED,
    FULLSCREEN_POSITION_X,
    FULLSCREEN_POSITION_Y,
    FULLSCREEN_ALIGNMENT,
    ASSETS_DIR,
    OBS_SOURCE_PREFIX,
)
from .obs_helpers import get_scene_item_transform, set_scene_item_transform
from .bass_animator import BassAnimator


_AUDIO_EXTENSIONS = (".mp4", ".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".webm")


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

    # ── Public API ────────────────────────────────────────────────────────────

    def play(self, source_name: str) -> None:
        """
        Show `source_name` in the OBS scene, wait for its media to finish,
        then hide it.  Blocking — call from a daemon thread.
        """
        with self._lock:
            if self._is_busy:
                print(f"{_TAG} ⚠  Already busy — ignoring play('{source_name}')")
                return
            self._is_busy        = True
            self._abort_flag     = False
            self._paused         = False
            self._current_source = source_name

        try:
            print(f"{_TAG} ▶  Playing: '{source_name}'")
            self._hide_all_except(source_name)

            # Pre-load audio while OBS is setting up the source.
            # Doing this before show_source minimises the timing gap between
            # the song starting in OBS and the visualizer beginning to analyse.
            if BASS_ANIMATION_ENABLED:
                audio_file = _resolve_audio_file(source_name)
                if audio_file:
                    print(f"{_TAG} 🎵  Preloading audio for visualizer: {audio_file.name}")
                else:
                    print(f"{_TAG} ⚠  No audio file found for '{source_name}' — visualizer will be flat.")
                self._animator = BassAnimator(source_name, audio_file=audio_file)
                self._animator.preload()   # decode file into RAM

            if RESTART_MEDIA_ON_PLAY:
                try:
                    obs.restart_media(source_name)
                except Exception as exc:
                    print(f"{_TAG} ⚠  Could not restart media for '{source_name}': {exc}")

            obs.show_source(SCENE, source_name)
            self._apply_fullscreen(source_name)
            self._set_monitor_and_output(source_name)

            if BASS_ANIMATION_ENABLED and self._animator is not None:
                self._animator.start()   # file already in RAM — starts immediately

            ended_cleanly = self._poll_until_done(source_name)
            self._safe_hide(source_name)

            if self._abort_flag:
                print(f"{_TAG} ⏹  Aborted: '{source_name}'")
            elif ended_cleanly:
                print(f"{_TAG} ✅  Finished: '{source_name}'")
            else:
                print(f"{_TAG} ⏱  Timed out / never started: '{source_name}'")

        except Exception as exc:
            print(f"{_TAG} ❌  Unexpected error in play(): {exc}")
            self._safe_hide(source_name)

        finally:
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
            src = self._current_source
        if src:
            try:
                obs.pause_media(src)
            except Exception as exc:
                print(f"{_TAG} ⚠  Could not pause media for '{src}': {exc}")
            print(f"{_TAG} ⏸  Paused: '{src}'")

    def resume(self) -> None:
        """Resume playback from the paused position."""
        with self._lock:
            if not self._is_busy or not self._paused:
                return
            self._paused = False
            src = self._current_source
        if src:
            try:
                obs.play_media(src)
                print(f"{_TAG} ▶  Resumed: '{src}'")
            except Exception as exc:
                print(f"{_TAG} ⚠  Could not resume '{src}': {exc}")

    def abort(self) -> None:
        """Signal the play loop to stop immediately and mark the player idle."""
        with self._lock:
            if not self._is_busy:
                return
            self._abort_flag = True
            self._paused     = False
            src = self._current_source
        if src:
            self._safe_hide(src)
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

    def _poll_until_done(self, source_name: str) -> bool:
        """Block until the source's media ends, times out, or is aborted."""
        started = False
        t0      = time.time()

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

            if state == _STATE_PLAYING:
                started = True

            if started and state in _STATES_ENDED:
                return True

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
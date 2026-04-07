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
from obs.client import get_obs

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
)
from .bass_animator import BassAnimator

_TAG = "[specific_song]"

# OBS media state strings
_STATE_PLAYING = "OBS_MEDIA_STATE_PLAYING"
_STATES_ENDED  = {"OBS_MEDIA_STATE_STOPPED", "OBS_MEDIA_STATE_ENDED", "OBS_MEDIA_STATE_NONE"}


def _extract_field(obj, *names):
    if obj is None:
        return None
    if isinstance(obj, dict):
        for name in names:
            if name in obj:
                return obj[name]
        d = obj.get("responseData") or obj.get("response_data")
        if isinstance(d, dict):
            for name in names:
                if name in d:
                    return d[name]
        return None
    for name in names:
        if hasattr(obj, name):
            return getattr(obj, name)
    d = getattr(obj, "__dict__", None)
    if isinstance(d, dict):
        for name in names:
            if name in d:
                return d[name]
        rd = d.get("responseData") or d.get("response_data")
        if isinstance(rd, dict):
            for name in names:
                if name in rd:
                    return rd[name]
    return None


def _get_scene_item_id(scene: str, source_name: str) -> int:
    obs_client = get_obs()
    try:
        resp = obs_client.send("GetSceneItemId", {"sceneName": scene, "sourceName": source_name})
        item_id = _extract_field(resp, "scene_item_id", "sceneItemId")
        if item_id is not None:
            return int(item_id)
    except Exception:
        pass
    try:
        resp = obs_client.send("GetSceneItemList", {"sceneName": scene})
        items = _extract_field(resp, "scene_items", "sceneItems") or []
        for item in items:
            if isinstance(item, dict):
                name = item.get("sourceName") or item.get("source_name")
                iid = item.get("sceneItemId") or item.get("scene_item_id")
            else:
                name = _extract_field(item, "sourceName", "source_name")
                iid = _extract_field(item, "sceneItemId", "scene_item_id")
            if name == source_name and iid is not None:
                return int(iid)
    except Exception:
        pass
    raise RuntimeError(f"Could not resolve scene item ID for {source_name!r} in scene {scene!r}")


def _get_scene_item_transform(scene: str, source_name: str) -> dict:
    item_id = _get_scene_item_id(scene, source_name)
    resp = get_obs().send("GetSceneItemTransform", {"sceneName": scene, "sceneItemId": item_id})
    return _extract_field(resp, "scene_item_transform", "sceneItemTransform") or {}


def _set_scene_item_transform(scene: str, source_name: str, transform: dict) -> None:
    item_id = _get_scene_item_id(scene, source_name)
    get_obs().send("SetSceneItemTransform", {
        "sceneName": scene,
        "sceneItemId": item_id,
        "sceneItemTransform": transform,
    })


class SongPlayer:
    """
    The SongPlayer runs a background scene-watcher thread that auto-pauses
    when the current OBS scene changes away from SCENE and resumes when it
    returns.  This prevents the random loop from advancing when the streamer
    temporarily switches scenes.
    """

    def __init__(self) -> None:
        self._lock           = threading.Lock()
        self._is_busy        = False
        self._abort_flag     = False
        self._paused         = False
        self._paused_by_scene_change = False
        self._current_source: str | None = None
        self._play_thread:   threading.Thread | None = None
        self._animator:      "BassAnimator | None"    = None
        self._stop_event     = threading.Event()
        self._scene_thread:  threading.Thread | None = None

        # Start the scene watcher thread
        self._start_scene_watcher()

    # ── Scene watcher ─────────────────────────────────────────────────────────
    # Runs in a background thread at ~5 Hz.
    # • When OBS leaves SCENE → auto-pause (hidden source)
    # • When OBS returns  to SCENE → auto-resume (re-show source)
    # Only fires when the player is mid-song.

    _SCENE_POLL_INTERVAL = 0.2

    def _start_scene_watcher(self) -> None:
        t = threading.Thread(
            target=self._scene_watcher_loop,
            daemon=True,
            name="specific_song:scene_watcher",
        )
        self._scene_thread = t
        t.start()

    def _scene_watcher_loop(self) -> None:
        """Polls current scene and pauses/resumes on scene changes."""
        while not self._stop_event.is_set():
            with self._lock:
                busy = self._is_busy
                paused = self._paused
                paused_by_scene = self._paused_by_scene_change
                src = self._current_source

            if not busy:
                self._stop_event.wait(self._SCENE_POLL_INTERVAL)
                continue

            try:
                current = obs.get_current_scene()
            except Exception:
                current = None

            if current != SCENE and not paused and not paused_by_scene:
                # Scene changed away → pause
                with self._lock:
                    if not self._paused:
                        self._paused = True
                        self._paused_by_scene_change = True
                if src:
                    self._safe_hide(src)
                    print(f"{_TAG} ⏸  Scene changed — pausing song.")

            if current == SCENE and paused_by_scene:
                # Scene changed back → resume
                with self._lock:
                    self._paused = False
                    self._paused_by_scene_change = False
                if src:
                    try:
                        obs.show_source(SCENE, src)
                        # Restart media mid-seed so it doesn't stay stopped.
                        try:
                            obs.restart_media(src)
                        except Exception as exc:
                            print(f"{_TAG} ⚠  Could not restart media on scene return: {exc}")
                        print(f"{_TAG} ▶  Scene restored — resuming song.")
                    except Exception as exc:
                        print(f"{_TAG} ⚠  Could not show source on scene return: {exc}")

            self._stop_event.wait(self._SCENE_POLL_INTERVAL)

    def stop(self) -> None:
        """Shutdown the scene watcher thread."""
        self._stop_event.set()
        t = self._scene_thread
        if t and t.is_alive():
            t.join(timeout=2)

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
        then animate it out and hide it.
        Blocking — call from a daemon thread.
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

            if RESTART_MEDIA_ON_PLAY:
                try:
                    obs.restart_media(source_name)
                except Exception as exc:
                    print(f"{_TAG} ⚠  Could not restart media for '{source_name}': {exc}")

            obs.show_source(SCENE, source_name)
            self._apply_fullscreen(source_name)
            self._set_monitor_and_output(source_name)

            if BASS_ANIMATION_ENABLED:
                self._animator = BassAnimator(source_name)
                self._animator.start()  # applies mask + begins jump-in in bg thread

            ended_cleanly = self._poll_until_done(source_name)

            # Hide the source — jump-out animation removed (see jump_animation.py).
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
            # Hard stop — no-op if request_exit() already completed cleanly.
            if self._animator is not None:
                self._animator.stop()
                self._animator = None
            with self._lock:
                self._is_busy        = False
                self._current_source = None
                self._paused         = False

    def play_async(self, source_name: str) -> None:
        """Non-blocking: aborts any current song, waits for its thread to exit,
        then spawns a new daemon thread that calls play().  This eliminates the
        race where the old play() loop hides the new song's source after it has
        already been shown."""
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
        """
        Hide the source so the stream goes dark mid-song.
        OBS keeps the media timer running internally — we just remove the
        visual.  Call resume() to bring it back.
        """
        with self._lock:
            if not self._is_busy or self._paused:
                return
            self._paused = True
            src = self._current_source
        if src:
            self._safe_hide(src)
            print(f"{_TAG} ⏸  Paused (hidden): '{src}'")

    def resume(self) -> None:
        """Un-hide the source and continue watching playback."""
        with self._lock:
            if not self._is_busy or not self._paused:
                return
            self._paused = False
            src = self._current_source
        if src:
            try:
                obs.show_source(SCENE, src)
                print(f"{_TAG} ▶  Resumed: '{src}'")
            except Exception as exc:
                print(f"{_TAG} ⚠  Could not show source on resume: {exc}")

    def abort(self) -> None:
        """
        Signal the play loop to stop immediately, hide the source, and mark
        the player idle.  Safe to call from any thread at any time.
        """
        with self._lock:
            if not self._is_busy:
                return
            self._abort_flag = True
            self._paused     = False   # unblock the pause-idle spin
            src = self._current_source
        if src:
            self._safe_hide(src)
        print(f"{_TAG} ⏹  Abort requested.")

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _apply_fullscreen(self, source_name: str) -> None:
        """
        Scale and position the source to fill the full canvas (CANVAS_WIDTH x CANVAS_HEIGHT).
        Reads the source's current bounding width/height from OBS to compute exact scale
        factors, so it works regardless of the video's native resolution.
        """
        try:
            transform = _get_scene_item_transform(SCENE, source_name)
            src_w = transform.get("sourceWidth",  0) or transform.get("width",  0)
            src_h = transform.get("sourceHeight", 0) or transform.get("height", 0)
            if src_w and src_h:
                scale_x = CANVAS_WIDTH  / src_w
                scale_y = CANVAS_HEIGHT / src_h
            else:
                # Fallback: force scale to 1 and let OBS stretch via boundsType
                scale_x = scale_y = 1.0
            _set_scene_item_transform(SCENE, source_name, {
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
        """Set audio monitoring to Monitor and Output, routed to tracks 2-6 only (not track 1)."""
        try:
            obs.configure_input_audio(
                source_name,
                monitor_type="OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT",
            )
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not set audio monitoring for '{source_name}': {exc}")

        # Route audio to tracks 2-6 only, so the stream/replay buffer (track 1)
        # never hears the music — but VB-Cable still receives it via Output above.
        try:
            from obs.client import get_obs
            get_obs().send("SetInputAudioTracks", {
                "inputName": source_name,
                "inputAudioTracks": {
                    "1": False,
                    "2": True,
                    "3": True,
                    "4": True,
                    "5": True,
                    "6": True,
                },
            })
            print(f"{_TAG} 🎚  Audio tracks set: off=1, on=2-6 for '{source_name}'")
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not set audio tracks for '{source_name}': {exc}")

    def _poll_until_done(self, source_name: str) -> bool:
        """
        Block until the source's media ends, times out, or is aborted.
        Returns True only if the media ended cleanly.
        """
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
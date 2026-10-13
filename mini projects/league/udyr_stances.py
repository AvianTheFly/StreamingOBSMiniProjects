"""League-owned stance selection and serialized playback of the existing HUD input."""
from pathlib import Path
import threading

import obs
from lib.coordination.playback import coordinator
from lib.shared_media.playback_worker import PlaybackWorker
from .udyr_casts import ManaCasts


SOURCE = 'UdyrImageMaskANIMATION'
LOOP_ROOT = Path('C:/StreamingMedia/UdyrStances/v1')
LOOPS = {key: LOOP_ROOT / f'{key}-{name}-v1.mp4'
         for key, name in (('q', 'bear'), ('w', 'turtle'), ('e', 'ram'), ('r', 'phoenix'))}


class UdyrStances:
    """Callbacks only replace intent; one worker owns all media writes and cleanup.

    HUD visibility remains with HudPresentation. No scene, placement, filter,
    volume, audio routing or other Udyr input is changed here.
    """
    def __init__(self, stop_event, *, paths=None, permission=None):
        self._stop = stop_event
        self._paths = dict(LOOPS if paths is None else paths)
        self._permission = coordinator.permission('league') if permission is None else permission
        self._worker = PlaybackWorker('league:udyr-stances')
        self._lock = threading.Lock()
        self._running = self._alive = self._closed = False
        self._selected = 'q'
        self._done = None
        self._cleanup_done = None
        self._casts = ManaCasts()

    def update(self, running=False, alive=False):
        with self._lock:
            if self._closed:
                return
            previous = self._running and self._alive
            self._running, self._alive = bool(running), bool(alive)
            if not running:
                self._selected = 'q'
            active = self._running and self._alive
            if not active:
                self._casts.reset()
                self._worker.cancel()
            elif not previous or self._done is None or self._done.is_set():
                self._submit()

    def press(self, key):
        """Track mana evidence; allow immediate fallback outside Enter's guard."""
        key = str(key).lower()
        with self._lock:
            if (self._closed or self._stop.is_set() or not self._running or
                    not self._alive or key not in self._paths):
                return False
            queued = self._casts.press(key)
            if self._casts.allows_fallback():
                return self._select(key)
            return queued

    def enter(self):
        with self._lock:
            if not self._closed and not self._stop.is_set():
                self._casts.enter()

    def observe(self, data):
        with self._lock:
            if self._closed or not self._running or not self._alive:
                self._casts.reset()
                return
            key = self._casts.observe(data)
            if key is not None:
                self._select(key)

    def select(self, key):
        """Apply confirmed intent (also used by finite playback verification)."""
        key = str(key).lower()
        with self._lock:
            return self._select(key)

    def _select(self, key):
        if (self._closed or self._stop.is_set() or not self._running or
                not self._alive or key not in self._paths or key == self._selected):
            return False
        self._selected = key
        self._submit()
        return True

    def _submit(self):
        key = self._selected
        path = self._paths[key]
        self._done = self._worker.submit(lambda cancel: self._play(key, path, cancel))

    def _play(self, key, path, cancel):
        if not path.is_file():
            return  # Original input survives missing generated media; retry on poll.
        touched = False
        try:
            while not self._permission.wait(.05):
                if cancel.is_set() or self._stop.is_set():
                    return
            if cancel.is_set() or self._stop.is_set():
                return
            client = obs.get_obs()
            current = client.get_input_settings(SOURCE).input_settings
            if cancel.is_set() or self._stop.is_set():
                return
            touched = True
            wanted = {'local_file': path.as_posix(), 'looping': True}
            announce = current.get('local_file') != wanted['local_file']
            if any(current.get(k) != v for k, v in wanted.items()):
                client.set_input_settings(SOURCE, wanted, overlay=True)
            paused = None
            while not cancel.is_set() and not self._stop.is_set():
                allowed = self._permission.is_set()
                if paused != (not allowed):
                    client.trigger_media_input_action(SOURCE, 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY'
                        if allowed else 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE')
                    paused = not allowed
                    if allowed and announce and not cancel.is_set() and not self._stop.is_set():
                        from events import emit
                        emit('league.udyr_stance', key=key)
                        announce = False
                cancel.wait(.05)
        finally:
            if touched:
                # PlaybackWorker will not load the replacement until this finishes.
                obs.get_obs().trigger_media_input_action(
                    SOURCE, 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE')

    def close(self):
        with self._lock:
            self._closed = True
            # A barrier completes after active cleanup, even when the last
            # queued stance was superseded before it started.
            if self._cleanup_done is None:
                self._cleanup_done = self._worker.submit(lambda cancel: None)
            done = self._cleanup_done
        done.wait(3)

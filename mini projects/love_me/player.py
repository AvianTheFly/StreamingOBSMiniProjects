"""Sequential playback with cancellation and one owner for completion callbacks."""
import threading

import obs
from lib.shared_media.playback_worker import PlaybackWorker
from .config import SCENE, ITEMS, POLL_INTERVAL, MEDIA_START_TIMEOUT, MEDIA_TOTAL_TIMEOUT


class SequentialPlayer:
    def __init__(self):
        self.lock = threading.RLock()
        self.current_index = 0
        self.items = ITEMS
        self._is_busy = False
        self._active_cancel = None
        self._requests = PlaybackWorker('love-me-playback')
        self._generation = 0
        self._on_complete = None

    @property
    def is_busy(self):
        return self._is_busy or self._requests.busy

    def hide_all_sources(self):
        obs.hide_sources(SCENE, [item['display_name'] for item in self.items])

    def play_next_item(self, *, cancelled=None, generation=None, allowed=None, cancelled_check=None):
        cancelled = cancelled if cancelled is not None else threading.Event()
        stopped = cancelled_check or cancelled.is_set
        with self.lock:
            generation = self._generation if generation is None else generation
            if stopped() or generation != self._generation or self._is_busy:
                return
            if self.current_index >= len(self.items):
                print('[love_me] Sequence complete — no more items.')
                return
            index = self.current_index
            item = self.items[index]
            self._is_busy = True
            self._active_cancel = cancelled

        display_name = item['display_name']
        try:
            print(f"[love_me] Playing {index + 1}/{len(self.items)}: "
                  f"display='{display_name}' monitor='{item['monitor_name']}'")
            self.hide_all_sources()
            if stopped():
                return
            obs.show_source(SCENE, display_name)
            finished = obs.wait_for_media_end(
                source=item['monitor_name'], poll_interval=POLL_INTERVAL,
                start_timeout=MEDIA_START_TIMEOUT, total_timeout=MEDIA_TOTAL_TIMEOUT,
                cancelled=stopped,
                allowed=allowed,
            )
            with self.lock:
                if not stopped() and generation == self._generation:
                    self.current_index = index + 1
            result = 'Aborted' if cancelled.is_set() else ('Finished' if finished else 'Timeout/fallback')
            print(f"[love_me] {result}: '{display_name}'")
        except Exception as exc:
            print(f"[love_me] Error playing '{display_name}': {exc}")
        finally:
            try:
                obs.hide_source(SCENE, display_name)
            finally:
                with self.lock:
                    self._is_busy = False
                    self._active_cancel = None

    def _finish(self, generation):
        with self.lock:
            if generation != self._generation:
                return
            callback, self._on_complete = self._on_complete, None
        if callback:
            callback()

    def play_next_async(self, on_complete=None):
        with self.lock:
            self._generation += 1
            generation = self._generation
            self._on_complete = on_complete
            def run(cancelled):
                try:
                    self.play_next_item(cancelled=cancelled, generation=generation)
                finally:
                    self._finish(generation)
            try:
                return self._requests.submit(run)
            except Exception as exc:
                callback, self._on_complete = self._on_complete, None
                error = exc
        if callback:
            callback()
        raise RuntimeError('Could not start Love Me playback') from error

    def can_accept_trigger(self):
        return not self.is_busy

    def abort(self):
        with self.lock:
            self._generation += 1
            self._requests.cancel()
            if self._active_cancel is not None:
                self._active_cancel.set()
            self.current_index = 0
            callback, self._on_complete = self._on_complete, None
        try:
            self.hide_all_sources()
        finally:
            if callback:
                callback()
        print('[love_me] Abort complete.')

    def abort_and_advance(self, on_complete=None):
        with self.lock:
            self.current_index += 1
            if self.current_index >= len(self.items):
                self.current_index = 0
            return self.play_next_async(on_complete=on_complete)

    def print_config(self):
        print('[love_me] Items:')
        for index, item in enumerate(self.items, 1):
            print(f"  {index}. display='{item['display_name']}' monitor='{item['monitor_name']}'")

"""Own a random-playback loop and its cancellation across rapid replacements."""
import threading


class RandomMode:
    def __init__(self, name, parent_stop, stop_playback, *, join_timeout=2, active=None):
        self.name = name
        self.parent_stop = parent_stop
        self.stop_playback = stop_playback
        self.join_timeout = join_timeout
        self.active = active if active is not None else [False]
        self._control = threading.RLock()
        self._state = threading.Lock()
        self._cancelled = threading.Event()
        self._thread = None

    def stop(self):
        with self._control:
            with self._state:
                was_active = self.active[0]
                self.active[0] = False
                self._cancelled.set()
                thread = self._thread
            try:
                if was_active:
                    self.stop_playback()
            finally:
                if thread and thread is not threading.current_thread() and thread.is_alive():
                    thread.join(timeout=self.join_timeout)

    def start(self, target, *args):
        with self._control:
            self.stop()
            if self.parent_stop.is_set():
                return
            cancelled = threading.Event()
            def run():
                try:
                    if not cancelled.is_set() and not self.parent_stop.is_set():
                        target(*args, cancelled=cancelled)
                except Exception as exc:
                    print(f'[{self.name}] Random playback failed: {exc}')
                finally:
                    with self._state:
                        if self._cancelled is cancelled:
                            self.active[0] = False
            thread = threading.Thread(target=run, name=f'{self.name}:random', daemon=True)
            with self._state:
                self._cancelled = cancelled
                self._thread = thread
                self.active[0] = True
            try:
                thread.start()
            except Exception:
                with self._state:
                    self.active[0] = False
                    cancelled.set()
                    self._thread = None
                raise

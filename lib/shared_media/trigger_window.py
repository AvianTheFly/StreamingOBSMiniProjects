"""Manual-key window shared by voice-enabled media projects.

Projects choose keys and actions. This object owns the deadline, the winning
manual claim, and suppression of a voice result after a manual key wins.
"""
import threading


class ManualTriggerWindow:
    def __init__(self, stop_event):
        self.stop_event = stop_event
        self._lock = threading.Lock()
        self._timer = None
        self._generation = 0
        self._active = False
        self._suppressed = False

    def open(self, seconds):
        with self._lock:
            self._close_locked()
            self._suppressed = False
            if self.stop_event.is_set():
                return
            self._active = True
            generation = self._generation
            def expire():
                with self._lock:
                    if self._generation == generation:
                        self._active = False
                        self._timer = None
            self._timer = threading.Timer(seconds, expire)
            self._timer.daemon = True
            try:
                self._timer.start()
            except Exception:
                self._close_locked()
                raise

    def _close_locked(self):
        self._generation += 1
        self._active = False
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    def close(self):
        with self._lock:
            self._close_locked()

    @property
    def is_open(self):
        with self._lock:
            return self._active and not self.stop_event.is_set()

    def claim(self, key, mapping):
        with self._lock:
            if self.stop_event.is_set() or not self._active or key not in mapping:
                return False
            self._close_locked()
            self._suppressed = True
            return True

    def consume_suppression(self):
        with self._lock:
            suppressed = self._suppressed
            self._suppressed = False
            return suppressed

"""A lazy serial worker for short shared-resource state transitions.

No caller lock is held while a queued action runs. Playback and long waits belong
to source workers, not this queue. Reentrant calls execute inline on the worker.
"""
from concurrent.futures import Future
from collections import deque
import threading


class SerialActions:
    def __init__(self, name):
        self.name = name
        self._lock = threading.Lock()
        self._queue = deque()
        self._thread = None

    def submit(self, action):
        result = Future()
        with self._lock:
            self._queue.append((action, result))
            if self._thread is None:
                self._thread = threading.Thread(target=self._drain, name=self.name, daemon=True)
                try:
                    self._thread.start()
                except BaseException:
                    self._queue.pop()
                    self._thread = None
                    raise
        return result

    def call(self, action):
        if threading.current_thread() is self._thread:
            return action()
        return self.submit(action).result()

    def _drain(self):
        while True:
            with self._lock:
                if not self._queue:
                    self._thread = None
                    return
                action, result = self._queue.popleft()
            if not result.set_running_or_notify_cancel():
                continue
            try:
                result.set_result(action())
            except BaseException as exc:
                result.set_exception(exc)

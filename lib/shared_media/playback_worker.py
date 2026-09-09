"""One owner per shared media source, with a single replaceable pending request.

Callbacks receive a cancellation Event and must check it between load stages
and while playing. The next callback starts only after the old one's cleanup.
"""
from __future__ import annotations

import threading
from collections.abc import Callable


class PlaybackWorker:
    def __init__(self, name: str):
        self._name = name
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._active: threading.Event | None = None
        self._pending = None

    @property
    def busy(self) -> bool:
        with self._lock:
            return self._active is not None or self._pending is not None

    def submit(self, run: Callable[[threading.Event], None]) -> threading.Event:
        """Return a completion signal, also set if this request is superseded."""
        done = threading.Event()
        with self._lock:
            if self._active is not None:
                self._active.set()
            if self._pending is not None:
                self._pending[1].set()
            self._pending = (run, done)
            if self._thread is None:
                self._thread = threading.Thread(target=self._drain, name=self._name, daemon=True)
                self._thread.start()
        return done

    def cancel(self) -> None:
        with self._lock:
            if self._active is not None:
                self._active.set()
            if self._pending is not None:
                self._pending[1].set()
                self._pending = None

    def _drain(self) -> None:
        while True:
            with self._lock:
                if self._pending is None:
                    self._thread = None
                    return
                run, done = self._pending
                self._pending = None
                cancelled = self._active = threading.Event()
            try:
                run(cancelled)
            except Exception as exc:
                print(f"[{self._name}] Playback worker failed: {exc}")
            finally:
                with self._lock:
                    self._active = None
                done.set()

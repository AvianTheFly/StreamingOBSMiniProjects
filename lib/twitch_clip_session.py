"""Explicit authorization/lifetime contract used by the shared Twitch clip service.

Celebrations publishes callbacks; consumers receive no feature service object.
The token stays in memory and must never be included in diagnostics or logging.
"""
from dataclasses import dataclass
import threading


@dataclass(frozen=True)
class ClipSession:
    token: object
    available: object
    stop: object


class ClipSessions:
    def __init__(self):
        self._lock = threading.Lock()
        self._owner = self._session = None

    def register(self, owner, *, token, available, stop):
        with self._lock:
            self._owner, self._session = owner, ClipSession(token, available, stop)

    def unregister(self, owner):
        with self._lock:
            if self._owner is owner:
                self._owner = self._session = None

    def get(self):
        with self._lock:
            return self._session


clip_sessions = ClipSessions()

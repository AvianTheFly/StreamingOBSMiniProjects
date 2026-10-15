"""Mood keyboard policy: bounded selection after 987, with no extra hook/timer."""
import threading
import time

from .config import LISTENER_HOTKEY, LISTENER_SECONDS, ORIGINAL_HOTKEY, TRIGGER_MAX_INTERVAL
from .trigger import SequenceTrigger


class MoodHotkeys:
    def __init__(self, stop_event, *, clock=time.monotonic):
        self.stop_event = stop_event
        self.clock = clock
        self._lock = threading.Lock()
        self._deadline = 0.0
        self._opener = SequenceTrigger(list(LISTENER_HOTKEY), TRIGGER_MAX_INTERVAL)
        self._selectors = []
        self.reload([])

    def reload(self, rows):
        replacement = [('original', SequenceTrigger(list(ORIGINAL_HOTKEY), TRIGGER_MAX_INTERVAL))]
        replacement.extend((row['id'], SequenceTrigger(list(row['hotkey'].lower()), TRIGGER_MAX_INTERVAL))
                           for row in rows if row['hotkey'])
        with self._lock:
            self._selectors = replacement
            self._close_locked()

    def _close_locked(self):
        self._deadline = 0.0
        self._opener.reset()
        for _, trigger in self._selectors:
            trigger.reset()

    def close(self):
        with self._lock:
            self._close_locked()

    def _open_locked(self):
        self._close_locked()
        if self.stop_event.is_set():
            return False
        self._deadline = self.clock() + LISTENER_SECONDS
        return True

    def open(self):
        with self._lock:
            return self._open_locked()

    def snapshot(self):
        with self._lock:
            remaining = max(0.0, self._deadline - self.clock()) if not self.stop_event.is_set() else 0.0
            return {'listening': remaining > 0, 'remaining_seconds': remaining}

    def press(self, key):
        """Return one cue identity only for an armed selection; opener never plays."""
        with self._lock:
            if self.stop_event.is_set() or key == 'esc':
                self._close_locked()
                return None
            if len(key) != 1:
                return None
            if self._deadline and self.clock() >= self._deadline:
                self._close_locked()
            if self._opener.register_key(key):
                self._open_locked()
                return None
            if not self._deadline:
                return None
            for identity, trigger in self._selectors:
                if trigger.register_key(key.lower()):
                    self._close_locked()
                    return identity
            return None

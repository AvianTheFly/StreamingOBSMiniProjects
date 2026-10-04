"""Publish complete read-only mapping generations to concurrent readers."""
from collections.abc import Mapping
import threading


class SnapshotMap(Mapping):
    def __init__(self, values=()):
        self._lock = threading.Lock()
        self._values = dict(values)

    def replace(self, values):
        replacement = dict(values)
        with self._lock:
            self._values = replacement

    def snapshot(self):
        with self._lock:
            return dict(self._values)

    def __getitem__(self, key):
        with self._lock:
            return self._values[key]

    def __iter__(self):
        return iter(self.keys())

    def __len__(self):
        with self._lock:
            return len(self._values)

    def keys(self):
        with self._lock:
            return self._values.keys()

    def values(self):
        with self._lock:
            return self._values.values()

    def items(self):
        with self._lock:
            return self._values.items()

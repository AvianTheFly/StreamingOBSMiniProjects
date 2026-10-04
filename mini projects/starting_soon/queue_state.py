"""Thread-safe session queue; edits affect upcoming clips, never the loaded asset."""
import random
import threading
import uuid


class ClipQueue:
    def __init__(self, rows, *, loop=False, shuffle=False, rng=None):
        self.lock = threading.RLock()
        self.loop, self.shuffle = loop, shuffle
        self.rng = rng or random.Random()
        self.cycle = [{**r, 'entry_id': uuid.uuid4().hex} for r in rows]
        self.pending = self._cycle('')
        self.current = None
        self.history = []
        self.played = 0

    def _cycle(self, previous):
        rows = list(self.cycle)
        if self.shuffle:
            self.rng.shuffle(rows)
            if len(rows) > 1 and rows[0]['path'] == previous:
                different = next((i for i, row in enumerate(rows) if row['path'] != previous), None)
                if different is not None:
                    rows[0], rows[different] = rows[different], rows[0]
        return rows

    def take(self):
        with self.lock:
            if not self.pending:
                self.current = None
                return None
            self.current = self.pending.pop(0)
            self.played += 1
            if not self.pending and self.loop:
                self.pending = self._cycle(self.current['path'])
            return dict(self.current)

    def complete(self, outcome='played'):
        with self.lock:
            if self.current:
                self.history = [{**self.current, 'outcome': outcome}, *self.history][:12]
            self.current = None

    def enqueue_next(self, rows):
        with self.lock:
            if len(rows) + len(self.pending) > 500:
                raise ValueError('The live queue is limited to 500 clips.')
            self.pending = [{**r, 'entry_id': uuid.uuid4().hex} for r in rows] + self.pending

    def remove(self, entry_id):
        with self.lock:
            self.pending = [r for r in self.pending if r['entry_id'] != entry_id]
            self.cycle = [r for r in self.cycle if r['entry_id'] != entry_id]

    def move_next(self, entry_id):
        with self.lock:
            row = next((r for r in self.pending if r['entry_id'] == entry_id), None)
            if row is None:
                raise ValueError('That queued clip has already played. Refresh the queue.')
            self.pending = [row] + [r for r in self.pending if r['entry_id'] != entry_id]

    def snapshot(self):
        with self.lock:
            return dict(current=dict(self.current) if self.current else None,
                        upcoming=[dict(r) for r in self.pending], history=[dict(r) for r in self.history],
                        loop=self.loop, shuffle=self.shuffle, played=self.played)

"""Bounded upcoming sequence for the existing replay playback worker."""
from __future__ import annotations
import random
import threading
import uuid

LIMIT = 200
LOOKAHEAD = 6


class ReplayQueue:
    def __init__(self):
        self._lock = threading.RLock()
        self._revision = 0
        self._session = ''
        self._active = False
        self._editable = False
        self._random = False
        self._current = None
        self._upcoming = []
        self._index = 0

    @staticmethod
    def _entry(path):
        return {'id': uuid.uuid4().hex, 'path': str(path)}

    def begin(self, paths, *, shuffle=False):
        with self._lock:
            self._session = uuid.uuid4().hex
            self._active = True
            self._editable = True
            self._random = shuffle
            self._current = None
            self._index = 0
            self._upcoming = [self._entry(p) for p in paths]
            self._revision += 1
            return self._session

    def _fill(self, candidates):
        if not self._random or not candidates:
            return
        candidates = list(dict.fromkeys(map(str, candidates)))
        while len(self._upcoming) < LOOKAHEAD:
            previous = (self._upcoming[-1] if self._upcoming else self._current) or {}
            used = {e['path'] for e in self._upcoming}
            pool = [p for p in candidates if p not in used and p != previous.get('path')]
            pool = pool or [p for p in candidates if p != previous.get('path')] or candidates
            self._upcoming.append(self._entry(random.choice(pool)))

    def take(self, session, candidates=()):
        with self._lock:
            if not self._active or session != self._session:
                return None
            self._fill(candidates)
            if not self._upcoming:
                self._editable = False
                return None
            self._current = self._upcoming.pop(0)
            self._index += 1
            self._fill(candidates)
            self._revision += 1
            return dict(self._current)

    def snapshot(self):
        with self._lock:
            return {'supported': True, 'active': self._active, 'editable': self._editable, 'session': self._session,
                    'revision': self._revision, 'random': self._random,
                    'current': dict(self._current) if self._current else None,
                    'upcoming': [dict(e) for e in self._upcoming], 'index': self._index,
                    'total': '∞' if self._random else self._index + len(self._upcoming)}

    def edit(self, body, paths=()):
        with self._lock:
            if not self._active or not self._editable or body.get('session') != self._session:
                raise ValueError('This playback session has finished. Refresh the queue.')
            if body.get('revision') != self._revision:
                raise ValueError('The queue advanced. Refresh, then try again.')
            action = body.get('action')
            if action == 'add':
                if len(self._upcoming) + len(paths) > LIMIT:
                    raise ValueError('The queue holds up to 200 clips.')
                before = body.get('before')
                index = next((i for i, e in enumerate(self._upcoming) if e['id'] == before), len(self._upcoming))
                self._upcoming[index:index] = [self._entry(p) for p in paths]
            elif action in ('remove', 'move'):
                index = next((i for i, e in enumerate(self._upcoming) if e['id'] == body.get('id')), None)
                if index is None:
                    raise ValueError('That clip is already playing or has left the queue.')
                entry = self._upcoming.pop(index)
                if action == 'move':
                    before = body.get('before')
                    target = next((i for i, e in enumerate(self._upcoming) if e['id'] == before), len(self._upcoming))
                    self._upcoming.insert(target, entry)
            elif action == 'random':
                self._random = bool(body.get('enabled'))
            elif action == 'clear':
                self._upcoming = []
                self._random = False
            else:
                raise ValueError('Unknown queue action.')
            self._revision += 1
            return self.snapshot()

    def remove_paths(self, paths):
        with self._lock:
            old = self._upcoming
            self._upcoming = [e for e in old if e['path'] not in paths]
            if len(old) != len(self._upcoming):
                self._revision += 1

    def finish(self, session):
        with self._lock:
            if session == self._session:
                self._active = False
                self._editable = False
                self._current = None
                self._upcoming = []
                self._random = False
                self._revision += 1

    def close(self, session):
        """Reject edits through the worker's final source/scene cleanup."""
        with self._lock:
            if session == self._session:
                self._editable = False
                self._revision += 1

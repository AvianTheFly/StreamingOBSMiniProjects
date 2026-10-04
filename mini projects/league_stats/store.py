"""Transactional archive outside Git; keep complete matches and observation audit."""
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import threading
from contextlib import contextmanager
from lib.paths import PROJECT_ROOT


def default_path():
    identity = hashlib.sha256(str(PROJECT_ROOT.resolve()).encode()).hexdigest()[:12]
    return Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'StreamingHub' / 'league-stats' / identity / 'history.sqlite3'


class Store:
    def __init__(self, path=None):
        self.path = Path(path or default_path())
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        with self.connection() as db:
            db.execute('CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, payload TEXT NOT NULL)')

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=5)
        try:
            with db:
                yield db
        finally:
            db.close()

    def records(self):
        with self.lock, self.connection() as db:
            return [json.loads(row[0]) for row in db.execute('SELECT payload FROM matches')]

    def get(self, key):
        with self.lock, self.connection() as db:
            row = db.execute('SELECT payload FROM matches WHERE id=?', (key,)).fetchone()
            return json.loads(row[0]) if row else None

    def put(self, record):
        with self.lock, self.connection() as db:
            old = db.execute('SELECT payload FROM matches WHERE id=?', (record['id'],)).fetchone()
            existing = json.loads(old[0]) if old else {}
            # Unknown fields, checkpoints and manual journals survive enrichment.
            merged = {**existing, **record}
            db.execute('INSERT OR REPLACE INTO matches VALUES (?,?)',
                       (merged['id'], json.dumps(merged, ensure_ascii=False, allow_nan=False)))
        return merged

    def metadata(self, key, value=None):
        with self.lock, self.connection() as db:
            if value is not None:
                db.execute('INSERT OR REPLACE INTO metadata VALUES (?,?)', (key, json.dumps(value)))
                return value
            row = db.execute('SELECT payload FROM metadata WHERE key=?', (key,)).fetchone()
            return json.loads(row[0]) if row else None

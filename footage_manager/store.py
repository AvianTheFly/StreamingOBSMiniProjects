"""Persistent catalogue. Source files are never moved during indexing."""
import json
import sqlite3
import threading
import time
from pathlib import Path

STATUSES = {'unreviewed', 'reviewing', 'rereview', 'later', 'keep_full', 'keep_clips', 'delete'}
DECISIONS = {'keep', 'maybe', 'rereview', 'reject'}
USES = {'unused', 'project', 'published'}


class Store:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(self.directory / 'library.sqlite3', check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS videos (
          id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
          size INTEGER NOT NULL, mtime_ns INTEGER NOT NULL, duration REAL DEFAULT 0,
          streams TEXT DEFAULT '[]', status TEXT DEFAULT 'unreviewed', position REAL DEFAULT 0,
          game TEXT DEFAULT '', tags TEXT DEFAULT '', notes TEXT DEFAULT '',
          error TEXT DEFAULT '', availability TEXT DEFAULT 'online', trash_path TEXT DEFAULT '',
          updated REAL DEFAULT 0, coverage TEXT DEFAULT '[]', title TEXT DEFAULT '');
        CREATE TABLE IF NOT EXISTS ranges (
          id INTEGER PRIMARY KEY, video_id INTEGER NOT NULL REFERENCES videos(id),
          start REAL NOT NULL, end REAL NOT NULL, title TEXT DEFAULT '',
          decision TEXT DEFAULT 'keep', tags TEXT DEFAULT '', purpose TEXT DEFAULT '',
          usage TEXT DEFAULT 'unused', collection TEXT DEFAULT '', notes TEXT DEFAULT '',
          exported TEXT DEFAULT '', export_signature TEXT DEFAULT '', export_info TEXT DEFAULT '{}');
        ''')
        self.db.commit()
        if 'title' not in {r['name'] for r in self.db.execute('PRAGMA table_info(videos)')}:
            self.backup()
            self.db.execute("ALTER TABLE videos ADD COLUMN title TEXT DEFAULT ''")
            self.db.commit()

    def rows(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def execute(self, sql, args=()):
        with self.lock:
            cur = self.db.execute(sql, args)
            self.db.commit()
            return cur.lastrowid

    def setting(self, key, default=None):
        rows = self.rows('SELECT value FROM settings WHERE key=?', (key,))
        return json.loads(rows[0]['value']) if rows else default

    def set_setting(self, key, value):
        self.execute('INSERT OR REPLACE INTO settings VALUES (?,?)', (key, json.dumps(value)))

    def video(self, ident):
        rows = self.rows('SELECT * FROM videos WHERE id=?', (int(ident),))
        if not rows:
            raise ValueError('Recording not found')
        return rows[0]

    def ranges(self, ident):
        return self.rows('SELECT * FROM ranges WHERE video_id=? ORDER BY start,id', (int(ident),))

    def review_videos(self):
        from footage_manager.review_pool import candidates
        return candidates(self.rows('SELECT * FROM videos ORDER BY name DESC'))

    def update_video(self, ident, changes):
        video = self.video(ident)
        allowed = {'status', 'position', 'game', 'tags', 'notes', 'coverage', 'title'}
        data = {k: v for k, v in changes.items() if k in allowed}
        if 'status' in data and data['status'] not in STATUSES:
            raise ValueError('Unknown review status')
        if 'position' in data:
            data['position'] = max(0, min(float(data['position']), video['duration']))
        if 'coverage' in data:
            intervals = json.loads(video['coverage']) + data['coverage']
            merged = []
            for start, end in sorted((max(0, float(a)), min(video['duration'], float(b))) for a, b in intervals):
                if end <= start:
                    continue
                if merged and start <= merged[-1][1]+1:
                    merged[-1][1] = max(end, merged[-1][1])
                else:
                    merged.append([start, end])
            data['coverage'] = json.dumps(merged)
        if not data:
            return
        data['updated'] = time.time()
        self.execute('UPDATE videos SET ' + ','.join(k+'=?' for k in data) + ' WHERE id=?', (*data.values(), int(ident)))

    def save_range(self, data):
        video = self.video(data['video_id'])
        start, end = float(data['start']), float(data['end'])
        if not (0 <= start < end <= video['duration'] + .1):
            raise ValueError('Range must have a start before its end, within the recording')
        if data.get('decision', 'keep') not in DECISIONS or data.get('usage', 'unused') not in USES:
            raise ValueError('Unknown range decision or usage')
        keys = ('start', 'end', 'title', 'decision', 'tags', 'purpose', 'usage', 'collection', 'notes')
        defaults = {'decision': 'keep', 'usage': 'unused'}
        values = [start, end] + [str(data.get(k, defaults.get(k, ''))) for k in keys[2:]]
        if data.get('id'):
            if not self.rows('SELECT id FROM ranges WHERE id=? AND video_id=?', (int(data['id']), video['id'])):
                raise ValueError('Range not found in this recording')
            self.execute('UPDATE ranges SET '+','.join(k+'=?' for k in keys)+' WHERE id=?', (*values, int(data['id'])))
            return int(data['id'])
        return self.execute('INSERT INTO ranges (video_id,'+','.join(keys)+') VALUES ('+','.join('?' for _ in range(10))+')', (video['id'], *values))

    def backup(self):
        path = self.directory / 'backups'
        path.mkdir(exist_ok=True)
        target = path / (time.strftime('%Y%m%d-%H%M%S') + '-' + str(time.time_ns())[-9:] + '.sqlite3')
        with self.lock:
            other = sqlite3.connect(target)
            try:
                self.db.backup(other)
            finally:
                other.close()
        return str(target)

    def signature(self, video, clip):
        return json.dumps([video['path'], video['size'], video['mtime_ns'], clip['start'], clip['end']], separators=(',', ':'))

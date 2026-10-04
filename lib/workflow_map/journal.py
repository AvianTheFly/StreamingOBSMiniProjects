"""Bounded, local workflow history. One writer belongs to the Hub UI lifetime.

Producers enqueue promptly. Observation cannot change application behavior; no
OBS connection, microphone, hooks, playback worker or import-time side effect.
"""
from __future__ import annotations

from collections import deque
from contextlib import contextmanager, closing
import copy
import json
import os
from pathlib import Path
import queue
import sqlite3
import threading
import time
import uuid

ALLOWED = frozenset('event owner requester project scene source action mode kind reason outcome phase paused resumed ready allowed cancelled sequence dispatch parent listener listeners targets target status enabled privacy_armed ok accepted count name active is_active is_paused current_activity claims resume_on_release owners temporary_owner reserved_scene pending_scene observing playback pauses projects conversions capacity used queued consumer state session_id result elapsed_ms workflow voice revision manual_revision confidence'.split())


def clean(value, depth=0):
    if depth > 6: return None
    if value is None or isinstance(value, (bool,int,float)): return value
    if isinstance(value,str): return value[:220]
    if isinstance(value,(list,tuple)): return [clean(v,depth+1) for v in value[:40]]
    if isinstance(value,dict):
        return {str(k):({str(owner)[:80]:clean(fields,depth+1) for owner,fields in v.items()}
                       if k in {'playback','pauses'} and isinstance(v,dict) else clean(v,depth+1))
                for k,v in value.items() if k in ALLOWED}
    return None


class WorkflowJournal:
    def __init__(self, directory=None, *, capacity=2048, keep_rows=50000):
        base = Path(os.environ.get('LOCALAPPDATA', str(Path.home()/'.local/share')))
        self.directory = Path(directory) if directory else base/'StreamingHub/workflow-history'
        self.database = self.directory/'observations.sqlite3'
        self._queue = queue.Queue(maxsize=capacity)
        self._recent = deque(maxlen=300)
        self._lock = threading.Lock()
        self._current = {}
        self._stop = threading.Event()
        self._thread = None
        self._session = uuid.uuid4().hex[:12]
        self._keep_rows = keep_rows
        self.dropped = 0
        self.storage_error = False
        self.started_at = None

    @property
    def recording(self):
        return bool(self._thread and self._thread.is_alive())

    def capture(self, record):
        item = {'time': time.time(), 'session': self._session, **clean(record)}
        try: self._queue.put_nowait(item)
        except queue.Full: self.dropped += 1

    def sample(self, state):
        # Owner-keyed maps retain the owner keys; field values are allowlisted.
        state = clean(state)
        with self._lock:
            if state == self._current: return
            self._current = copy.deepcopy(state)
        self.capture({'event':'runtime.state', 'owner':'hub', 'phase':'observed', **state})

    @contextmanager
    def observe(self):
        import events
        if self.recording: raise RuntimeError('Workflow history is already recording')
        self._stop.clear()
        self.started_at = time.time()
        self._thread = threading.Thread(target=self._write, name='hub-workflow-history', daemon=True)
        token = None
        try:
            self._thread.start()
            token = events.observe(self.capture)
            self.capture({'event':'hub.started', 'owner':'hub', 'phase':'observed'})
            yield self
        finally:
            if token is not None: events.unobserve(token)
            self._stop.set()
            if self._thread.ident is not None: self._thread.join(3)

    def _write(self):
        connection = None
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            connection = sqlite3.connect(self.database, timeout=2)
            connection.execute('PRAGMA journal_mode=WAL')
            connection.execute('CREATE TABLE IF NOT EXISTS observations (id INTEGER PRIMARY KEY, time REAL, event TEXT, owner TEXT, record TEXT)')
            connection.execute('CREATE INDEX IF NOT EXISTS observations_time ON observations(time)')
            connection.commit()
        except (OSError, sqlite3.Error): self.storage_error = True
        last_prune = 0
        try:
            while not self._stop.is_set() or not self._queue.empty():
                try: item = self._queue.get(timeout=.15)
                except queue.Empty: continue
                batch = [item]
                while len(batch)<100:
                    try: batch.append(self._queue.get_nowait())
                    except queue.Empty: break
                if connection and not self.storage_error:
                    try:
                        for item in batch:
                            cursor = connection.execute('INSERT INTO observations(time,event,owner,record) VALUES(?,?,?,?)',
                                (item['time'],item.get('event',''),item.get('owner',''),json.dumps(item,ensure_ascii=False)))
                            item['id'] = cursor.lastrowid
                        if time.monotonic()-last_prune>60:
                            connection.execute('DELETE FROM observations WHERE time < ?', (time.time()-14*86400,))
                            connection.execute('DELETE FROM observations WHERE id <= (SELECT MAX(id) FROM observations)-?', (self._keep_rows,))
                            last_prune = time.monotonic()
                        connection.commit()
                    except sqlite3.Error:
                        self.storage_error = True
                with self._lock: self._recent.extend(batch)
        finally:
            if connection: connection.close()

    def snapshot(self):
        with self._lock:
            return {'state':copy.deepcopy(self._current), 'recent':copy.deepcopy(list(self._recent)[-35:]),
                    'started_at':self.started_at,'dropped':self.dropped,
                    'storage':'memory' if self.storage_error else 'local',
                    'recording':bool(self._thread and self._thread.is_alive()),'retention_days':14}

    def history(self, *, before=None, since=0, limit=150, query=''):
        limit = max(1,min(300,int(limit)))
        if self.storage_error or not self.database.is_file():
            with self._lock: rows = copy.deepcopy(list(self._recent))
            rows=[r for r in rows if r['time']>=float(since) and (not query or str(query).casefold() in (r.get('event','')+' '+r.get('owner','')).casefold())]
            return {'records':list(reversed(rows[-limit:])), 'next':None}
        conditions, arguments = ['time >= ?'], [float(since)]
        if before is not None:
            conditions.append('id < ?'); arguments.append(int(before))
        if query:
            conditions.append('(event LIKE ? ESCAPE "\\" OR owner LIKE ? ESCAPE "\\")')
            term = '%' + str(query)[:100].replace('\\','\\\\').replace('%','\\%').replace('_','\\_') + '%'
            arguments.extend((term,term))
        try:
            with closing(sqlite3.connect(self.database, timeout=2)) as connection:
                rows = connection.execute('SELECT id,record FROM observations WHERE '+' AND '.join(conditions)+' ORDER BY id DESC LIMIT ?',
                                          [*arguments,limit+1]).fetchall()
        except sqlite3.Error:
            # The first browser request can arrive before the writer creates its table.
            with self._lock: records = copy.deepcopy(list(self._recent))
            return {'records':list(reversed(records[-limit:])), 'next':None}
        records = [{**json.loads(row[1]),'id':row[0]} for row in rows[:limit]]
        return {'records':records,'next':records[-1]['id'] if len(rows)>limit else None}

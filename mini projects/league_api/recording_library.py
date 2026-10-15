"""Durable game capture decisions, expiry and timeline metadata.

Called under MatchRecording's lock. Only journaled, fingerprint-verified files
are eligible for deletion; directory discovery never supplies deletion targets.
"""
import copy
import json
import time
import uuid
from pathlib import Path

from lib.json_store import update_json
from .recording_storage import RecordingStorage, UNREVIEWED, KEPT, EXTENSIONS

TTL_SECONDS = 3 * 86400


class RecordingLibrary:
    def __init__(self, folder, root, *, wall=time.time):
        self.path = Path(folder) / 'match_recordings.json'
        self.storage = RecordingStorage(root)
        self.wall = wall
        self.data = self._validate(json.loads(self.path.read_text(encoding='utf-8'))
                                   if self.path.exists() else {})

    @staticmethod
    def _validate(data):
        if (not isinstance(data, dict) or not isinstance(data.get('recordings', []), list)
                or any(not isinstance(row, dict) for row in data.get('recordings', []))):
            raise ValueError('Preserve malformed match recording history; repair explicitly')
        return data

    @property
    def records(self):
        return self.data.get('recordings', [])

    def update(self, change):
        def merge(data):
            result = copy.deepcopy(self._validate(data))
            result.setdefault('recordings', [])
            change(result)
            return result
        self.data = update_json(self.path, merge, default={})

    def session(self, active):
        self.update(lambda data: data.update(active=copy.deepcopy(active)))

    def complete(self, value, session):
        existing = self.find(session.get('id')) if session.get('id') else None
        if existing:
            return existing  # Retry after publication/deletion failure, never duplicate.
        path = Path(value).resolve()
        if path.parent != self.storage.root or path.suffix.lower() not in EXTENSIONS:
            raise ValueError('OBS returned an unexpected recording path; file preserved')
        stat = path.stat()
        ended = self.wall()
        decision = session.get('decision', 'pending')
        entry = {**session, 'id': session.get('id', uuid.uuid4().hex),
                 'path': str(path), 'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns,
                 'ended_at': ended, 'expires_at': ended + TTL_SECONDS,
                 'delete_requested': decision == 'deleted',
                 'decision': 'kept' if decision == 'kept' else 'pending'}
        def publish(moved):
            def change(data):
                data['recordings'].append(moved)
                data['active'] = None
            self.update(change)
        self.storage.move(entry, KEPT if decision == 'kept' else UNREVIEWED, publish)
        return self.records[-1]

    def find(self, identity=None):
        if identity is None:
            return self.records[-1] if self.records else None
        return next((r for r in self.records if r.get('id') == identity), None)

    def amend(self, row, **fields):
        def change(data):
            for item in data['recordings']:
                if item.get('path') == row['path']:
                    item.update(copy.deepcopy(fields))
        self.update(change)

    def decide(self, row, decision):
        if not row or row.get('decision') in {'deleted', 'expired'}:
            raise ValueError('The latest recording is already removed, or no game has finished')
        if decision == 'kept':
            if row.get('decision') == 'deleting':
                raise ValueError('Deletion is already in progress')
            self.storage.move(row, KEPT, lambda moved: self.amend(row, path=moved['path'], decision='kept'))
            return
        self.remove(row, 'deleted')

    def remove(self, row, outcome):
        # Commit deletion intent before unlink. A crash after unlink is reconciled
        # from this exact intent; an absent ordinary pending file is never erased
        # from history or silently treated as a successful deletion.
        if row.get('decision') != 'deleting':
            self.storage.validate(row)
            self.amend(row, decision='deleting', delete_outcome=outcome)
        try:
            self.storage.validate(row).unlink()
        except FileNotFoundError:
            pass  # Durable deletion intent is already present.
        self.amend(row, decision=outcome, removed_at=self.wall())

    def expire(self, *, recording_active):
        if recording_active:
            return []
        now = self.wall()
        messages = []
        for row in list(self.records):
            if 'id' not in row:
                self.amend(row, id=uuid.uuid4().hex)
            if row.get('decision') == 'pending' and 'expires_at' not in row:
                # Existing personal captures receive a full review window from
                # first migration, never immediate retrospective deletion.
                self.amend(row, expires_at=now + TTL_SECONDS)
                continue
            due = row.get('decision') == 'pending' and (row.get('delete_requested') or row.get('expires_at', now + 1) <= now)
            if not due and row.get('decision') != 'deleting':
                continue
            try:
                outcome = row.get('delete_outcome', 'deleted' if row.get('delete_requested') else 'expired')
                self.remove(row, outcome)
                messages.append(f"{outcome.capitalize()}: {Path(row['path']).name}")
            except (OSError, ValueError) as exc:
                messages.append(f"Cleanup deferred for {Path(row['path']).name}: {exc}")
        return messages

    def attach_clip(self, marker_id, path):
        def change(data):
            for row in [*data['recordings'], data.get('active')]:
                if not isinstance(row, dict):
                    continue
                for marker in row.get('markers', []):
                    if marker.get('id') == marker_id:
                        marker.update(clip_path=str(path), capture_status='saved')
        self.update(change)

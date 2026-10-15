"""Automatic OBS recording lifecycle; sampled by the existing League worker."""
from __future__ import annotations

import copy
import queue
import threading
import time
import uuid
from pathlib import Path

from .recording_library import RecordingLibrary
from .recording_timeline import offset_at, observe_clock

ACTIVE = {'ChampSelect', 'GameStart', 'InProgress', 'Reconnect'}
FINISHED = {'None', 'Lobby', 'Matchmaking', 'ReadyCheck', 'PreEndOfGame',
            'EndOfGame', 'WaitingForStats', 'TerminatedInError'}


class MatchRecording:
    def __init__(self, folder, replay_dir, *, enabled=False, obs_factory=None,
                 clock=time.monotonic, wall=time.time, audio_check=None):
        if obs_factory is None:
            from obs import get_obs
            obs_factory = get_obs
        self.obs_factory, self.clock, self.wall = obs_factory, clock, wall
        self.enabled = enabled
        self.audio_check = audio_check
        self.root = Path(replay_dir).resolve()
        self.library = RecordingLibrary(folder, self.root, wall=wall)
        self.lock = threading.RLock()
        self.owned = False
        self.duration = 0
        self.stop_at = None
        self.retry_at = self.cleanup_at = 0
        self.phase = None
        self.finished = self.last_live = False
        self.status = 'Waiting for champion select'
        self.error = self.cleanup_message = None
        self.session = None
        self.closing = None
        self.close_fingerprint = None
        self.events = queue.Queue(maxsize=128)
        interrupted = self.library.data.get('active')
        if isinstance(interrupted, dict) and interrupted.get('closing_path'):
            self.session = copy.deepcopy(interrupted)
            self.closing = interrupted['closing_path']

    def _notice(self, message):
        if message != self.status:
            print(f'[league-recording] {message}', flush=True)
        self.status = message

    def snapshot(self):
        with self.lock:
            latest = self.library.find()
            return copy.deepcopy({'enabled': self.enabled, 'owned': self.owned,
                'status': self.status, 'error': self.error, 'cleanup': self.cleanup_message,
                'stop_in': max(0, self.stop_at-self.clock()) if self.stop_at is not None else None,
                'pending': latest if latest and latest.get('decision') == 'pending' else None,
                'active': self.session, 'latest': latest,
                'recordings': self.library.records[-100:], 'ttl_days': 3,
                'audio': 'One video, two synchronized audio tracks: clean first; full mix with music second. The browser previews clean audio; both tracks are available in a video editor.'})

    def enqueue_replay(self, data):
        """Event callbacks enqueue promptly; only the existing poll writes metadata."""
        try:
            self.events.put_nowait(dict(data))
        except queue.Full:
            print('[league-recording] Marker queue full; replay marker was not saved.', flush=True)

    def _drain_replays(self):
        while True:
            try:
                data = self.events.get_nowait()
            except queue.Empty:
                return
            try:
                if data.get('stage') == 'requested':
                    self.mark(at=data['pressed_at'], marker_id=data['id'],
                              label=data.get('label') or 'Instant Replay', source='instant_replay',
                              seconds=data.get('seconds'))
                elif data.get('stage') == 'saved':
                    self.library.attach_clip(data['id'], data['path'])
                    if self.session:
                        for marker in self.session['markers']:
                            if marker['id'] == data['id']:
                                marker.update(clip_path=data['path'], capture_status='saved')
            except (OSError, ValueError, KeyError) as exc:
                print(f'[league-recording] Replay marker unavailable: {exc}', flush=True)

    def mark(self, *, at=None, marker_id=None, label='Marked moment', source='hotkey', seconds=None):
        with self.lock:
            if source != 'instant_replay' and not self.owned:
                raise ValueError('No owned game recording is active; no moment marked')
            at = self.wall() if at is None else float(at)
            row = self.session
            if not row or not row['started_at'] <= at <= self.wall() + 1:
                row = next((r for r in reversed(self.library.records)
                            if r.get('started_at', float('inf')) <= at <= r.get('ended_at', 0)
                            and r.get('decision') not in {'deleted', 'expired', 'deleting'}), None)
            if row is None:
                raise ValueError('No owned game recording covers this moment')
            # OBS output time, corrected by each verified status sample, is the
            # media timeline. It excludes pauses and survives a delayed clip save.
            offset = offset_at(row, at)
            if row is not self.session:
                offset = min(offset, row.get('duration_seconds', offset))
            marker = {'id': marker_id or uuid.uuid4().hex, 'offset_seconds': round(offset, 3),
                      'at': at, 'label': str(label)[:200], 'source': source}
            if any(m.get('id') == marker['id'] for m in row.get('markers', [])):
                return {'ok': True, 'message': 'Moment already marked'}
            if source == 'instant_replay':
                marker['capture_status'] = 'requested'
                if seconds is not None:
                    marker['range_start_seconds'] = round(max(0, offset - float(seconds)), 3)
            markers = [*row.get('markers', []), marker]
            if row is self.session:
                updated = {**row, 'markers': markers}
                self.library.session(updated)
                self.session = updated
            else:
                self.library.amend(row, markers=markers)
            message = f"Marked {int(offset)//60}:{int(offset)%60:02d} — {marker['label']}"
            self._notice(message)
            return {'ok': True, 'message': message, 'marker': marker}

    def tick(self, phase, *, live=False, ended=False):
        with self.lock:
            self._drain_replays()
            if not self.enabled:
                return
            now = self.clock()
            new_draft = phase == 'ChampSelect' and self.phase != 'ChampSelect'
            self.phase = phase
            if new_draft or (live and not self.last_live and not ended):
                self.finished = False
            self.last_live = live
            end_confirmed = ((ended and phase not in {'ChampSelect', 'GameStart'})
                             or (phase in FINISHED and not live))
            if end_confirmed:
                self.finished = True
            active = (phase in ACTIVE or live) and not self.finished
            if self.owned and self.stop_at is None and end_confirmed:
                self.stop_at = now + 60
                self._notice('Game finished; recording stops in 60 seconds')
            if self.owned and new_draft and self.stop_at is not None:
                self.stop_at = now
            if now < self.retry_at:
                return
            try:
                if self.closing:
                    # StopRecord may return before MP4 finalization. Require two
                    # unchanged samples and an inactive OBS writer before moving.
                    client = self.obs_factory()
                    if client.get_record_status().output_active:
                        raise ValueError('Waiting for OBS to close the previous recording')
                    if not self.library.find(self.session['id']):
                        stat = Path(self.closing).stat()
                        fingerprint = (stat.st_size, stat.st_mtime_ns)
                        if fingerprint != self.close_fingerprint:
                            self.close_fingerprint = fingerprint
                            self.retry_at = now + 1
                            return
                    self._remember(self.closing)
                    self.closing = None
                    self.close_fingerprint = None
                    self.session = None
                if now >= self.cleanup_at:
                    self.cleanup_at = now + 60
                    messages = self.library.expire(recording_active=self.obs_factory().get_record_status().output_active)
                    self.cleanup_message = '; '.join(messages) or None
                    for message in messages:
                        print(f'[league-recording] {message}', flush=True)
                if not self.owned and not active:
                    self.error = None
                    return
                client = self.obs_factory()
                status = client.get_record_status()
                duration = status.output_duration
                if self.owned and (not status.output_active or duration < self.duration):
                    self.owned = False
                    self.stop_at = None
                    self.session = None
                    self._notice('OBS recording changed manually; previous footage preserved outside automatic management')
                if self.owned:
                    observe_clock(self.session, self.wall(), duration / 1000, status.output_paused)
                if self.owned and self.stop_at is not None and now >= self.stop_at:
                    result = client.stop_record()
                    self.owned = False
                    self.stop_at = None
                    self.closing = result.output_path
                    self.library.session({**self.session, 'closing_path': self.closing})
                    self._notice('OBS stopped; finalizing game file')
                    self.retry_at = now + 1
                    return
                elif self.owned and status.output_paused:
                    client.resume_record()
                if active and self.stop_at is None and not self.owned:
                    status = client.get_record_status()
                    if status.output_active:
                        self._notice('OBS already recording (manually owned; Keep/Delete do not target it)')
                    else:
                        directory = Path(client.get_record_directory().record_directory).resolve()
                        if directory != self.root:
                            raise ValueError('OBS recording folder differs from REPLAY_DIR')
                        audio_tracks = self.audio_check(client) if self.audio_check else []
                        client.start_record()
                        self.owned = True
                        duration = 0
                        started = self.wall()
                        self.session = {'id': uuid.uuid4().hex, 'started_at': started,
                                        'timeline_origin': started, 'markers': [], 'decision': 'pending',
                                        'audio_tracks': audio_tracks}
                        self.library.session(self.session)
                        self._notice('Recording champion select and game · *K* keep · *D* delete after finish · /* mark')
                self.duration = duration
                self.error = None
                self.retry_at = min(now + 2, self.stop_at) if self.stop_at is not None else now + 2
            except Exception as exc:
                if self.error != str(exc):
                    print(f'[league-recording] Needs attention: {exc}', flush=True)
                self.error = str(exc)
                self.retry_at = now + 5

    def _remember(self, value):
        row = self.library.complete(value, self.session or {})
        decision = (self.session or {}).get('decision')
        if decision == 'deleted':
            self.library.decide(row, 'deleted')
            self._notice(f"Deleted requested recording: {Path(value).name}")
        elif decision == 'kept':
            self._notice(f"Kept permanently: {Path(value).name}")
        else:
            expiry = time.strftime('%Y-%m-%d %H:%M', time.localtime(row['expires_at']))
            self._notice(f"Saved {Path(value).name} · auto-deletes {expiry} unless kept · *K* keep · *D* delete")

    def decide(self, decision, identity=None):
        if decision not in {'kept', 'deleted'}:
            raise ValueError('Choose kept or deleted')
        with self.lock:
            if self.session and identity in {None, self.session['id']}:
                updated = {**self.session, 'decision': decision}
                self.library.session(updated)
                self.session = updated
                self._notice('Current game protected: it will be kept permanently' if decision == 'kept'
                             else 'Current game will be deleted after OBS closes the file; *K* cancels this')
            else:
                row = self.library.find(identity)
                if decision == 'deleted' and self.obs_factory().get_record_status().output_active:
                    raise ValueError('Wait until OBS recording has stopped before deleting a completed file')
                self.library.decide(row, decision)
                self._notice(f"Recording {decision}: {Path(row['path']).name}")
            return {'ok': True, 'message': self.status, 'recording': self.snapshot()}

    def media_path(self, identity):
        with self.lock:
            row = self.library.find(identity)
            if not row or row.get('decision') not in {'pending', 'kept'}:
                raise ValueError('Recording is unavailable')
            return self.library.storage.validate(row)

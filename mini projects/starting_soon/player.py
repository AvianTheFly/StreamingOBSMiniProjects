"""Dedicated clip worker: queue consumption, playback progress, permission and cleanup."""
import threading
import time
import obs
from lib.shared_media.playback_worker import PlaybackWorker
from lib.shared_media.media_startup import media_startup, MediaStartupCancelled
from .levels import ClipLevels
from .queue_state import ClipQueue
from .config import STAGE as SCENE, MEDIA, ROOT


class ClipPlayer:
    def __init__(self, gate, publish, place=None):
        self.gate, self.publish, self.place = gate, publish, place
        self.worker = PlaybackWorker('starting-soon:clips')
        self.skip = threading.Event()
        self.done = threading.Event()
        self.done.set()
        self.fader = ClipLevels(MEDIA, ROOT / 'asset_volumes.json')
        self.plan = None

    def play(self, rows, session, *, loop=True, shuffle=False, gap_seconds=0):
        plan = ClipQueue(rows, loop=loop, shuffle=shuffle)
        self.plan = plan
        self.done = self.worker.submit(lambda cancel: self._play(cancel, plan, session, gap_seconds))

    def snapshot(self):
        data = self.plan.snapshot() if self.plan else dict(current=None, upcoming=[], history=[], played=0)
        return {**data, 'busy':self.worker.busy, 'paused':self.worker.busy and not self.gate.is_set()}

    def edit_queue(self, action, body, rows=None):
        if not self.worker.busy or self.plan is None:
            raise ValueError('Start a playlist before editing its live queue.')
        if action == 'queue-next':
            self.plan.enqueue_next(rows)
        elif action == 'queue-remove':
            self.plan.remove(str(body.get('entry_id','')))
        elif action == 'queue-first':
            self.plan.move_next(str(body.get('entry_id','')))

    def stop(self):
        self.worker.cancel()

    def close(self):
        self.stop()
        deadline = time.monotonic() + 5
        while self.worker.busy:
            if time.monotonic() >= deadline:
                raise RuntimeError('Clip cleanup is still pending; source reuse is blocked.')
            threading.Event().wait(.05)

    def _owned(self, cancel, session):
        return not cancel.is_set() and session.owns_scene()

    def _load(self, cancel, row, session):
        while not self.gate.wait(.1):
            if not self._owned(cancel, session):
                raise MediaStartupCancelled('Scene ownership changed')
        with media_startup(MEDIA, cancelled=lambda:not self._owned(cancel,session), timeout=8):
            obs.configure_media_source_properties(MEDIA, restart_on_activate=False,
                close_when_inactive=False, looping=False, clear_on_media_end=True)
            self.fader.capture()
            obs.hide_source(SCENE, MEDIA)
            obs.stop_media(MEDIA)
            if self.place:
                self.place(row['path'])
            obs.set_media_source_file(MEDIA, row['path'])
            self.fader.apply_row(row)
            if not self._owned(cancel, session):
                raise MediaStartupCancelled('Scene ownership changed')
            obs.show_source(SCENE, MEDIA)
            # OBS processes source updates asynchronously; settle the queued
            # STOP/file update before restarting an unchanged asset.
            if cancel.wait(.2) or not session.owns_scene():
                raise MediaStartupCancelled('Scene ownership changed')
            obs.restart_media(MEDIA)

    def _wait_clip(self, cancel, session):
        ended, paused, next_capture = 0, False, 0
        deadline = time.monotonic() + 7200
        while not cancel.wait(.15):
            if not session.owns_scene():
                return 'stopped'
            if self.skip.is_set():
                return 'skipped'
            allowed = self.gate.is_set()
            if paused == allowed:
                (obs.play_media if allowed else obs.pause_media)(MEDIA)
                paused = not allowed
            status = obs.get_media_status(MEDIA) or {}
            self.publish(position_ms=status.get('cursor_ms') or 0,
                         duration_ms=status.get('duration_ms') or 0)
            if not allowed:
                deadline += .15
                continue
            if time.monotonic() >= next_capture:
                self.fader.capture()
                next_capture = time.monotonic() + .8
            state = status.get('state')
            ended = ended + 1 if state in ('OBS_MEDIA_STATE_ENDED','OBS_MEDIA_STATE_STOPPED',
                                           'OBS_MEDIA_STATE_ERROR','OBS_MEDIA_STATE_NONE') else 0
            if ended >= 3 or time.monotonic() >= deadline:
                return 'failed' if state == 'OBS_MEDIA_STATE_ERROR' else 'played'
        return 'stopped'

    def _gap(self, seconds, cancel, session):
        remaining = float(seconds)
        self.skip.clear()
        while remaining > 0 and self._owned(cancel,session) and not self.skip.is_set():
            self.publish(gap_remaining=round(remaining,1))
            started = time.monotonic()
            if cancel.wait(.2):
                break
            if self.gate.is_set():
                remaining -= time.monotonic()-started
        self.publish(gap_remaining=0)

    def _park(self):
        try:
            self.fader.capture()
        finally:
            obs.park_media_source(SCENE, MEDIA)

    def _play(self, cancel, plan, session, gap_seconds):
        failed = 0
        parked = False
        try:
            while self._owned(cancel,session):
                row = plan.take()
                if row is None:
                    break
                self.skip.clear()
                parked = False
                self.publish(loading=True, clip_title=row['title'], clip_path=row['path'],
                             position_ms=0, duration_ms=0)
                try:
                    self._load(cancel,row,session)
                    self.publish(playing=True, loading=False, error='')
                    outcome = self._wait_clip(cancel,session)
                    failed = failed+1 if outcome=='failed' else 0
                except MediaStartupCancelled:
                    raise
                except Exception as exc:
                    failed += 1
                    outcome = 'failed'
                    self.publish(error='Skipped clip: '+str(exc))
                finally:
                    parked = True
                    self._park()
                    self.publish(playing=False, loading=False)
                plan.complete(outcome)
                if outcome=='stopped' or failed >= max(1,len(plan.cycle)):
                    break
                if plan.snapshot()['upcoming']:
                    self._gap(gap_seconds,cancel,session)
        except MediaStartupCancelled:
            pass
        except Exception as exc:
            self.publish(error=str(exc))
        finally:
            try:
                if not parked:
                    self._park()
            finally:
                plan.complete('stopped')
                self.publish(playing=False,loading=False,clip_title='',clip_path='',
                             position_ms=0,duration_ms=0,gap_remaining=0)


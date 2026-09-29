"""Thread-safe playback handshake. Only acknowledgements for the current ID count."""
import secrets
import threading
import time


class Channel:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.lock = threading.RLock()
        self.item = None
        self.media = None
        self.last_poll = -1000
        self.last_stem = None
        self.error = None
        self.last_playback = None
        self.started = threading.Event()
        self.done = threading.Event()

    def begin(self, stem, media, effect):
        with self.lock:
            self.started.clear()
            self.done.clear()
            self.error = None
            self.media = media
            self.last_stem = stem
            self.item = dict(id=secrets.token_urlsafe(24), stem=stem, effect=effect,
                             created=self.clock(), started=False, paused=False, paused_at=None, pause_total=0)
            self.last_playback = dict(id=self.item['id'], stem=stem, status='loading')
            return self.item['id']

    def snapshot(self, poll=False):
        with self.lock:
            now = self.clock()
            if poll:
                self.last_poll = now
            active = None
            if self.item:
                active = {k: self.item[k] for k in ('id', 'stem', 'effect', 'paused', 'started')}
                active['elapsed'] = (self.item['paused_at'] if self.item['paused'] else now) - self.item['created'] - self.item['pause_total']
            return dict(active=active, ready=now-self.last_poll < 3, error=self.error,
                        last_playback=self.last_playback)

    def acknowledge(self, playback_id, status):
        with self.lock:
            if not self.item or self.item['id'] != playback_id:
                return False
            if status == 'playing':
                if not self.item['started']:
                    self.item.update(started=True, created=self.clock(), pause_total=0)
                    if self.item['paused']:
                        self.item['paused_at'] = self.clock()
                self.started.set()
            elif status in ('ended', 'error'):
                if status == 'error':
                    self.error = 'Browser could not play audio. Check OBS browser audio/autoplay.'
                self.done.set()
            else:
                raise ValueError('Unknown playback status')
            self.last_playback = dict(id=playback_id, stem=self.item['stem'], status=status)
            return True

    def pause(self, paused):
        with self.lock:
            if not self.item or self.item['paused'] == paused:
                return
            now = self.clock()
            if paused:
                self.item['paused_at'] = now
            else:
                self.item['pause_total'] += now-self.item['paused_at']
                self.item['paused_at'] = None
            self.item['paused'] = paused

    def stop(self, playback_id=None):
        with self.lock:
            if playback_id and (not self.item or self.item['id'] != playback_id):
                return
            if self.item and self.last_playback and self.last_playback['status'] in ('loading', 'playing'):
                self.last_playback = {**self.last_playback, 'status':'stopped'}
            self.item = None
            self.media = None
            self.done.set()

    def matches(self, stem):
        with self.lock:
            return bool(self.last_stem and self.last_stem.casefold() == stem.casefold())

"""Random joke policy sampled by the existing module loop; no extra worker."""
import random
import threading
import time
from lib.json_store import json_transaction, update_json
from lib.settings_backups import SettingsBackups
from . import joke_catalog, settings

PREFIX = '🃏 '


def stream_active():
    from obs.outputs import get_stream_status
    try:
        return get_stream_status().get('active') is True
    except Exception:
        return False


class Jokes:
    def __init__(self, stop, config, send, chat_status, *, live=stream_active,
                 catalog=joke_catalog.CATALOG, history=joke_catalog.HISTORY,
                 clock=time.monotonic, rng=None):
        self.stop, self.config, self.send, self.chat_status = stop, config, send, chat_status
        self.live, self.history, self.clock, self.catalog = live, history, clock, catalog
        self.rng = rng or random.Random()
        self.lock = threading.RLock()
        self.closed = False
        self.generation = 0
        self.key = self.due = self.last_tick = None
        self.queued = 0
        self.message = 'Waiting for stream and chat connection'
        self.error = None
        try:
            self.data = joke_catalog.read(catalog)
        except (OSError,ValueError,TypeError,AttributeError):
            self.data = dict(enabled=False,jokes=[])
            self.error = 'Joke catalog could not be read; existing file preserved'

    def snapshot(self):
        with self.lock:
            return dict(enabled=self.data['enabled'],revision=settings.revision(self.data),
                        count=len(self.data['jokes']),message=self.error or self.message,
                        next_in_seconds=max(0,round(self.due-self.clock())) if self.due else None,
                        queued=self.queued,minimum_minutes=20,maximum_minutes=40,
                        catalog=[dict(id=r['id'],text=r['text']) for r in self.data['jokes']])

    def save(self,body):
        if (not isinstance(body,dict) or set(body) != {'revision','enabled'} or
                type(body['enabled']) is not bool):
            raise ValueError('Expected joke revision and enabled switch.')
        with self.lock, json_transaction(self.catalog):
            current = joke_catalog.read(self.catalog)
            if body['revision'] != settings.revision(current):
                raise settings.Conflict('Jokes changed; reload before saving.')
            SettingsBackups().snapshot()
            self.data = update_json(self.catalog,lambda data:{**data,'enabled':body['enabled']})
            self.error = None
            self.key = self.due = None
            self.generation += 1
            self.message = 'Waiting for stream and chat connection' if body['enabled'] else 'Automatic jokes disabled'
            return self.snapshot()

    def permission(self):
        with self.lock:
            if self.stop.is_set() or self.closed or self.error or not self.data['enabled']:
                return None, 'Automatic jokes disabled'
            revision = settings.revision(self.data)
        data = self.config()
        if not data['enabled']:
            return None, 'Chat replies disabled'
        chat = self.chat_status()
        if (chat.get('channel') != data['channel'] or not chat.get('connected') or
                not chat.get('delivery',{}).get('ready')):
            return None, 'Waiting for Twitch chat authorization'
        if not self.live():
            return None, 'Waiting for OBS to stream'
        return (data['channel'],data['revision'],revision), 'Random 20–40 minute rotation active'

    def allowed(self, key, generation):
        current, _ = self.permission()
        with self.lock:
            return (current == key == self.key and generation == self.generation and
                    not self.closed and not self.stop.is_set())

    def wait_seconds(self):
        with self.lock:
            return min(15,max(.1,self.due-self.clock())) if self.due else 15

    def tick(self):
        key, message = self.permission()
        now = self.clock()
        with self.lock:
            if self.closed:
                return
            resumed = self.last_tick is not None and now-self.last_tick > 90
            self.last_tick = now
            self.message = message
            if key is None:
                if self.key is not None:
                    self.generation += 1
                self.key = self.due = None
                return
            if self.key != key or self.due is None or resumed:
                self.generation += 1
                self.key, self.due = key, now+self.rng.uniform(1200,2400)
                return
            if now < self.due:
                return
            self.due = now+self.rng.uniform(1200,2400)
            rows = self.data['jokes']
            generation = self.generation
        try:
            row = joke_catalog.reserve(rows,self.history,self.rng)
        except (OSError,ValueError,TypeError):
            with self.lock:
                self.error = 'Joke history could not be saved; rotation stopped and file preserved'
                self.key = self.due = None
            return
        accepted = self.send(key[0],PREFIX+row['text'],allowed=lambda:self.allowed(key,generation))
        with self.lock:
            if accepted:
                self.queued += 1
            self.message = 'Joke queued; next in 20–40 minutes' if accepted else 'Delivery unavailable; waiting for the next interval'

    def close(self):
        with self.lock:
            self.closed = True
            self.generation += 1
            self.key = self.due = None

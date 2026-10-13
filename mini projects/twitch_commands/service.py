"""Bounded command admission; queued replies reject edited or stopped intent."""
from collections import OrderedDict
from copy import deepcopy
import threading
import time
from . import settings
from .policy import match,render
from .clipping import ClipCommand
from .announcements import Announcements, runtime_ready, clips_available


class Commands:
    def __init__(self,stop,reply,*,path=settings.PATH,clock=time.monotonic,announce=None):
        self.stop,self.reply,self.path,self.clock = stop,reply,path,clock
        self.lock = threading.RLock()
        self.data = settings.read(path)
        self.generation = 0
        self.seen,self.cooldowns = OrderedDict(),OrderedDict()
        self.accepted = 0
        self.clipping = ClipCommand(stop, reply)
        self.announcements = Announcements(announce or (lambda *a, **k: False), clock=clock)

    def snapshot(self):
        with self.lock:
            return {**deepcopy(self.data),'revision':settings.revision(self.data),'accepted':self.accepted,
                    'announcements':self.announcements.snapshot()}

    def save(self,body):
        with self.lock:
            self.data = settings.save(body,self.path)
            self.generation += 1
            self.announcements.reset()
            return self.snapshot()

    def allowed(self,generation):
        with self.lock:
            return not self.stop.is_set() and self.generation==generation and self.data['enabled']

    def receive(self,message):
        with self.lock:
            if str(message.get('text','')).strip().lower() == '!clip':
                generation = self.generation
                return self.clipping.receive(message, self.data,
                                             lambda: self.allowed(generation))
            if self.stop.is_set() or not message.get('id') or not message.get('user_id'):
                return False
            # Shared-chat broadcasts, fake events and repeats never get replies.
            try: fresh = abs(time.time()-int(message.get('sent_at',''))/1000)<=30
            except (ValueError,TypeError): fresh = False
            if not fresh or message['id'] in self.seen:
                return False
            row = match(self.data,message)
            if row is None:
                return False
            self.seen[message['id']] = True
            while len(self.seen)>512: self.seen.popitem(last=False)
            now = self.clock()
            keys = [row['command'],(row['command'],message['user_id'])]
            if any(self.cooldowns.get(key,0)>now for key in keys):
                return False
            generation = self.generation
            text = render(row,self.data,message)
            accepted = self.reply(message['channel'],text,message['id'],
                                  allowed=lambda:self.allowed(generation))
            if accepted:
                self.cooldowns[keys[0]] = now+row.get('cooldown',30)
                self.cooldowns[keys[1]] = now+60
                while len(self.cooldowns)>2048: self.cooldowns.popitem(last=False)
                self.accepted += 1
            return accepted

    def close(self):
        with self.lock:
            self.generation += 1
            self.announcements.reset()

    def tick(self):
        with self.lock:
            generation, channel = self.generation, self.data['channel']
            enabled = self.data['enabled'] and self.data.get('announcements_enabled', False)
        ready = enabled and not self.stop.is_set() and runtime_ready(channel)
        clips_ready = clips_available() if ready else False

        def allowed():
            return self.allowed(generation) and runtime_ready(channel)

        with self.lock:
            if generation != self.generation or self.stop.is_set():
                return False
            return self.announcements.tick(self.data, ready=ready, clips_ready=clips_ready, allowed=allowed)

    def wait_seconds(self):
        with self.lock:
            return self.announcements.wait_seconds()

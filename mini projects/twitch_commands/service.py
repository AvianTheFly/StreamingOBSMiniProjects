"""Bounded command admission; queued replies reject edited or stopped intent."""
from collections import OrderedDict
from copy import deepcopy
import threading
import time
from . import settings
from .policy import match,render


class Commands:
    def __init__(self,stop,reply,*,path=settings.PATH,clock=time.monotonic):
        self.stop,self.reply,self.path,self.clock = stop,reply,path,clock
        self.lock = threading.RLock()
        self.data = settings.read(path)
        self.generation = 0
        self.seen,self.cooldowns = OrderedDict(),OrderedDict()
        self.accepted = 0

    def snapshot(self):
        with self.lock:
            return {**deepcopy(self.data),'revision':settings.revision(self.data),'accepted':self.accepted}

    def save(self,body):
        with self.lock:
            self.data = settings.save(body,self.path)
            self.generation += 1
            return self.snapshot()

    def allowed(self,generation):
        with self.lock:
            return not self.stop.is_set() and self.generation==generation and self.data['enabled']

    def receive(self,message):
        with self.lock:
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

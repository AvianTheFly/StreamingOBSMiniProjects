"""One expiring visual cue received through a scoped Hub event subscription."""
import threading
import time
import events


class StanceAccent:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.lock = threading.Lock()
        self.active = False
        self.cue = None
        self.serial = 0

    def start(self):
        with self.lock:
            if self.active:
                return
            self.active = True
        events.subscribe('league.udyr_stance', self.receive)

    def receive(self, data):
        key = data.get('key')
        if key not in ('q', 'w', 'e', 'r'):
            return
        with self.lock:
            if not self.active:
                return
            self.serial += 1
            self.cue = dict(key=key, started=self.clock(), id=self.serial, duration=1.2)

    def snapshot(self, allowed):
        with self.lock:
            if not allowed:
                self.cue = None
            if self.cue is None:
                return None
            elapsed = self.clock() - self.cue['started']
            if elapsed >= self.cue['duration']:
                self.cue = None
                return None
            return {**self.cue, 'elapsed': max(0, elapsed)}

    def close(self):
        with self.lock:
            self.active = False
            self.cue = None
        events.unsubscribe('league.udyr_stance', self.receive)

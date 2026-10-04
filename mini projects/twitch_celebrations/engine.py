"""Pure scheduling: bounded queue, deduplication, raid priority and shuffled shows."""
from collections import deque
import random
import time
import uuid

THEMES = {
    'crab': {'title': 'Crab Carnival', 'color': '#ff876f', 'bpm': 128},
    'dragon': {'title': 'Dragon Disco', 'color': '#ba9dff', 'bpm': 132},
    'cat': {'title': 'Cosmic Cat Club', 'color': '#70e6de', 'bpm': 120},
    'frog': {'title': 'Frog Fiesta', 'color': '#c5f379', 'bpm': 140},
}
KINDS = {'raid': 8, 'follow': 2.2, 'subscribe': 3.8, 'gift': 3.8, 'cheer': 7}


def personal_details(kind, details):
    """Keep only observed, useful subscription facts; missing data stays missing."""
    if kind not in ('subscribe', 'gift') or not isinstance(details, dict):
        return {}
    result = {}
    if details.get('tier') in ('1000', '2000', '3000'):
        result['tier'] = details['tier']
    for key in ('months', 'streak'):
        value = details.get(key)
        if isinstance(value, int) and not isinstance(value, bool) and 0 < value <= 10000:
            result[key] = value
    if isinstance(details.get('message'), str):
        text = ' '.join(details['message'].split())[:120]
        if text: result['message'] = text
    if details.get('renewal') is True:
        result['renewal'] = True
    return result


class Engine:
    def __init__(self, clock=time.monotonic, rng=None):
        self.clock = clock
        self.rng = rng or random.Random()
        self.queue = []
        self.seen = {}
        self.active = None
        self.bag = deque()
        self.previous = None
        self.paused = False
        self.history = deque(maxlen=30)

    def theme(self):
        if not self.bag:
            keys = list(THEMES)
            self.rng.shuffle(keys)
            if keys[0] == self.previous:
                keys[0], keys[1] = keys[1], keys[0]
            self.bag.extend(keys)
        self.previous = self.bag.popleft()
        return self.previous

    def submit(self, kind, name, count=1, event_id=None, theme=None, details=None):
        if kind not in KINDS or (theme is not None and theme not in THEMES):
            raise ValueError('Unknown event or theme')
        count = max(1, min(1000000, int(count)))
        now = self.clock()
        self.seen = {k: t for k, t in self.seen.items() if now-t < 3600}
        if event_id and event_id in self.seen:
            return False
        if event_id:
            self.seen[event_id] = now
        if self.paused:
            return False
        # Follow bursts cannot bury a raid or produce minutes of stale alerts.
        if kind == 'follow' and any(x['kind'] == 'follow' for x in self.queue):
            return False
        priority = {'raid': 0, 'subscribe': 1, 'gift': 1, 'cheer': 2, 'follow': 3}
        if len(self.queue) >= 8:
            index = next((i for i in range(len(self.queue)-1,-1,-1)
                          if priority[self.queue[i]['kind']] > priority[kind]), None)
            if kind != 'raid' and index is None:
                return False
            self.queue.pop(-1 if index is None else index)
        item = dict(id=uuid.uuid4().hex, kind=kind, name=str(name).strip()[:48] or 'A lovely human',
                    count=count, theme=theme or self.theme(), duration=KINDS[kind], queued=now,
                    details=personal_details(kind, details))
        if kind in ('raid', 'subscribe', 'gift'):
            index = next((i for i,x in enumerate(self.queue) if priority[x['kind']] > priority[kind]), len(self.queue))
            self.queue.insert(index, item)
        else:
            self.queue.append(item)
        return True

    def snapshot(self, ready=True):
        now = self.clock()
        if self.active and now >= self.active['end']:
            from events import inspect_event
            inspect_event('celebration.playback', owner='twitch_celebrations', phase='finished', kind=self.active['kind'])
            self.active = None
        self.queue = [x for x in self.queue if now-x['queued'] < 45]
        if ready and not self.paused and not self.active and self.queue:
            self.active = self.queue.pop(0)
            self.active.update(start=now, end=now+self.active['duration'])
            from events import inspect_event
            inspect_event('celebration.playback', owner='twitch_celebrations', phase='started', kind=self.active['kind'])
            self.history.append({k:self.active[k] for k in ('kind','name','count','theme')})
        return {**self.active, 'elapsed': now-self.active['start']} if self.active else None

    def clear(self):
        self.queue.clear()
        self.active = None

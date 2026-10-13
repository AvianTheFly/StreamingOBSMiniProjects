"""Match boundaries on the artwork clock; called by the existing service worker."""
import threading
import time
from lib.league_match import MatchLifecycle


class MatchTiming:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.lock = threading.RLock()
        self.lifecycle = MatchLifecycle()
        self.running = False
        self.generation = 0
        self.end_at = None
        self.lost_at = None

    def snapshot(self):
        with self.lock:
            return {'running': self.running, 'generation': self.generation,
                    'ending': self.end_at is not None or self.lifecycle.ended}

    def observe(self, data, screen=None):
        with self.lock:
            game_time = data['gameData']['gameTime']
            new_game = self.lifecycle.game_time is None or game_time < self.lifecycle.game_time - 2
            running = self.lifecycle.observe(data)
            names = {e.get('EventName') for e in data.get('events', {}).get('Events', [])}
            # The opening image uses GameStart even at clock zero. A positive
            # pre-event clock is still loading; joining an older match recovers
            # gameplay without replaying an opening presentation.
            if (not self.running or new_game) and game_time <= 5 and 'GameStart' not in names:
                running = False
            self.lost_at = None
            if new_game:
                self.generation += 1
                self.end_at = None
                self.running = False
            if running and not self.running:
                self.running = True
                return ['game.connected']
            if self.lifecycle.ended and self.running and self.end_at is None:
                self.end_at = screen['started'] if screen and screen['key'] in {'victory', 'defeat'} else self.clock()
            return self._tick()

    def disconnected(self):
        with self.lock:
            if self.lost_at is None:
                self.lost_at = self.clock()
            return self._tick()

    def _tick(self):
        now = self.clock()
        ended = self.end_at is not None and now >= self.end_at
        lost = self.end_at is None and self.lost_at is not None and now-self.lost_at >= 3
        if self.running and (ended or lost):
            self.running = False
            return ['game.disconnected']
        return []

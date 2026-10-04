"""Interpret match boundaries independently of Live Client connection lifetime."""
import math


class MatchLifecycle:
    def __init__(self):
        self.game_time = None
        self.ended = False

    def observe(self, data):
        game_time = data.get('gameData', {}).get('gameTime')
        if (isinstance(game_time, bool) or not isinstance(game_time, (int, float))
                or not math.isfinite(game_time)):
            return False
        # A new match rewinds the clock. API reconnects must not clear an ending
        # while the result screen still serves the completed match's snapshot.
        if self.game_time is not None and game_time < self.game_time - 2:
            self.ended = False
        self.game_time = game_time
        if any(event.get('EventName') == 'GameEnd'
               for event in data.get('events', {}).get('Events', [])):
            self.ended = True
        return game_time > 0 and not self.ended

"""Pure interpretation of the Live Client match clock and lifecycle events."""
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
        if self.game_time is not None and game_time < self.game_time - 2:
            self.ended = False
        self.game_time = game_time
        names = {event.get('EventName') for event in data.get('events', {}).get('Events', [])}
        if 'GameEnd' in names:
            self.ended = True
        return (game_time > 0 or 'GameStart' in names) and not self.ended

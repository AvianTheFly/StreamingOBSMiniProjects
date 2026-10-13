"""Bounded mana evidence for hotkey intent; no transport, OBS or polling owner.

Mana is not an ability-cast feed. Spending is attributed to the latest key.
Stable observed regeneration can explain a masked spend, but discontinuities,
full mana, missing data and expired intent must never manufacture a cast.
"""
from collections import deque
import math
import time


def number(value):
    return (float(value) if isinstance(value, (int, float)) and
            not isinstance(value, bool) and math.isfinite(value) else None)


class ManaCasts:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.chat_until = 0.
        self.reset()

    def enter(self):
        """Each Enter starts a five-second fallback guard, not a chat toggle."""
        self.chat_until = self.clock() + 5.
        self.pending.clear()

    def allows_fallback(self):
        return self.clock() >= self.chat_until

    def reset(self):
        self.previous = None
        self.pending = {}
        self.rates = deque(maxlen=6)

    def press(self, key):
        now = self.clock()
        if key not in 'qwer' or len(key) != 1 or self.previous is None:
            return False
        if now - self.previous['at'] > .8:
            self.pending.clear()
            return False
        # Auto-repeat refreshes one bounded entry, never queues another cast.
        self.pending.pop(key, None)
        self.pending[key] = now
        return True

    def observe(self, data):
        now = self.clock()
        stats = data.get('activePlayer', {}).get('championStats', {})
        game = number(data.get('gameData', {}).get('gameTime'))
        mana, maximum = number(stats.get('resourceValue')), number(stats.get('resourceMax'))
        regen = number(stats.get('resourceRegenRate'))
        if (stats.get('resourceType') != 'MANA' or game is None or mana is None or
                maximum is None or maximum <= 0 or not 0 <= mana <= maximum):
            self.reset()
            return None
        current = dict(game=game, mana=mana, maximum=maximum, regen=regen, at=now)
        previous = self.previous
        if previous and game == previous['game']:
            return None  # Shared cached snapshots are not another observation.
        self.previous = current
        self.pending = {k: at for k, at in self.pending.items() if now-at <= .8}
        if (previous is None or not 0 < game-previous['game'] <= .8 or
                now-previous['at'] > .8 or maximum != previous['maximum']):
            self.pending.clear()
            self.rates.clear()
            return None
        dt = game-previous['game']
        spent = previous['mana'] - mana
        stable_regen = (regen is not None and regen > 0 and regen == previous['regen']
                        and mana < maximum-1 and previous['mana'] < maximum-1)
        if stable_regen and len(self.rates) >= 3:
            recent = list(self.rates)[-3:]
            low, high = min(recent), max(recent)
            if low > 0 and high <= low*1.2:
                # Leave 10% plus 0.5 mana of uncertainty for tick rounding.
                expected_gain = max(0, low*dt*.9 - .5)
                spent = max(spent, previous['mana'] + expected_gain - mana)
        candidates = list(self.pending)
        confirmed = candidates[-1] if spent >= 1 and candidates else None
        if spent >= 1 or len(candidates) > 1:
            self.pending.clear()
            self.rates.clear()
        elif stable_regen and mana >= previous['mana']:
            self.rates.append((mana-previous['mana'])/dt)
        else:
            self.rates.clear()
        return confirmed

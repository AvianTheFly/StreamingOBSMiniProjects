"""Choose a saved reaction variant; detection and volume stay event-owned."""
import random


class MediaPicker:
    def __init__(self):
        self.last = {}
        self.recent = []

    def choose(self, key, rule):
        primary = {k: rule.get(k, default) for k, default in
                   [('media', ''), ('duration', 6), ('start_time', 0), ('loop', False)]}
        choices = [primary]
        if rule.get('pool_enabled', True):
            choices += rule.get('media_pool', [])
        # A file gets one vote even if added twice. Empty primary is a fallback.
        unique = {item['media']: item for item in reversed(choices) if item.get('media')}
        choices = list(unique.values()) or [primary]
        fresh = [item for item in choices if item['media'] != self.last.get(key)] or choices
        fresh = [item for item in fresh if item['media'] not in self.recent] or fresh
        return dict(random.choice(fresh))

    def remember(self, key, media):
        self.last[key] = media
        self.recent = (self.recent + [media])[-3:]

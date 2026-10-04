"""Category selection and no-repeat random playback, independent of trigger/UI code."""
import random
import time

from .commands import _match_category_name


class RandomPlaylist:
    def __init__(self, name, stop_event, inventory, settings, play, *, match_category=_match_category_name):
        self.name, self.stop = name, stop_event
        self.inventory, self.settings, self.play = inventory, settings, play
        self.match_category = match_category

    def eligible(self, category_query):
        stems = sorted(self.inventory)
        settings = self.settings()
        if not category_query or settings is None:
            return stems
        category = self.match_category(category_query, list(settings.categories))
        if category is None:
            print(f'[{self.name}] Unknown category {category_query!r}')
            return []
        allowed = {stem.lower() for stem in settings.stems_in_category(category)}
        return [stem for stem in stems if stem in allowed]

    def run(self, category_query='', *, cancelled):
        stems = self.eligible(category_query)
        remaining = []
        while stems and not self.stop.is_set() and not cancelled.is_set():
            started = time.monotonic()
            if not remaining:
                remaining = random.sample(stems, len(stems))
            done = self.play(remaining.pop())
            # Completion includes coordination and source cleanup. Busy flags
            # can still be false during admission, so they cannot be the gate.
            while done is not None and not self.stop.is_set() and not cancelled.is_set():
                if done.wait(.2):
                    break
            cancelled.wait(max(0, .1 - (time.monotonic() - started)))

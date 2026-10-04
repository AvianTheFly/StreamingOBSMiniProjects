"""Manual desk selection policy over Soundboard's existing playback owner."""


class AssetControls:
    def __init__(self, inventory, stop_event, *, cancel_voice, close_window,
                 stop_random, play):
        self.inventory = inventory
        self.stop_event = stop_event
        self.cancel_voice = cancel_voice
        self.close_window = close_window
        self.stop_random = stop_random
        self.play = play

    def catalog(self):
        return [{'source': stem, 'name': path.stem}
                for stem, path in sorted(self.inventory.snapshot().items())]

    def select(self, source):
        stem = str(source or '').strip().lower()
        if self.stop_event.is_set():
            return {'ok': False, 'error': 'Soundboard is stopping.'}
        if stem not in self.inventory:
            return {'ok': False, 'error': 'This sound is no longer in the library.'}
        self.cancel_voice()
        self.close_window()
        self.stop_random()
        self.play(stem)
        return {'ok': True, 'source': stem, 'queued': True}

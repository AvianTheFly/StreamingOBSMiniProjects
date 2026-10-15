"""A native Spotify start cancels Hub music through its public source owners."""
from lib.project_runtime import project_registry


class MusicFocus:
    def __init__(self, registry=project_registry):
        self.registry = registry
        self.playing = False

    def observe(self, playing):
        started = playing and not self.playing
        self.playing = bool(playing)
        if not started:
            return
        # Revert also cancels pending songs and random mode. Do this once per
        # transport start, so a newer Hub selection can pause Spotify and play.
        # Source owners serialize cancellation with their final cleanup.
        for interface in self.registry.all():
            if interface.background_music:
                try:
                    interface.revert()
                except Exception as exc:
                    print(f'[spotify] Could not stop {interface.name}: {exc}')

    def close(self):
        self.playing = False

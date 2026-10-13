"""Public named-asset controls over a media owner's existing index and worker."""
class AssetControls:
    def __init__(self, index, playback, stop, stop_random):
        self.index, self.playback, self.stop, self.stop_random = index, playback, stop, stop_random

    def catalog(self):
        if self.stop.is_set():
            return []
        return [{'source': key, 'name': path.stem}
                for key, (path, _) in sorted(self.index.snapshot().items())]

    def play(self, source):
        if self.stop.is_set():
            return {'ok': False, 'error': 'Media feature is stopping'}
        key = str(source).strip().lower()
        if key not in self.index:
            return {'ok': False, 'error': 'Choose an available media asset'}
        self.stop_random()
        self.playback.play_asset(key)
        return {'ok': True, 'source': key}

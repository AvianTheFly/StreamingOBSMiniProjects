"""Compatibility facade over the registered song player; prefer project interfaces."""
import threading

class _MusicService:
    def __init__(self):
        self._lock = threading.Lock()
        self._player = None

    def register(self, player):
        with self._lock:
            self._player = player
        print("[music_service] SongPlayer registered.")

    def unregister(self, player):
        with self._lock:
            if self._player is player:
                self._player = None

    def _current(self):
        with self._lock:
            return self._player

    @property
    def is_playing(self):
        player = self._current()
        return player is not None and player.is_busy

    def pause(self):
        player = self._current()
        if player and player.is_busy:
            player.pause()

    def resume(self):
        player = self._current()
        if player:
            player.resume()

    def stop(self):
        player = self._current()
        if player and player.is_busy:
            player.abort()

music_service = _MusicService()

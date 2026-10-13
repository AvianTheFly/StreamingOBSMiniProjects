"""Shared contract for post-game scene holds and lobby automation policy.

League publishes its policy through callbacks. Scene command features query the
contract without importing League's service, interface, or mutable live state.
"""
import threading


class GameScenePolicy:
    def __init__(self):
        self._lock = threading.Lock()
        self._providers = {}

    def register(self, owner, *, automatic_lobbies, hold, game_started=None, match_state=None):
        with self._lock:
            self._providers[owner] = (automatic_lobbies, hold, game_started, match_state)

    def unregister(self, owner):
        with self._lock:
            self._providers.pop(owner, None)

    def _snapshot(self):
        with self._lock:
            return list(self._providers.values())

    def automatic_lobbies(self):
        return any(enabled() for enabled, _, _, _ in self._snapshot())

    def hold(self, **context):
        return max((hold(**context) for _, hold, _, _ in self._snapshot()), default=0)

    def game_started(self):
        """Withdraw loading intent before the existing game router admits gameplay."""
        for _, _, notify, _ in self._snapshot():
            if notify is not None:
                notify()

    def match_state(self):
        """Return the image owner's complete boundary state, or None standalone."""
        for _, _, _, snapshot in reversed(self._snapshot()):
            if snapshot is not None:
                return snapshot()
        return None


game_scene_policy = GameScenePolicy()

"""Shared contract for post-game scene holds and lobby automation policy.

League publishes its policy through callbacks. Scene command features query the
contract without importing League's service, interface, or mutable live state.
"""
import threading


class GameScenePolicy:
    def __init__(self):
        self._lock = threading.Lock()
        self._providers = {}

    def register(self, owner, *, automatic_lobbies, hold):
        with self._lock:
            self._providers[owner] = (automatic_lobbies, hold)

    def unregister(self, owner):
        with self._lock:
            self._providers.pop(owner, None)

    def _snapshot(self):
        with self._lock:
            return list(self._providers.values())

    def automatic_lobbies(self):
        return any(enabled() for enabled, _ in self._snapshot())

    def hold(self, **context):
        return max((hold(**context) for _, hold in self._snapshot()), default=0)


game_scene_policy = GameScenePolicy()

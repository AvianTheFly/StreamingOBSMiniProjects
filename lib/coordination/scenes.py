"""The single owner of OBS program-scene writes and temporary scene leases.

Features choose a destination. This director serializes validation, optional
scene preparation, and switching. Automatic requests wait while a temporary
lease is reserved (including media loading); deliberate requests revoke it.
"""
from collections import deque
from dataclasses import dataclass
import threading
import time


class SceneBusy(RuntimeError):
    pass


@dataclass(eq=False)
class SceneLease:
    owner: str
    scene: str
    previous: str
    fallback: str
    activated: bool = False
    revoked: bool = False
    finished: bool = False
    transition: tuple[str, int] | None = None


def _obs_client():
    from obs.client import get_obs
    return get_obs()


class SceneDirector:
    def __init__(self, client_factory=_obs_client):
        self._client_factory = client_factory
        self._lock = threading.RLock()
        self._lease = None
        self._revision = 0
        self._manual_revision = 0
        self._last_scene = None
        self._history = deque(maxlen=80)
        self._observing = False
        self._own_events = deque()
        self._pending = None

    def _record(self, owner, scene, result, reason):
        decision = dict(time=time.time(), revision=self._revision,
                        owner=owner, scene=scene, result=result, reason=reason)
        self._history.append(decision)
        from events import inspect_event
        inspect_event('scene.decision', owner=owner, scene=scene, phase=result, reason=reason)

    def _revoke(self):
        if self._lease is not None:
            self._lease.revoked = True
            self._lease = None

    def _current(self, client):
        current = client.get_current_program_scene().current_program_scene_name
        if self._last_scene is not None and current != self._last_scene:
            self._revision += 1
            self._manual_revision += 1
            self._pending = None
            self._revoke()
            self._record('OBS', current, 'external', 'Observed outside the Hub')
        self._last_scene = current
        return current

    def _write(self, client, scene, transition=None):
        if self._observing:
            self._own_events.append(scene)
        try:
            if transition is None:
                client.set_current_program_scene(scene)
            else:
                previous = client.get_scene_scene_transition_override(scene)
                name = previous.transition_name or None
                duration = previous.transition_duration if name else None
                client.set_scene_scene_transition_override(scene, *transition)
                try:
                    client.set_current_program_scene(scene)
                finally:
                    # OBS retains the transition instance for the running switch.
                    # Restore only this destination's override, never the global selector.
                    client.set_scene_scene_transition_override(scene, name, duration)
        except BaseException:
            if self._observing:
                self._own_events.pop()
            raise
        self._last_scene = scene
        self._revision += 1

    def request(self, scene, *, owner, reason='', automatic=True,
                expected_revision=None, expected_manual_revision=None,
                prepare=None, client=None, defer=False):
        """Return False for deferred/stale intent. Preparation has no side effects
        when the request is rejected. Never pass project callbacks as prepare.
        """
        if not isinstance(scene, str) or not scene.strip():
            raise ValueError('Expected a scene name')
        with self._lock:
            client = client if client is not None else self._client_factory()
            current = self._current(client)
            # A delayed workflow may survive temporary playback and its return,
            # but never a newer deliberate choice or outside OBS scene switch.
            if (expected_manual_revision is not None and
                    self._manual_revision != expected_manual_revision):
                self._record(owner, scene, 'stale', reason)
                return False
            if expected_revision is not None and self._revision != expected_revision:
                self._record(owner, scene, 'stale', reason)
                return False
            if automatic and self._lease is not None:
                if defer:
                    self._pending = (scene, owner, reason, prepare, self._manual_revision)
                self._record(owner, scene, 'deferred', f'{self._lease.owner} owns a temporary scene')
                return False
            if prepare is not None:
                prepare(client)
            from .lobbies import resolve_presented_scene
            scene = resolve_presented_scene(client, scene, prepare_default=prepare is None)
            if current != scene:
                self._write(client, scene)
            elif not automatic:
                self._revision += 1  # Same scene can be a newer deliberate choice.
            if not automatic:
                self._manual_revision += 1
                self._revoke()
                self._pending = None
            self._record(owner, scene, 'applied', reason)
            return True

    def reserve(self, owner, scene, fallback, *, transition=None):
        with self._lock:
            previous = self._current(self._client_factory())
            if self._lease is not None:
                raise SceneBusy(f'{self._lease.owner} already owns the program scene')
            lease = self._lease = SceneLease(owner, scene, previous, fallback, transition=transition)
            self._record(owner, scene, 'reserved', 'Temporary scene loading')
            return lease

    def cancel_pending(self, owner):
        """Withdraw only this owner's deferred intent on replacement/shutdown."""
        with self._lock:
            if self._pending is None or self._pending[1] != owner:
                return False
            scene, _, _, _, _ = self._pending
            self._pending = None
            self._record(owner, scene, 'cancelled', 'Owner withdrew deferred intent')
            return True

    def activate(self, lease):
        with self._lock:
            client = self._client_factory()
            self._current(client)
            if self._lease is not lease or lease.finished or lease.revoked:
                return False
            if not lease.activated:
                if self._last_scene != lease.scene:
                    self._write(client, lease.scene, lease.transition)
                lease.activated = True
                self._record(lease.owner, lease.scene, 'activated', 'Temporary scene ready')
            return True

    def present(self, lease, scene):
        """Advance an activated temporary presentation without losing its return target."""
        with self._lock:
            client = self._client_factory()
            self._current(client)
            if (self._lease is not lease or not lease.activated
                    or lease.finished or lease.revoked):
                return False
            if scene != self._last_scene:
                self._write(client, scene, lease.transition)
            lease.scene = scene
            self._record(lease.owner, scene, 'presented', 'Temporary presentation advanced')
            return True

    def owns(self, lease):
        with self._lock:
            self._current(self._client_factory())
            return self._lease is lease and lease.activated and not lease.finished and not lease.revoked

    def finish(self, lease):
        """Return whether this lease still owned the handoff; finish is idempotent."""
        with self._lock:
            if lease.finished:
                return False
            client = self._client_factory()
            self._current(client)
            owned = self._lease is lease and not lease.revoked
            try:
                if owned and lease.activated:
                    target = lease.previous if lease.previous != lease.scene else lease.fallback
                    if target and target != self._last_scene:
                        self._write(client, target, lease.transition)
                return owned
            finally:
                lease.finished = True
                if self._lease is lease:
                    self._lease = None
                self._record(lease.owner, lease.scene, 'released', 'Temporary scene finished')
                pending, self._pending = self._pending, None
                if owned and pending:
                    scene, owner, reason, prepare, manual_revision = pending
                    self.request(scene, owner=owner, reason=reason, prepare=prepare,
                                 expected_manual_revision=manual_revision)

    def observing(self, enabled, *, disconnected=True):
        with self._lock:
            self._observing = enabled
            self._own_events.clear()
            if not enabled and disconnected:
                # A lost event stream cannot prove a lease survived an external
                # away-and-back switch; fail closed until the next request.
                self._revoke()
                self._revision += 1
                self._manual_revision += 1
                self._pending = None

    def refresh_observation(self):
        """Seed/read the program scene through the existing shared connection.

        The event subscription calls this once on connection, so public status
        does not wait for a scene change. This performs no OBS write or prepare.
        """
        with self._lock:
            initial = self._last_scene is None
            current = self._current(self._client_factory())
            if initial: self._record('OBS', current, 'observed', 'Initial program scene')
            return current

    def observe(self, scene):
        """OBS events detect outside switches, even an away-and-back change."""
        with self._lock:
            if self._own_events and self._own_events[0] == scene:
                self._own_events.popleft()
                return
            self._revision += 1
            self._manual_revision += 1
            self._pending = None
            self._revoke()
            self._last_scene = scene
            self._record('OBS', scene, 'external', 'OBS program-scene event')
            # Native OBS scene choices reuse the published layer contract, without
            # making another program-scene write or changing a desktop privacy gate.
            try:
                from .lobbies import prepare_presented_lobby
                prepare_presented_lobby(self._client_factory(), scene)
            except Exception as exc:
                self._record('OBS', scene, 'layout-error', str(exc))

    def snapshot(self):
        with self._lock:
            lease = self._lease
            return {'revision': self._revision, 'manual_revision': self._manual_revision,
                    'scene': self._last_scene,
                    'temporary_owner': lease.owner if lease else None,
                    'reserved_scene': lease.scene if lease else None,
                    'pending_scene': self._pending[0] if self._pending else None,
                    'observing': self._observing, 'history': list(self._history)}


scene_director = SceneDirector()

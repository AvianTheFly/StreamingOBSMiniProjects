"""Combine temporary scene ownership with a scoped cross-project pause claim."""
import threading
import time

from .scenes import scene_director


class SceneSession:
    def __init__(self, requester, scene, fallback, *, director=scene_director, coordinator=None,
                 transition=None):
        if coordinator is None:
            from .playback import coordinator
        self._director = director
        self._coordinator = coordinator
        self._lock = threading.Lock()
        self._lease = director.reserve(requester, scene, fallback, transition=transition)
        self.scene, self.previous, self.fallback = scene, self._lease.previous, fallback
        self.finished = False
        self._transition = transition
        self._entry_deadline = 0.0
        try:
            self._claim = coordinator.pause_projects(requester)
        except BaseException:
            director.finish(self._lease)
            raise

    @property
    def activated(self):
        return self._lease.activated

    def owns_scene(self):
        return not self.finished and self._director.owns(self._lease)

    def activate(self):
        with self._lock:
            was_active = self.activated
            accepted = not self.finished and self._director.activate(self._lease)
            if accepted and not was_active:
                self._entry_deadline = time.monotonic() + self.transition_seconds
            return accepted

    @property
    def transition_seconds(self):
        return max(0, float(self._transition[1]) / 1000) if self._transition else 0

    def entry_transition_remaining(self):
        """OBS's global cursor can omit a destination-scoped transition."""
        return max(0, self._entry_deadline - time.monotonic())

    def present(self, scene):
        """Change this session's scene only while it still owns the presentation."""
        with self._lock:
            if self.finished or not self._director.present(self._lease, scene):
                return False
            self.scene = scene
            return True

    def finish(self, *, wait_for_transition=False):
        with self._lock:
            if self.finished:
                return
            self.finished = True
            owned = False
            try:
                revision = self._director.snapshot()['manual_revision'] if wait_for_transition else None
                owned = self._director.finish(self._lease)
                if owned and wait_for_transition:
                    # Keep the claim until the scoped return has finished. No
                    # director lock or program-scene write is held during this wait.
                    owned = self._wait_for_return_transition(revision)
            finally:
                self._coordinator.release_pauses(self._claim, resume=owned, wait=True)

    def _wait_for_return_transition(self, revision):
        minimum = time.monotonic() + self.transition_seconds
        limit = time.monotonic() + max(12, self.transition_seconds)
        import obs
        try:
            client = obs.get_obs()
        except Exception:
            return False
        while time.monotonic() < limit:
            try:
                if self._director.snapshot()['manual_revision'] != revision:
                    return False
                cursor = client.get_current_scene_transition_cursor().transition_cursor
            except Exception:
                return False
            if time.monotonic() >= minimum and (cursor <= 0 or cursor >= 1):
                return True
            time.sleep(.05)
        return False

"""Streamer intent for breaks/wrap-up; SceneDirector owns the routing gate."""
import threading
from lib.coordination.scenes import scene_director


class SessionControls:
    def __init__(self, director=scene_director):
        self.director = director
        self.lock = threading.RLock()
        self.token = None
        self.stage = None
        self.lobby = None
        self.scoped_revision = None

    def snapshot(self):
        with self.lock:
            return {'held': self.token is not None, 'stage': self.stage, 'lobby': self.lobby}

    def hold(self):
        with self.lock:
            if self.token is None:
                self.token = self.director.hold_automatic('scene_voice_switcher')
            # An explicit Hold view lasts until Follow, even across scene choices.
            self.scoped_revision = None
            return self.snapshot()

    def follow(self, *, resume=True):
        with self.lock:
            token, self.token = self.token, None
            self.stage = self.lobby = None
            self.scoped_revision = None
            if token is not None:
                self.director.release_automatic(token, resume=resume)
            return self.snapshot()

    def reconcile(self):
        """A later deliberate scene choice ends a Break/Ending presentation hold.

        Temporary presentations retain the manual revision, so replay entry and
        return cannot revoke this scope. Releasing discards obsolete deferred work.
        """
        state = self.director.snapshot()
        with self.lock:
            if (self.token is not None and self.scoped_revision is not None
                    and state['manual_revision'] != self.scoped_revision):
                self.follow(resume=False)
            return self.snapshot()

    def present(self, stage, select):
        if stage not in {'lobby', 'break', 'ending', 'game', 'loading'}:
            raise ValueError('Choose a supported stream stage')
        with self.lock:
            prior = self.token
            if stage in {'break', 'ending'}:
                if self.token is None:
                    self.token = self.director.hold_automatic('scene_voice_switcher')
            try:
                result = select()
                if stage not in {'break', 'ending'}:
                    self.follow(resume=False)
                self.stage, self.lobby = stage, result.get('lobby')
                if stage in {'break', 'ending'}:
                    self.scoped_revision = self.director.snapshot()['manual_revision']
                return {**result, 'session': self.snapshot()}
            except BaseException:
                if prior is None and self.token is not None:
                    self.follow(resume=False)
                raise

    def close(self):
        self.follow(resume=False)

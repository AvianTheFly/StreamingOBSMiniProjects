"""Keep result artwork opaque until the owned OBS scene transition completes."""
import time
from lib.coordination.scenes import scene_director


class MatchHandoff:
    def __init__(self, screens, director=scene_director, clock=time.monotonic, obs_factory=None):
        self.screens, self.director, self.clock = screens, director, clock
        self.obs_factory = obs_factory
        self.origin = None
        self.screen_id = None
        self.switched_at = None

    def reset(self):
        if self.screen_id is not None:
            self.screens.release_result(self.screen_id)
        self.origin = self.screen_id = self.switched_at = None

    def begin(self):
        state = self.director.snapshot()
        self.origin = state['scene'], state['manual_revision']
        self.screen_id = self.screens.protect_result()
        self.switched_at = None

    def tick(self):
        if self.screen_id is None:
            return
        state = self.director.snapshot()
        scene, revision = self.origin
        if state['manual_revision'] != revision:
            self.screens.release_result(self.screen_id)
            self.screen_id = None
            return
        if self.screens.scene_hold() > 0 or state['temporary_owner'] is not None:
            return
        if state['scene'] == scene:
            return
        if self.switched_at is None:
            self.switched_at = self.clock()
            return
        try:
            if self.obs_factory is None:
                from obs import get_obs
                client = get_obs()
            else:
                client = self.obs_factory()
            cursor = client.send('GetCurrentSceneTransitionCursor', {}, raw=True)['transitionCursor']
            if cursor < 1:
                return
        except Exception:
            return  # The artwork retains a finite safety deadline on failure.
        self.screens.release_result(self.screen_id)
        self.screen_id = None

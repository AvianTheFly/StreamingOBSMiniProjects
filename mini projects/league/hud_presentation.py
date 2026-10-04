"""Own visibility of the existing nested map/HUD and Udyr scene items."""
import obs

from .config import UDYR_ANIMATION_SCENE, UDYR_ANIMATION_SOURCE


HUD_ITEMS = (
    ('Test', 'ScreenCaptureMAPHUD'),
    (UDYR_ANIMATION_SCENE, UDYR_ANIMATION_SOURCE),
)


class HudPresentation:
    def __init__(self):
        self.applied = {}

    def update(self, running=False, alive=False):
        for (scene, source), visible in zip(HUD_ITEMS, (running, running and alive)):
            if self.applied.get((scene, source)) is visible:
                continue
            try:
                client = obs.get_obs()
                item = client.get_scene_item_id(scene, source).scene_item_id
                # Read on each policy transition so a Hub restart corrects saved
                # loading-screen visibility without touching personal transforms.
                if client.get_scene_item_enabled(scene, item).scene_item_enabled != visible:
                    client.set_scene_item_enabled(scene, item, visible)
                self.applied[(scene, source)] = visible
            except Exception as exc:
                print(f'[league] HUD visibility unavailable ({source}): {exc}')

    def hide(self):
        self.update()

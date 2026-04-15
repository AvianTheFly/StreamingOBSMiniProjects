# league/handlers/hide_all_borders_handler.py
# NOTE: GOLD5K_* config values are not currently defined in config.py.
# This handler is unused — add those values to config.py before registering it.

import obs
from ..config import (
    DEATH_SCENE, DEATH_SOURCE,
    RESPAWN_SCENE, RESPAWN_SOURCE,
    GOLD5K_SCENE, GOLD5K_SOURCE,
)


def make_hide_all_borders_handler():
    def handle_game_end(*args, **kwargs):
        print("[league] Game ended — hiding all League borders.")
        for scene, source in (
            (DEATH_SCENE,   DEATH_SOURCE),
            (RESPAWN_SCENE, RESPAWN_SOURCE),
            (GOLD5K_SCENE,  GOLD5K_SOURCE),
        ):
            try:
                obs.hide_source(scene, source)
            except Exception as e:
                print(f"[league] Failed to hide {source}: {e}")

    return handle_game_end

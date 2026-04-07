import obs
from .config import (
    DEATH_SCENE, DEATH_SOURCE,
    RESPAWN_SCENE, RESPAWN_SOURCE,
    GOLD5K_SCENE, GOLD5K_SOURCE,
)


def make_hide_all_borders_handler():
    def handle_game_end(*args, **kwargs):
        print("[league] Game ended — hiding all League borders.")
        try:
            obs.hide_source(DEATH_SCENE, DEATH_SOURCE)
        except Exception as e:
            print(f"[league] Failed to hide death border: {e}")

        try:
            obs.hide_source(RESPAWN_SCENE, RESPAWN_SOURCE)
        except Exception as e:
            print(f"[league] Failed to hide respawn border: {e}")

        try:
            obs.hide_source(GOLD5K_SCENE, GOLD5K_SOURCE)
        except Exception as e:
            print(f"[league] Failed to hide gold5k border: {e}")

    return handle_game_end
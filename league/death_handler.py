# league/death_handler.py

import obs
from .config import DEATH_SCENE, DEATH_SOURCE


def make_death_handler():
    def handle_death(player_data):
        print("[league] Player died — showing death border.")
        try:
            obs.show_source(DEATH_SCENE, DEATH_SOURCE)
        except Exception as e:
            print(f"[league] Death handler error: {e}")

    return handle_death

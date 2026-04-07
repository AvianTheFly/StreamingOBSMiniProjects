# league/game_end_handler.py

import obs
from .config import DEATH_SCENE, DEATH_SOURCE, RESPAWN_SCENE, RESPAWN_SOURCE
from .config import (
    CHAMPION_KILL_BORDER_SCENE, CHAMPION_KILL_BORDER_SOURCE,
)


import obs


def make_game_end_handler():
    def handle_game_end():
        print("[league] Game ended — hiding all borders, switching to 'Lobbies'.")
        try:
            obs.switch_scene("Lobbies")
            print("[league] Switched to 'Lobbies'.")
        except Exception as e:
            print(f"[league] Scene switch on game end failed: {e}")
        for source in (
            DEATH_SOURCE,
            RESPAWN_SOURCE,
            CHAMPION_KILL_BORDER_SOURCE,
        ):
            try:
                print(f"[league] Hiding {source}")
                obs.hide_source(DEATH_SCENE, source)
            except Exception as e:
                print(f"[league] Failed to hide {source}: {e}")

    return handle_game_end

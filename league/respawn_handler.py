# league/respawn_handler.py
# Triggered by death → alive transition (natural respawn after death timer).

import threading

import obs
from .config import (
    DEATH_SCENE, DEATH_SOURCE,
    RESPAWN_SCENE, RESPAWN_SOURCE, RESPAWN_DISPLAY_DURATION,
)


def make_respawn_handler():
    def handle_respawn(player_data):
        print("[league] Player respawned — hiding death border, showing respawn border.")
        try:
            obs.hide_source(DEATH_SCENE, DEATH_SOURCE)
        except Exception as e:
            print(f"[league] Respawn handler error (hide death border): {e}")

        try:
            threading.Thread(
                target=obs.toggle_source,
                args=(RESPAWN_SCENE, RESPAWN_SOURCE, RESPAWN_DISPLAY_DURATION),
                daemon=True,
            ).start()
        except Exception as e:
            print(f"[league] Respawn handler error (show respawn border): {e}")

    return handle_respawn

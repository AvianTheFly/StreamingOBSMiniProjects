# league/recall_complete_handler.py
# Triggered when a recall completes (B press → mana spike detected).
# Unlike the death-respawn flow, the player is alive so we only show the
# RespawnBorder — the DeathBorder is untouched.

import threading

import obs
from .config import RESPAWN_SCENE, RESPAWN_SOURCE, RESPAWN_DISPLAY_DURATION


def make_recall_complete_handler():
    def handle_recall_complete():
        print("[league] Recall complete — showing respawn border.")
        try:
            threading.Thread(
                target=obs.toggle_source,
                args=(RESPAWN_SCENE, RESPAWN_SOURCE, RESPAWN_DISPLAY_DURATION),
                daemon=True,
            ).start()
        except Exception as e:
            print(f"[league] Recall complete handler error: {e}")

    return handle_recall_complete

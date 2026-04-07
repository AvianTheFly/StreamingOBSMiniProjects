# league/gold_handler.py

import threading

import obs
from .config import GOLD5K_SCENE, GOLD5K_SOURCE, GOLD5K_DISPLAY_DURATION


def make_gold_handler():
    def handle_gold_above_threshold(current_gold):
        print(f"[league] Gold > 5k detected ({current_gold}) — showing gold border.")
        try:
            if GOLD5K_DISPLAY_DURATION > 0:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(GOLD5K_SCENE, GOLD5K_SOURCE, GOLD5K_DISPLAY_DURATION),
                    daemon=True,
                ).start()
            else:
                obs.show_source(GOLD5K_SCENE, GOLD5K_SOURCE)
        except Exception as e:
            print(f"[league] Gold handler error: {e}")

    return handle_gold_above_threshold
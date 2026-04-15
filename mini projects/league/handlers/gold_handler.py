# league/handlers/gold_handler.py
# NOTE: GOLD5K_* config values are not currently defined in config.py.
# This handler is unused — add those values to config.py before registering it.

from ..config import GOLD5K_SCENE, GOLD5K_SOURCE, GOLD5K_DISPLAY_DURATION
from ..utils import show_overlay


def make_gold_handler():
    def handle_gold_above_threshold(current_gold):
        print(f"[league] Gold > 5k detected ({current_gold}) — showing gold border.")
        try:
            show_overlay(GOLD5K_SCENE, GOLD5K_SOURCE, GOLD5K_DISPLAY_DURATION or None)
        except Exception as e:
            print(f"[league] Gold handler error: {e}")

    return handle_gold_above_threshold

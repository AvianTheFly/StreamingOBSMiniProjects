# league/first_brick_handler.py
# Triggered once when the first tower in the game is destroyed.
#
# event fields: { EventName, EventTime, KillerName, Assisters[] }

import threading
import obs
from .config import (
    FIRST_BRICK_SCENE, FIRST_BRICK_SOURCE,
    FIRST_BRICK_DURATION, FIRST_BRICK_ENABLED,
)


def make_first_brick_handler():
    def handle_first_brick(event: dict):
        if not FIRST_BRICK_ENABLED:
            return
        killer = event.get("KillerName", "unknown")
        print(f"[league] First Brick! Destroyed by {killer}.")
        try:
            if FIRST_BRICK_DURATION is None:
                obs.show_source(FIRST_BRICK_SCENE, FIRST_BRICK_SOURCE)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(FIRST_BRICK_SCENE, FIRST_BRICK_SOURCE, FIRST_BRICK_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] First brick handler error: {e}")

    return handle_first_brick

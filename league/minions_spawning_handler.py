# league/minions_spawning_handler.py
# Triggered once when minions first spawn (~1:05 into the game).

import threading
import obs
from .config import (
    MINIONS_SPAWNING_SCENE, MINIONS_SPAWNING_SOURCE,
    MINIONS_SPAWNING_DURATION, MINIONS_SPAWNING_ENABLED,
)


def make_minions_spawning_handler():
    def handle_minions_spawning():
        if not MINIONS_SPAWNING_ENABLED:
            return
        print("[league] Minions spawning.")
        try:
            if MINIONS_SPAWNING_DURATION is None:
                obs.show_source(MINIONS_SPAWNING_SCENE, MINIONS_SPAWNING_SOURCE)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(MINIONS_SPAWNING_SCENE, MINIONS_SPAWNING_SOURCE, MINIONS_SPAWNING_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Minions spawning handler error: {e}")

    return handle_minions_spawning

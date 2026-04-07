# league/herald_kill_handler.py
# Triggered when the Rift Herald is slain.
#
# event fields: { EventName, EventTime, Stolen, KillerName, Assisters[] }

import threading
import obs
from .config import (
    HERALD_KILL_SCENE, HERALD_KILL_SOURCE,
    HERALD_KILL_DURATION, HERALD_KILL_ENABLED,
)


def make_herald_kill_handler():
    def handle_herald_kill(event: dict):
        if not HERALD_KILL_ENABLED:
            return
        stolen = event.get("Stolen", "False") == "True"
        killer = event.get("KillerName", "unknown")
        print(f"[league] Herald slain by {killer} (stolen={stolen}).")
        try:
            if HERALD_KILL_DURATION is None:
                obs.show_source(HERALD_KILL_SCENE, HERALD_KILL_SOURCE)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(HERALD_KILL_SCENE, HERALD_KILL_SOURCE, HERALD_KILL_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Herald kill handler error: {e}")

    return handle_herald_kill

# league/baron_kill_handler.py
# Triggered when Baron Nashor is slain.
#
# event fields: { EventName, EventTime, Stolen, KillerName, Assisters[] }

import threading
import obs
from .config import (
    BARON_KILL_SCENE, BARON_KILL_SOURCE,
    BARON_KILL_DURATION, BARON_KILL_ENABLED,
)


def make_baron_kill_handler():
    def handle_baron_kill(event: dict):
        if not BARON_KILL_ENABLED:
            return
        stolen = event.get("Stolen", "False") == "True"
        killer = event.get("KillerName", "unknown")
        print(f"[league] Baron slain by {killer} (stolen={stolen}).")
        try:
            if BARON_KILL_DURATION is None:
                obs.show_source(BARON_KILL_SCENE, BARON_KILL_SOURCE)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(BARON_KILL_SCENE, BARON_KILL_SOURCE, BARON_KILL_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Baron kill handler error: {e}")

    return handle_baron_kill

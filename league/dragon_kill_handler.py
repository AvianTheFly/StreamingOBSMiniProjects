# league/dragon_kill_handler.py
# Triggered every time a dragon is slain.
#
# event fields: { EventName, EventTime, DragonType, Stolen, KillerName, Assisters[] }
#
# DragonType values: "Fire", "Earth", "Water", "Air", "Hextech", "Chemtech", "Elder"
# Stolen: "True" | "False"  (string, not bool)
#
# Elder Dragon gets its own OBS source if ELDER_DRAGON_SOURCE is set in config,
# otherwise it falls back to the standard dragon source.

import threading
import obs
from .config import (
    DRAGON_KILL_SCENE, DRAGON_KILL_SOURCE,
    DRAGON_KILL_DURATION, DRAGON_KILL_ENABLED,
    ELDER_DRAGON_SOURCE, ELDER_DRAGON_DURATION,
)


def make_dragon_kill_handler():
    def handle_dragon_kill(event: dict):
        if not DRAGON_KILL_ENABLED:
            return

        dragon_type = event.get("DragonType", "unknown")
        stolen      = event.get("Stolen", "False") == "True"
        killer      = event.get("KillerName", "unknown")
        print(f"[league] Dragon slain: {dragon_type} by {killer} (stolen={stolen}).")

        # Choose the right source and duration
        is_elder = dragon_type == "Elder"
        if is_elder and ELDER_DRAGON_SOURCE is not None:
            source   = ELDER_DRAGON_SOURCE
            duration = ELDER_DRAGON_DURATION
        else:
            source   = DRAGON_KILL_SOURCE
            duration = DRAGON_KILL_DURATION

        try:
            if duration is None:
                obs.show_source(DRAGON_KILL_SCENE, source)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(DRAGON_KILL_SCENE, source, duration),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Dragon kill handler error: {e}")

    return handle_dragon_kill

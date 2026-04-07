# league/inhib_killed_handler.py
# Triggered every time an inhibitor is destroyed.
#
# event fields: { EventName, EventTime, InhibKilled, KillerName, Assisters[] }
#
# InhibKilled format examples:
#   "Barracks_T1_C1"  — center inhib (T1 = enemy if you're ORDER)
#   "Barracks_T2_R1"  — right inhib (T2 = your team if you're ORDER)

import threading
import obs
from .config import (
    INHIB_KILLED_SCENE, INHIB_KILLED_SOURCE,
    INHIB_KILLED_DURATION, INHIB_KILLED_ENABLED,
)


def make_inhib_killed_handler():
    def handle_inhib_killed(event: dict):
        if not INHIB_KILLED_ENABLED:
            return
        inhib  = event.get("InhibKilled", "unknown")
        killer = event.get("KillerName", "unknown")
        print(f"[league] Inhibitor destroyed: {inhib} by {killer}.")
        try:
            if INHIB_KILLED_DURATION is None:
                obs.show_source(INHIB_KILLED_SCENE, INHIB_KILLED_SOURCE)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(INHIB_KILLED_SCENE, INHIB_KILLED_SOURCE, INHIB_KILLED_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Inhib killed handler error: {e}")

    return handle_inhib_killed

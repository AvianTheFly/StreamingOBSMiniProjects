# league/turret_killed_handler.py
# Triggered every time a turret is destroyed anywhere on the map.
#
# event fields: { EventName, EventTime, TurretKilled, KillerName, Assisters[] }
#
# TurretKilled format examples:
#   "Turret_T1_C_05_A"  — Nexus turret (T1 = enemy team if you're ORDER)
#   "Turret_T2_L_03_A"  — Outer turret, left lane (T2 = your team if you're ORDER)
#
# If you only want to react to turrets your team kills, compare KillerName or
# parse the TurretKilled string yourself inside the handler body.

import threading
import obs
from .config import (
    TURRET_KILLED_SCENE, TURRET_KILLED_SOURCE,
    TURRET_KILLED_DURATION, TURRET_KILLED_ENABLED,
)


def make_turret_killed_handler():
    def handle_turret_killed(event: dict):
        if not TURRET_KILLED_ENABLED:
            return
        turret = event.get("TurretKilled", "unknown")
        killer = event.get("KillerName", "unknown")
        print(f"[league] Turret destroyed: {turret} by {killer}.")
        try:
            if TURRET_KILLED_DURATION is None:
                obs.show_source(TURRET_KILLED_SCENE, TURRET_KILLED_SOURCE)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(TURRET_KILLED_SCENE, TURRET_KILLED_SOURCE, TURRET_KILLED_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Turret killed handler error: {e}")

    return handle_turret_killed

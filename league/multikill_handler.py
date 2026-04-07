# league/multikill_handler.py
# Triggered when the local player gets a multikill (Double through Penta).
# (Filtering by KillerName == active player is done in game_state_detector.)
#
# event fields: { EventName, EventTime, KillerName, KillStreak }
#
# KillStreak values: 2 = Double, 3 = Triple, 4 = Quadra, 5 = Penta
# Each tier fires its own separate event, so a Penta Kill emits four events:
# streak 2, 3, 4, and 5 in quick succession.
#
# MULTIKILL_SOURCES in config.py maps streak number → OBS source name.
# Set any tier's source to None to skip that specific tier.

import threading
import obs
from .config import (
    MULTIKILL_SCENE, MULTIKILL_DURATION,
    MULTIKILL_ENABLED, MULTIKILL_SOURCES,
)

_STREAK_LABELS = {2: "Double Kill", 3: "Triple Kill", 4: "Quadra Kill", 5: "Penta Kill"}


def make_multikill_handler():
    def handle_multikill(event: dict):
        if not MULTIKILL_ENABLED:
            return

        streak = event.get("KillStreak", 0)
        label  = _STREAK_LABELS.get(streak, f"x{streak} Kill")
        source = MULTIKILL_SOURCES.get(streak)

        print(f"[league] {label}!")

        if source is None:
            return  # this tier intentionally has no OBS source

        try:
            if MULTIKILL_DURATION is None:
                obs.show_source(MULTIKILL_SCENE, source)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(MULTIKILL_SCENE, source, MULTIKILL_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Multikill handler error ({label}): {e}")

    return handle_multikill

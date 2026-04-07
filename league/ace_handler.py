# league/ace_handler.py
# Triggered when one team wipes all five members of the opposing team.
#
# event fields: { EventName, EventTime, Acer, AcingTeam }
#
# AcingTeam: "ORDER" | "CHAOS"
# Acer: summoner name of the player who secured the final kill.

import threading
import obs
from .config import (
    ACE_SCENE, ACE_SOURCE,
    ACE_DURATION, ACE_ENABLED,
)


def make_ace_handler():
    def handle_ace(event: dict):
        if not ACE_ENABLED:
            return
        acer       = event.get("Acer", "unknown")
        acing_team = event.get("AcingTeam", "unknown")
        print(f"[league] ACE! {acing_team} aced by {acer}.")
        try:
            if ACE_DURATION is None:
                obs.show_source(ACE_SCENE, ACE_SOURCE)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(ACE_SCENE, ACE_SOURCE, ACE_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Ace handler error: {e}")

    return handle_ace

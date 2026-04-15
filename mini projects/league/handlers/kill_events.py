# league/handlers/kill_events.py
# Handlers for kill-related overlay events: multikill tiers and ace.

from ..config import (
    MULTIKILL_SCENE, MULTIKILL_DURATION, MULTIKILL_ENABLED, MULTIKILL_SOURCES,
    ACE_SCENE, ACE_SOURCE, ACE_DURATION, ACE_ENABLED,
)
from ..utils import show_overlay

_STREAK_LABELS = {2: "Double Kill", 3: "Triple Kill", 4: "Quadra Kill", 5: "Penta Kill"}


def make_multikill_handler():
    def handle(event: dict):
        if not MULTIKILL_ENABLED:
            return
        streak = event.get("KillStreak", 0)
        label  = _STREAK_LABELS.get(streak, f"x{streak} Kill")
        source = MULTIKILL_SOURCES.get(streak)
        print(f"[league] {label}!")
        if source is None:
            return
        try:
            show_overlay(MULTIKILL_SCENE, source, MULTIKILL_DURATION)
        except Exception as e:
            print(f"[league] Multikill handler error ({label}): {e}")
    return handle


def make_ace_handler():
    def handle(event: dict):
        if not ACE_ENABLED:
            return
        print(f"[league] ACE! {event.get('AcingTeam', 'unknown')} aced by {event.get('Acer', 'unknown')}.")
        try:
            show_overlay(ACE_SCENE, ACE_SOURCE, ACE_DURATION)
        except Exception as e:
            print(f"[league] Ace handler error: {e}")
    return handle

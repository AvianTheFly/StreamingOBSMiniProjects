# league/handlers/map_events.py
# Handlers for map-level events from the League event feed.
# All follow the same pattern: check enabled, log what happened, show overlay.
# Simple ones use make_overlay_handler directly; complex ones (dragon) need
# extra logic and define their own inner function.

from ..config import (
    MINIONS_SPAWNING_SCENE, MINIONS_SPAWNING_SOURCE, MINIONS_SPAWNING_DURATION, MINIONS_SPAWNING_ENABLED,
    FIRST_BRICK_SCENE,      FIRST_BRICK_SOURCE,      FIRST_BRICK_DURATION,      FIRST_BRICK_ENABLED,
    TURRET_KILLED_SCENE,    TURRET_KILLED_SOURCE,    TURRET_KILLED_DURATION,    TURRET_KILLED_ENABLED,
    INHIB_KILLED_SCENE,     INHIB_KILLED_SOURCE,     INHIB_KILLED_DURATION,     INHIB_KILLED_ENABLED,
    DRAGON_KILL_SCENE,      DRAGON_KILL_SOURCE,      DRAGON_KILL_DURATION,      DRAGON_KILL_ENABLED,
    ELDER_DRAGON_SOURCE,    ELDER_DRAGON_DURATION,
    HERALD_KILL_SCENE,      HERALD_KILL_SOURCE,      HERALD_KILL_DURATION,      HERALD_KILL_ENABLED,
    BARON_KILL_SCENE,       BARON_KILL_SOURCE,       BARON_KILL_DURATION,       BARON_KILL_ENABLED,
)
from ..utils import make_overlay_handler, show_overlay


def make_minions_spawning_handler():
    return make_overlay_handler(
        MINIONS_SPAWNING_SCENE, MINIONS_SPAWNING_SOURCE, MINIONS_SPAWNING_DURATION,
        MINIONS_SPAWNING_ENABLED, "Minions spawning.",
    )


def make_first_brick_handler():
    def handle(event: dict):
        if not FIRST_BRICK_ENABLED:
            return
        print(f"[league] First Brick! Destroyed by {event.get('KillerName', 'unknown')}.")
        try:
            show_overlay(FIRST_BRICK_SCENE, FIRST_BRICK_SOURCE, FIRST_BRICK_DURATION)
        except Exception as e:
            print(f"[league] First brick handler error: {e}")
    return handle


def make_turret_killed_handler():
    def handle(event: dict):
        if not TURRET_KILLED_ENABLED:
            return
        print(f"[league] Turret destroyed: {event.get('TurretKilled', 'unknown')} "
              f"by {event.get('KillerName', 'unknown')}.")
        try:
            show_overlay(TURRET_KILLED_SCENE, TURRET_KILLED_SOURCE, TURRET_KILLED_DURATION)
        except Exception as e:
            print(f"[league] Turret killed handler error: {e}")
    return handle


def make_inhib_killed_handler():
    def handle(event: dict):
        if not INHIB_KILLED_ENABLED:
            return
        print(f"[league] Inhibitor destroyed: {event.get('InhibKilled', 'unknown')} "
              f"by {event.get('KillerName', 'unknown')}.")
        try:
            show_overlay(INHIB_KILLED_SCENE, INHIB_KILLED_SOURCE, INHIB_KILLED_DURATION)
        except Exception as e:
            print(f"[league] Inhib killed handler error: {e}")
    return handle


def make_dragon_kill_handler():
    # Dragon has Elder-specific source/duration, so can't use the factory directly.
    def handle(event: dict):
        if not DRAGON_KILL_ENABLED:
            return
        dragon_type = event.get("DragonType", "unknown")
        stolen      = event.get("Stolen", "False") == "True"
        killer      = event.get("KillerName", "unknown")
        print(f"[league] Dragon slain: {dragon_type} by {killer} (stolen={stolen}).")
        is_elder = dragon_type == "Elder"
        source   = ELDER_DRAGON_SOURCE if (is_elder and ELDER_DRAGON_SOURCE) else DRAGON_KILL_SOURCE
        duration = ELDER_DRAGON_DURATION if (is_elder and ELDER_DRAGON_SOURCE) else DRAGON_KILL_DURATION
        try:
            show_overlay(DRAGON_KILL_SCENE, source, duration)
        except Exception as e:
            print(f"[league] Dragon kill handler error: {e}")
    return handle


def make_herald_kill_handler():
    def handle(event: dict):
        if not HERALD_KILL_ENABLED:
            return
        stolen = event.get("Stolen", "False") == "True"
        print(f"[league] Herald slain by {event.get('KillerName', 'unknown')} (stolen={stolen}).")
        try:
            show_overlay(HERALD_KILL_SCENE, HERALD_KILL_SOURCE, HERALD_KILL_DURATION)
        except Exception as e:
            print(f"[league] Herald kill handler error: {e}")
    return handle


def make_baron_kill_handler():
    def handle(event: dict):
        if not BARON_KILL_ENABLED:
            return
        stolen = event.get("Stolen", "False") == "True"
        print(f"[league] Baron slain by {event.get('KillerName', 'unknown')} (stolen={stolen}).")
        try:
            show_overlay(BARON_KILL_SCENE, BARON_KILL_SOURCE, BARON_KILL_DURATION)
        except Exception as e:
            print(f"[league] Baron kill handler error: {e}")
    return handle

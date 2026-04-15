# league/utils.py
# Shared helpers used across multiple handlers.
# Import from here instead of repeating the same pattern in every file.

from __future__ import annotations

import threading

import obs


def show_overlay(scene: str, source: str, duration: float | None) -> None:
    """Show an OBS source overlay.

    duration=None  → source stays visible until hidden by something else.
    duration=N     → source auto-hides after N seconds (non-blocking).
    """
    if duration is None:
        obs.show_source(scene, source)
    else:
        threading.Thread(
            target=obs.toggle_source,
            args=(scene, source, duration),
            daemon=True,
        ).start()


def make_overlay_handler(
    scene: str,
    source: str,
    duration: float | None,
    enabled: bool,
    log: str = "",
):
    """
    Factory for handlers that only need to show an OBS overlay.

    Returns a callable compatible with LeagueEvents.register() — accepts
    any positional/keyword args so it works for both no-arg events
    (e.g. minions_spawning) and event-dict events.

    Usage:
        make_overlay_handler(SCENE, SOURCE, DURATION, ENABLED, "Log message.")
    """
    def handler(*args, **kwargs):
        if not enabled:
            return
        if log:
            print(f"[league] {log}")
        try:
            show_overlay(scene, source, duration)
        except Exception as e:
            print(f"[league] Overlay error ({source}): {e}")
    return handler

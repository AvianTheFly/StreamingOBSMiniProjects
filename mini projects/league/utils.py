# league/utils.py
# Shared helpers used across multiple handlers.
# Import from here instead of repeating the same pattern in every file.

from __future__ import annotations

import threading

import obs


def _normalize_respawn_border(scene: str, source: str) -> None:
    """
    RespawnBorder is an OBS group. OBS persists group transforms, so if it gets
    dragged, pasted, or otherwise inherits a triangle-sized transform, later
    show/hide calls reveal it in that bad position. Snap it back when it is
    clearly off-canvas or scaled down like a kill-streak icon.
    """
    from .config import RESPAWN_SCENE, RESPAWN_SOURCE

    if scene != RESPAWN_SCENE or source != RESPAWN_SOURCE:
        return

    try:
        transform = obs.get_source_transform(scene, source)
        canvas = obs.get_canvas_size()
    except Exception as exc:
        print(f"[league] Could not inspect {source} transform: {exc}")
        return

    x = float(transform.get("positionX", 0.0) or 0.0)
    y = float(transform.get("positionY", 0.0) or 0.0)
    scale_x = float(transform.get("scaleX", 1.0) or 1.0)
    scale_y = float(transform.get("scaleY", 1.0) or 1.0)
    source_w = float(transform.get("sourceWidth", 0.0) or transform.get("width", 0.0) or 0.0)
    source_h = float(transform.get("sourceHeight", 0.0) or transform.get("height", 0.0) or 0.0)
    canvas_w = float(canvas.get("baseWidth", 1920) or 1920)
    canvas_h = float(canvas.get("baseHeight", 1080) or 1080)

    looks_tiny = scale_x < 0.5 or scale_y < 0.5
    off_canvas = abs(x) > canvas_w * 1.5 or abs(y) > canvas_h * 1.5
    if not (looks_tiny or off_canvas):
        return

    if source_w <= 0 or source_h <= 0:
        target_scale = 1.0
        target_x = 0.0
        target_y = 0.0
    else:
        # Cover the canvas while preserving aspect ratio; allow slight overscan.
        target_scale = max(canvas_w / source_w, canvas_h / source_h)
        target_x = (canvas_w - source_w * target_scale) / 2.0
        target_y = (canvas_h - source_h * target_scale) / 2.0

    try:
        obs.set_source_transform(scene, source, {
            "positionX": target_x,
            "positionY": target_y,
            "scaleX": target_scale,
            "scaleY": target_scale,
            "rotation": 0.0,
            "alignment": 5,
        })
        print(
            f"[league] Reset {source} transform "
            f"(was x={x:.0f}, y={y:.0f}, scale={scale_x:.3f}/{scale_y:.3f})."
        )
    except Exception as exc:
        print(f"[league] Could not reset {source} transform: {exc}")


def show_overlay(scene: str, source: str, duration: float | None) -> None:
    """Show an OBS source overlay.

    duration=None  → source stays visible until hidden by something else.
    duration=N     → source auto-hides after N seconds (non-blocking).
    """
    _normalize_respawn_border(scene, source)
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

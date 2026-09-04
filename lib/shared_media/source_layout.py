# shared_media/source_layout.py
#
# Helpers for positioning OBS scene items at a specific canvas rectangle.
#
# Usage (any mini-project):
#
#   from shared_media.source_layout import set_source_bounds
#
#   # After creating a new source, pin it to the desired canvas region.
#   set_source_bounds(scene, source_name)
#
# All four edge parameters are distances (in px) from their respective canvas edge:
#
#   left   – gap between the left canvas edge and the item's left edge
#   right  – gap between the right canvas edge and the item's right edge
#   top    – gap between the top canvas edge and the item's top edge
#   bottom – gap between the bottom canvas edge and the item's bottom edge
#
# So the resulting item occupies:
#   x: left … (W - right)    width  = canvas_width  - left - right
#   y: top  … (H - bottom)   height = canvas_height - top  - bottom

from __future__ import annotations

import obs


def set_source_bounds(
    scene: str,
    source: str,
    *,
    left: int = 0,
    right: int = 1639,
    top: int = 600,
    bottom: int = 322,
    canvas_width: int = 1920,
    canvas_height: int = 1080,
    bounds_type: str = "OBS_BOUNDS_SCALE_INNER",
) -> None:
    """
    Position and size a scene item by specifying its four canvas edges.

    Parameters
    ----------
    scene        : OBS scene the source lives in.
    source       : OBS source (input) name.
    left         : Distance from the left canvas edge (px).
    right        : Distance from the right canvas edge (px).
    top          : Distance from the top canvas edge (px).
    bottom       : Distance from the bottom canvas edge (px).
    canvas_width : Canvas width in pixels (default 1920).
    canvas_height: Canvas height in pixels (default 1080).
    bounds_type  : OBS bounds type.  "OBS_BOUNDS_SCALE_INNER" (default) preserves
                   aspect ratio.  Use "OBS_BOUNDS_STRETCH" to fill exactly.
    """
    width  = canvas_width  - left - right
    height = canvas_height - top  - bottom

    if width <= 0 or height <= 0:
        print(
            f"[source_layout] Invalid bounds for '{source}': "
            f"width={width}, height={height} — skipping."
        )
        return

    try:
        obs.set_source_transform(scene, source, {
            "positionX":      float(left),
            "positionY":      float(top),
            "boundsType":     bounds_type,
            "boundsWidth":    float(width),
            "boundsHeight":   float(height),
            "alignment":      5,   # top-left anchor point
            "boundsAlignment": 0,  # centre within the bounds box
        })
    except Exception as exc:
        print(f"[source_layout] Could not set bounds for '{source}': {exc}")

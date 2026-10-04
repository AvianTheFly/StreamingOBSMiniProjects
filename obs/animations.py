"""Finite source animations and their cancellable idle-spin lifetime."""
from __future__ import annotations

import json
import math
import random
import threading
import time
from pathlib import Path

from .client import get_obs
from .sources import _get_scene_item_id


def show_source_animated(
    scene: str,
    source: str,
    jump_duration: float = 2.0,
    filter_name: str = "3D Block",
) -> None:
    """
    Show a source with a jump-up animation and 3D-block coin-spin.

    1. Source appears upright at a random position off-screen bottom.
    2. It slides up to its target Y position in ``jump_duration`` seconds.
    3. During the ascent the triangle gradually starts spinning like a coin
       (tilt_x_deg cycled through the 3D Block filter).
    4. After landing it keeps continuously coin-spinning at its idle position.

    Rest positions are loaded from ``obs/positions.json``.  Edit those values
    or run ``python tools/detect_positions.py`` after moving things in OBS.
    """
    client = get_obs()
    item_id = _get_scene_item_id(client, scene, source)

    # ── 0. Load rest position from saved positions ────────────────────────
    positions_file = Path(__file__).resolve().parent / "positions.json"
    try:
        with open(positions_file) as f:
            data = json.load(f)
        saved = data.get("sources", {}).get(source, {})
        rest_x = saved.get("positionX", 1500)
        rest_y = saved.get("positionY", 100)
        rest_scale_x = saved.get("scaleX", 1.0)
        rest_scale_y = saved.get("scaleY", 1.0)
    except Exception:
        # Fallback: query OBS directly
        current = client.get_scene_item_transform(scene, item_id)
        t = getattr(current, "scene_item_transform", current)
        rest_x = t.get("positionX", 1500)
        rest_y = t.get("positionY", 100)
        rest_scale_x = t.get("scaleX", 1.0)
        rest_scale_y = t.get("scaleY", 1.0)

    # ── 1. Make sure the item is visible first ────────────────────────────
    client.set_scene_item_enabled(scene, item_id, True)

    # ── 2. Random jump start (off-screen bottom) ─────────────────────────
    start_x = rest_x + random.uniform(-80, 80)
    start_y = rest_y + random.uniform(900, 1200)

    # ── 3. Put the source at the start position ──────────────────────────
    client.set_scene_item_transform(scene, item_id, {
        "positionX": start_x,
        "positionY": start_y,
        "scaleX": rest_scale_x,
        "scaleY": rest_scale_y,
    })

    # Set 3D Block to upright and still, centered
    try:
        client.set_source_filter_settings(
            source, filter_name,
            {"tilt_x_deg": 0, "tilt_y_deg": 0, "tilt_z_deg": 0,
             "pos_x_percent": 0, "pos_y_percent": 0, "scale": 100, "wiggle": 0},
            overlay=True,
        )
    except Exception:
        pass

    # ── 4. Ease-in / ease-out jump ───────────────────────────────────────
    steps = int(jump_duration / 0.04)  # ~25 updates per second
    for i in range(1, steps + 1):
        progress = i / steps
        ease = progress * progress * (3 - 2 * progress)  # smoothstep

        x = start_x + (rest_x - start_x) * ease
        y = start_y + (rest_y - start_y) * ease

        client.set_scene_item_transform(scene, item_id, {
            "positionX": x,
            "positionY": y,
            "scaleX": rest_scale_x,
            "scaleY": rest_scale_y,
        })

        # Coin-spin accelerates during the jump: upright at start,
        # then spinning fast.  Cycle tilt_x_deg like a coin flip.
        # At progress 0: tilt = 0 (upright).  At progress 1: full coin spin.
        spin_speed = 200 * progress          # starts 0, ramps to 200
        tilt_angle = spin_speed * progress    # degrees, grows over time
        spin_x = 90 * math.sin(math.radians(tilt_angle))
        spin_z = 70 * math.cos(math.radians(tilt_angle))
        thickness = int(30 + 30 * progress)  # 3D block grows as it spins

        try:
            client.set_source_filter_settings(
                source, filter_name,
                {"tilt_x_deg": spin_x, "tilt_z_deg": spin_z, "thickness": thickness,
                 "pos_x_percent": 0, "pos_y_percent": 0,
                 "scale": 100, "wiggle": int(10 * progress), "wiggle_rot": True},
                overlay=True,
            )
        except Exception:
            pass  # filter may not exist — triangle just jumps

        time.sleep(0.04)

    # ── 5. Land at final position ────────────────────────────────────────
    client.set_scene_item_transform(scene, item_id, {
        "positionX": rest_x,
        "positionY": rest_y,
        "scaleX": rest_scale_x,
        "scaleY": rest_scale_y,
    })

    # ── 6. Continuous coin-spin at idle position ─────────────────────────
    # Use a background thread that keeps cycling the 3D Block tilt values
    # so the triangle endlessly flips like a coin.
    _stop_idle_spin: dict[str, threading.Event]
    if not hasattr(client, "_idle_spin_events"):
        client._idle_spin_events = {}

    # Kill any existing idle-spin thread for this source
    old = client._idle_spin_events.pop(source, None)
    if old:
        old.set()

    stop_event = threading.Event()
    client._idle_spin_events[source] = stop_event

    def _idle_spin_loop():
        t0 = time.time()
        while not stop_event.is_set():
            elapsed = time.time() - t0
            angle = elapsed * 300  # ~1 full cycle every 1.2 seconds
            tx = 90 * math.sin(math.radians(angle))
            tz = 60 * math.cos(math.radians(angle))
            try:
                client.set_source_filter_settings(
                    source, filter_name,
                    {"tilt_x_deg": tx, "tilt_z_deg": tz, "thickness": 50,
                     "pos_x_percent": 0, "pos_y_percent": 0, "scale": 100},
                    overlay=True,
                )
            except Exception as e:
                print(f"[idle_spin] Error on '{source}': {e}")
                break
            time.sleep(0.05)

    thread = threading.Thread(target=_idle_spin_loop, daemon=True)
    thread.start()

def show_logo_animated(
    scene: str,
    source: str,
    filter_name: str = "3D Block",
    jump_duration: float = 1.5,
) -> None:
    """
    Animate a logo sliding up from just below the canvas with an X-axis
    spin during the ascent.  Once it lands it snaps to the exact
    position, scale, and filter settings from ``instant_replay/logo_config.json``.
    """
    config_file = (
        Path(__file__).resolve().parents[1]
        / "tools"
        / "logo_config.json"
    )
    config = None
    try:
        with open(config_file) as f:
            config = json.load(f)
    except Exception:
        pass

    # ── 1. Make sure the item is visible ──────────────────────────────────
    client = get_obs()
    item_id = _get_scene_item_id(client, scene, source)
    client.set_scene_item_enabled(scene, item_id, True)

    # ── 2. Determine rest position + scale ────────────────────────────────
    if config:
        rest_x       = config.get("positionX", 600)
        rest_y       = config.get("positionY", 0)
        rest_scale_x = config.get("scaleX", 1.0)
        rest_scale_y = config.get("scaleY", 1.0)
        filter_defaults = config.get("filter_3d_block")
    else:
        current = client.get_scene_item_transform(scene, item_id)
        t = getattr(current, "scene_item_transform", current)
        rest_x       = t.get("positionX", 600)
        rest_y       = t.get("positionY", 0)
        rest_scale_x = t.get("scaleX", 1.0)
        rest_scale_y = t.get("scaleY", 1.0)
        filter_defaults = None

    # ── 2. Start position: 50 px below the 1080p canvas bottom ──────────
    start_x = rest_x
    start_y = 1080 + 50

    client.set_scene_item_transform(scene, item_id, {
        "positionX": start_x,
        "positionY": start_y,
        "scaleX": rest_scale_x,
        "scaleY": rest_scale_y,
    })

    # Reset filter to flat / still
    try:
        client.set_source_filter_settings(
            source, filter_name,
            {"tilt_x_deg": 0, "tilt_y_deg": 0, "tilt_z_deg": 0,
             "pos_x_percent": 0, "pos_y_percent": 0, "scale": 110, "wiggle": 0},
            overlay=True,
        )
    except Exception:
        pass

    # ── 3. Jump + X-axis spin only ───────────────────────────────────────
    CANVAS_BOTTOM = 1080 + 50
    steps = int(jump_duration / 0.04)
    for i in range(1, steps + 1):
        progress = i / steps
        ease = progress * progress * (3 - 2 * progress)

        x = start_x + (rest_x - start_x) * ease
        y = start_y + (rest_y - start_y) * ease

        client.set_scene_item_transform(scene, item_id, {
            "positionX": x,
            "positionY": y,
            "scaleX": rest_scale_x,
            "scaleY": rest_scale_y,
        })

        # X-axis spin: starts at 0 (flat facing camera), flips upward
        # 1.5 full rotations by the time it lands
        tx = 120 * math.sin(math.radians(progress * 540))

        try:
            client.set_source_filter_settings(
                source, filter_name,
                {"tilt_x_deg": tx, "tilt_z_deg": 0, "thickness": 30,
                 "pos_x_percent": 0, "pos_y_percent": 0, "scale": 110},
                overlay=True,
            )
        except Exception:
            pass

        time.sleep(0.04)

    # ── 4. Land at exact resting position ────────────────────────────────
    client.set_scene_item_transform(scene, item_id, {
        "positionX": rest_x,
        "positionY": rest_y,
        "scaleX": rest_scale_x,
        "scaleY": rest_scale_y,
    })

    # ── 5. Restore exact filter settings (or kill the spin) ─────────────
    try:
        if filter_defaults:
            client.set_source_filter_settings(
                source, filter_name, filter_defaults, overlay=True,
            )
        else:
            client.set_source_filter_settings(
                source, filter_name,
                {"tilt_x_deg": 0, "tilt_y_deg": 0, "tilt_z_deg": 0,
                 "pos_x_percent": 0, "pos_y_percent": 0, "scale": 110, "wiggle": 0},
                overlay=True,
            )
    except Exception:
        pass

    # Make sure no idle-spin thread is running for this source
    if hasattr(client, "_idle_spin_events"):
        stop = client._idle_spin_events.pop(source, None)
        if stop:
            stop.set()

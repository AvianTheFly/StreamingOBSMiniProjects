from __future__ import annotations

import math
import random
import time
import threading

from obs.client import get_obs
import obs

# ── Constants ─────────────────────────────────────────────────────────────────
_SCENE       = "Sprites"
_BOUNDS_TYPE = "OBS_BOUNDS_SCALE_INNER"
_ICON_SIZE   = 96

_SPRITE_PREFIX = "LevelUpSprite"

_CANVAS_WIDTH  = 1920
_MARGIN        = 150    # keep sprites away from very edge when picking random X

_START_Y       = 1000.0  # below bottom of canvas
_END_Y         = -20.0   # above top of canvas

_RISE_DURATION = 2.0     # seconds to travel bottom to top

# Wavy motion — each sprite gets randomised values within these ranges
_WAVE_AMP_MIN  = 40.0    # min horizontal sine amplitude (pixels)
_WAVE_AMP_MAX  = 120.0   # max horizontal sine amplitude (pixels)
_WAVE_FREQ_MIN = 1.5     # min full cycles over the whole rise
_WAVE_FREQ_MAX = 3.0     # max full cycles over the whole rise
_WAVE_PHASE_MAX = math.pi * 2  # random starting phase so waves don't sync up

_FPS      = 20
_INTERVAL = 1.0 / _FPS


def play_level_up_effect(level: int) -> None:
    threading.Thread(target=_run_effect, args=(level,), daemon=True).start()


def _run_effect(level: int) -> None:
    _SOURCES = [f"{_SPRITE_PREFIX}{i}" for i in range(1, level + 1)]
    client = get_obs()

    # Resolve all item IDs sequentially before any animation starts
    resolved = []
    for source in _SOURCES:
        try:
            item_id = client.get_scene_item_id(_SCENE, source).scene_item_id
            resolved.append((source, item_id))
        except Exception as e:
            print(f"[league] Could not resolve '{source}' in '{_SCENE}': {e}")
            return

    # Each sprite gets its own random start X and wave parameters
    sprite_params = []
    for source, item_id in resolved:
        params = {
            "source"     : source,
            "item_id"    : item_id,
            "anchor_x"   : float(random.randint(_MARGIN, _CANVAS_WIDTH - _MARGIN)),
            "wave_amp"   : random.uniform(_WAVE_AMP_MIN, _WAVE_AMP_MAX),
            "wave_freq"  : random.uniform(_WAVE_FREQ_MIN, _WAVE_FREQ_MAX),
            "wave_phase" : random.uniform(0, _WAVE_PHASE_MAX),
        }
        sprite_params.append(params)

    # Snap all sprites to their start positions and show before threads launch
    for p in sprite_params:
        _set_transform(client, p["item_id"], p["anchor_x"], _START_Y)
        try:
            obs.show_source(_SCENE, p["source"])
        except Exception as e:
            print(f"[league] Could not show '{p['source']}': {e}")
            return

    # Animate all sprites in parallel
    threads = [
        threading.Thread(target=_animate_sprite, args=(client, p), daemon=True)
        for p in sprite_params
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Hide all
    for p in sprite_params:
        try:
            obs.hide_source(_SCENE, p["source"])
        except Exception as e:
            print(f"[league] Could not hide '{p['source']}': {e}")


def _animate_sprite(client, p: dict) -> None:
    anchor_x  = p["anchor_x"]
    amp       = p["wave_amp"]
    freq      = p["wave_freq"]
    phase     = p["wave_phase"]

    t0 = time.monotonic()
    while True:
        elapsed  = time.monotonic() - t0
        progress = min(elapsed / _RISE_DURATION, 1.0)

        # Vertical: ease-out so it launches fast and decelerates near the top
        eased = 1.0 - (1.0 - progress) ** 2
        y = _START_Y + (_END_Y - _START_Y) * eased

        # Horizontal: sine wave around the anchor X
        x = anchor_x + amp * math.sin(phase + progress * freq * 2.0 * math.pi)

        _set_transform(client, p["item_id"], x, y)

        if progress >= 1.0:
            break
        time.sleep(_INTERVAL)


def _set_transform(client, item_id: int, x: float, y: float) -> None:
    try:
        client.set_scene_item_transform(
            _SCENE,
            item_id,
            {
                "positionX"   : x,
                "positionY"   : y,
                "boundsType"  : _BOUNDS_TYPE,
                "boundsWidth" : float(_ICON_SIZE),
                "boundsHeight": float(_ICON_SIZE),
                "rotation"    : 0.0,
            },
        )
    except Exception as e:
        print(f"[league] Transform error: {e}")
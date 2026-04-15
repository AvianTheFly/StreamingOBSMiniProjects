# league/handlers/level_up.py
# Level-up handler + the sprite animation effect it drives.

from __future__ import annotations

import math
import random
import threading
import time

import obs

# ── Animation constants ───────────────────────────────────────────────────────
_SCENE        = "Sprites"
_BOUNDS_TYPE  = "OBS_BOUNDS_SCALE_INNER"
_ICON_SIZE    = 96
_SPRITE_PREFIX = "LevelUpSprite"

_CANVAS_WIDTH  = 1920
_MARGIN        = 150    # keep sprites away from the very edge

_START_Y       = 1000.0  # below bottom of canvas
_END_Y         = -20.0   # above top of canvas
_RISE_DURATION = 2.0     # seconds to travel bottom → top

_WAVE_AMP_MIN   = 40.0
_WAVE_AMP_MAX   = 120.0
_WAVE_FREQ_MIN  = 1.5
_WAVE_FREQ_MAX  = 3.0
_WAVE_PHASE_MAX = math.pi * 2

_FPS      = 20
_INTERVAL = 1.0 / _FPS


# ── Animation (private) ───────────────────────────────────────────────────────

def _run_effect(level: int) -> None:
    sources = [f"{_SPRITE_PREFIX}{i}" for i in range(1, level + 1)]

    resolved = []
    for source in sources:
        try:
            item_id = obs.get_scene_item_id(_SCENE, source)
            resolved.append((source, item_id))
        except Exception as e:
            print(f"[league] Could not resolve '{source}' in '{_SCENE}': {e}")
            return

    sprite_params = [
        {
            "source"     : src,
            "item_id"    : iid,
            "anchor_x"   : float(random.randint(_MARGIN, _CANVAS_WIDTH - _MARGIN)),
            "wave_amp"   : random.uniform(_WAVE_AMP_MIN, _WAVE_AMP_MAX),
            "wave_freq"  : random.uniform(_WAVE_FREQ_MIN, _WAVE_FREQ_MAX),
            "wave_phase" : random.uniform(0, _WAVE_PHASE_MAX),
        }
        for src, iid in resolved
    ]

    for p in sprite_params:
        _set_transform(p["item_id"], p["anchor_x"], _START_Y)
        try:
            obs.show_source(_SCENE, p["source"])
        except Exception as e:
            print(f"[league] Could not show '{p['source']}': {e}")
            return

    threads = [
        threading.Thread(target=_animate_sprite, args=(p,), daemon=True)
        for p in sprite_params
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for p in sprite_params:
        try:
            obs.hide_source(_SCENE, p["source"])
        except Exception as e:
            print(f"[league] Could not hide '{p['source']}': {e}")


def _animate_sprite(p: dict) -> None:
    t0 = time.monotonic()
    while True:
        elapsed  = time.monotonic() - t0
        progress = min(elapsed / _RISE_DURATION, 1.0)

        eased = 1.0 - (1.0 - progress) ** 2
        y = _START_Y + (_END_Y - _START_Y) * eased
        x = p["anchor_x"] + p["wave_amp"] * math.sin(
            p["wave_phase"] + progress * p["wave_freq"] * 2.0 * math.pi
        )
        _set_transform(p["item_id"], x, y)

        if progress >= 1.0:
            break
        time.sleep(_INTERVAL)


def _set_transform(item_id: int, x: float, y: float) -> None:
    try:
        obs.set_source_transform_by_id(
            _SCENE, item_id,
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


# ── Public handler ────────────────────────────────────────────────────────────

def make_level_up_handler():
    def handle_level_up(player_data, old_level, new_level):
        print(f"[league] Level up detected — {old_level} -> {new_level}.")
        try:
            threading.Thread(target=_run_effect, args=(new_level,), daemon=True).start()
        except Exception as e:
            print(f"[league] Level up handler error: {e}")
    return handle_level_up

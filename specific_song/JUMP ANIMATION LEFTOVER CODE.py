# jump_animation_reference.py
# ─────────────────────────────────────────────────────────────────────────────
# REFERENCE / SNIPPET FILE — NOT MEANT TO RUN STANDALONE.
#
# Extracted from specific_song/bass_animator.py.
# Copy what you need into any project that has access to the obs package
# and a threading.Event-style stop signal.
#
# What this does
# --------------
# Jump-IN  : on song start, the source slides up from below the canvas to its
#            resting position using cubic easing.
# Jump-OUT : on song end (or request), the source drops back below the canvas.
#
# The animation runs in a background thread.  The caller signals it via events.
# ─────────────────────────────────────────────────────────────────────────────

from __future__ import annotations

import math
import threading
import time

# These would normally come from your project's config and obs package.
# Replace with your own imports when integrating.
#
# import obs
# from .config import (
#     SCENE,
#     CANVAS_HEIGHT,
#     FIXED_SOURCE_HEIGHT,
#     BASS_PADDING_X,
#     BASS_PADDING_Y,
#     JUMP_DURATION,
#     JUMP_EASE_POWER,
#     ANIM_INTERVAL,
# )

# ── Easing ────────────────────────────────────────────────────────────────────

def ease_out_power(t: float, power: int = 3) -> float:
    """
    Ease-out polynomial.  t in [0, 1] → output in [0, 1].
    power=3 → cubic ease-out (fast start, slow landing).
    Higher power = snappier, more sudden landing.
    """
    return 1.0 - (1.0 - t) ** power


# ── Jump animation core ───────────────────────────────────────────────────────

def jump_in(
    obs,                  # the obs module / package
    scene: str,
    source_name: str,
    rest_x: float,        # final resting positionX (pixels)
    rest_y: float,        # final resting positionY (pixels)
    canvas_height: int,   # full canvas height in pixels
    source_height: int,   # source's rendered height in pixels
    duration: float,      # seconds for the full jump arc
    ease_power: int,      # polynomial exponent for easing
    anim_interval: float, # seconds between OBS transform updates (~1/fps)
    stop_event: threading.Event,  # set externally to abort mid-animation
) -> None:
    """
    Animate the source sliding up from below the canvas to (rest_x, rest_y).

    The source starts at positionY = canvas_height (fully off-screen below)
    and moves to rest_y over `duration` seconds using ease-out easing.

    Call this in a daemon thread immediately after showing the source.
    """
    start_y  = float(canvas_height)           # off-screen below
    delta_y  = rest_y - start_y               # negative — moving up
    t_start  = time.monotonic()

    while not stop_event.is_set():
        elapsed  = time.monotonic() - t_start
        progress = min(elapsed / duration, 1.0)
        eased    = ease_out_power(progress, ease_power)
        current_y = start_y + delta_y * eased

        try:
            obs.set_source_transform(scene, source_name, {
                "positionX": rest_x,
                "positionY": current_y,
            })
        except Exception:
            break  # OBS disconnected or source gone — bail silently

        if progress >= 1.0:
            break

        time.sleep(anim_interval)


def jump_out(
    obs,
    scene: str,
    source_name: str,
    rest_x: float,
    rest_y: float,
    canvas_height: int,
    source_height: int,
    duration: float,
    ease_power: int,
    anim_interval: float,
    stop_event: threading.Event,
) -> None:
    """
    Animate the source dropping from (rest_x, rest_y) back below the canvas.

    Mirrors jump_in: starts at rest_y and moves to canvas_height (off-screen).
    Use ease_in instead of ease_out so the drop accelerates (feels like gravity).
    Blocks until the animation completes or stop_event is set.
    """
    target_y = float(canvas_height)           # off-screen below
    delta_y  = target_y - rest_y             # positive — moving down
    t_start  = time.monotonic()

    while not stop_event.is_set():
        elapsed  = time.monotonic() - t_start
        progress = min(elapsed / duration, 1.0)
        # Ease-IN for drop: slow start, fast landing (reverse of ease_out)
        eased    = progress ** ease_power
        current_y = rest_y + delta_y * eased

        try:
            obs.set_source_transform(scene, source_name, {
                "positionX": rest_x,
                "positionY": current_y,
            })
        except Exception:
            break

        if progress >= 1.0:
            break

        time.sleep(anim_interval)


# ── Minimal self-contained wrapper ────────────────────────────────────────────
# Drop this class into any project.  Wire up the config values you need.

class JumpAnimator:
    """
    Manages jump-in and jump-out animations for a single OBS source.

    Usage
    -----
        anim = JumpAnimator(obs, scene, source_name, config)
        anim.jump_in()        # blocks until animation completes
        # ... song plays ...
        anim.jump_out()       # blocks until animation completes
        anim.cancel()         # abort mid-animation (e.g. on song abort)

    Config dict keys expected
    -------------------------
        canvas_height   : int
        source_height   : int
        rest_x          : float   (BASS_PADDING_X)
        rest_y          : float   (BASS_PADDING_Y)
        jump_duration   : float   (JUMP_DURATION)
        ease_power      : int     (JUMP_EASE_POWER)
        anim_interval   : float   (ANIM_INTERVAL)
    """

    def __init__(self, obs, scene: str, source_name: str, config: dict) -> None:
        self._obs         = obs
        self._scene       = scene
        self._source      = source_name
        self._cfg         = config
        self._stop        = threading.Event()

    def cancel(self) -> None:
        """Abort any running animation immediately."""
        self._stop.set()

    def jump_in(self) -> None:
        """Blocking jump-in. Resets the stop event first."""
        self._stop.clear()
        cfg = self._cfg
        jump_in(
            self._obs, self._scene, self._source,
            rest_x        = cfg["rest_x"],
            rest_y        = cfg["rest_y"],
            canvas_height = cfg["canvas_height"],
            source_height = cfg["source_height"],
            duration      = cfg["jump_duration"],
            ease_power    = cfg["ease_power"],
            anim_interval = cfg["anim_interval"],
            stop_event    = self._stop,
        )

    def jump_out(self) -> None:
        """Blocking jump-out."""
        self._stop.clear()
        cfg = self._cfg
        jump_out(
            self._obs, self._scene, self._source,
            rest_x        = cfg["rest_x"],
            rest_y        = cfg["rest_y"],
            canvas_height = cfg["canvas_height"],
            source_height = cfg["source_height"],
            duration      = cfg["jump_duration"],
            ease_power    = cfg["ease_power"],
            anim_interval = cfg["anim_interval"],
            stop_event    = self._stop,
        )

    def jump_in_async(self) -> threading.Thread:
        """Non-blocking jump-in. Returns the thread."""
        t = threading.Thread(target=self.jump_in, daemon=True)
        t.start()
        return t

    def jump_out_async(self) -> threading.Thread:
        """Non-blocking jump-out. Returns the thread."""
        t = threading.Thread(target=self.jump_out, daemon=True)
        t.start()
        return t


# ── Example integration ───────────────────────────────────────────────────────
#
# import obs
# from .config import (SCENE, CANVAS_HEIGHT, FIXED_SOURCE_HEIGHT,
#                      BASS_PADDING_X, BASS_PADDING_Y,
#                      JUMP_DURATION, JUMP_EASE_POWER, ANIM_INTERVAL)
#
# anim = JumpAnimator(obs, SCENE, source_name, {
#     "canvas_height": CANVAS_HEIGHT,
#     "source_height": FIXED_SOURCE_HEIGHT,
#     "rest_x":        BASS_PADDING_X,
#     "rest_y":        BASS_PADDING_Y,
#     "jump_duration": JUMP_DURATION,
#     "ease_power":    JUMP_EASE_POWER,
#     "anim_interval": ANIM_INTERVAL,
# })
#
# obs.show_source(SCENE, source_name)
# anim.jump_in_async()          # starts sliding up while song begins
# ... wait for song to finish ...
# anim.jump_out()               # drop it back down, then hide
# obs.hide_source(SCENE, source_name)
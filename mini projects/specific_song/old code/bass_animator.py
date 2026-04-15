# specific_song/bass_animator.py
#
# Audio-driven OBS source animation.
#
# Two separate animation layers:
#
#   1. GROOVE layer  — continuous, gentle drift/sway/tilt driven by envelopes.
#                      Always active while music plays.  Intentionally subtle
#                      so it doesn't look jittery.
#
#   2. OOMPH layer   — triggered only by consume_oomph() (hard sub-bass hit).
#                      Fires a large, fast scale spike that snaps back quickly.
#                      Think camera flash, not a slow swell.
#
# The two layers are additive: oomph scale multiplies on top of groove scale.

from __future__ import annotations

import math
import threading
import time

import obs

from .config import (
    SCENE,
    CANVAS_HEIGHT,
    BASS_DEVICE_INDEX,
    BASS_LOW_HZ,
    BASS_HIGH_HZ,
    BASS_SMOOTHING,
    BASS_THRESHOLD,
    BASS_MAX_SCALE,
    BASS_PADDING_X,
    BASS_PADDING_Y,
    ANIM_INTERVAL,
    FIXED_SOURCE_WIDTH,
    FIXED_SOURCE_HEIGHT,
    DANCE_X_AMP,
    DANCE_Y_AMP,
    DANCE_TILT,
    PULSE_DECAY,
    ONSET_RATIO,
    ONSET_MIN_LEVEL,
    ONSET_COOLDOWN,
    JUMP_DURATION,
    JUMP_EASE_POWER,
    MASK_FILTER_ENABLED,
    MASK_PATH,
    MASK_FILTER_NAME,
    MASK_OPACITY,
    MASK_TYPE,
    MASK_STRETCH,
)
from obs import get_scene_item_id
from .bass_detector import BassDetector

_TAG = "[specific_song]"
_BOUNDS_TYPE = "OBS_BOUNDS_SCALE_INNER"
_OFFSCREEN_Y = float(CANVAS_HEIGHT + FIXED_SOURCE_HEIGHT + 20)

# ── Oomph hit parameters ───────────────────────────────────────────────────────
# On a hard sub-bass hit, the source jumps to OOMPH_PEAK_SCALE instantly
# (one frame) then decays back to 1.0 with time constant OOMPH_DECAY_TAU.
# Keep OOMPH_PEAK_SCALE big enough to feel visceral — 1.8–2.2 works well.
_OOMPH_PEAK_SCALE: float = 2.0    # 2× = source doubles in size for one frame
_OOMPH_DECAY_TAU:  float = 0.08   # seconds to fall back (shorter = snappier)

# ── Groove layer parameters ────────────────────────────────────────────────────
# These deliberately stay small so the source doesn't constantly flail.
# Big motion comes from oomph, not groove.
_GROOVE_SCALE_IDLE: float = 1.00  # scale when music is quiet
_GROOVE_SCALE_MAX:  float = 1.12  # max continuous scale (bass envelope full)
_GROOVE_TAU_UP:     float = 0.030 # attack — fast enough to track beats
_GROOVE_TAU_DOWN:   float = 0.090 # release — snappier than before


def _ease_out(t: float, power: int) -> float:
    return 1.0 - (1.0 - t) ** power


def _ease_in(t: float, power: int) -> float:
    return t ** power


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _smooth_toward(current: float, target: float, dt: float, tau: float) -> float:
    alpha = 1.0 - math.exp(-dt / max(tau, 1e-6))
    return current + (target - current) * alpha


class BassAnimator:
    def __init__(self, source_name: str) -> None:
        self.source_name = source_name
        self._scene_item_id: int | None = None
        self._detector = BassDetector(
            device_index=BASS_DEVICE_INDEX,
            bass_low_hz=BASS_LOW_HZ,
            bass_high_hz=BASS_HIGH_HZ,
            smoothing=BASS_SMOOTHING,
            onset_ratio=ONSET_RATIO,
            onset_min_level=ONSET_MIN_LEVEL,
            onset_cooldown=ONSET_COOLDOWN,
        )
        self._thread: threading.Thread | None = None
        self._stop            = threading.Event()
        self._exit_requested  = threading.Event()
        self._disabled_filter: str | None = None
        self._mask_applied    = False

    def _get_item_id(self) -> int:
        if self._scene_item_id is None:
            self._scene_item_id = get_scene_item_id(SCENE, self.source_name)
        return self._scene_item_id

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        self._stop.clear()
        self._exit_requested.clear()
        self._apply_mask()
        self._detector.start()
        self._thread = threading.Thread(
            target=self._loop,
            daemon=True,
            name=f"bass_anim:{self.source_name}",
        )
        self._thread.start()
        print(f"{_TAG} 🎵  Bass animator started for '{self.source_name}'")

    def request_exit(self) -> None:
        if self._thread is None or not self._thread.is_alive():
            return
        self._exit_requested.set()
        self._thread.join(timeout=JUMP_DURATION + 0.5)

    def stop(self) -> None:
        self._stop.set()
        self._exit_requested.set()
        self._detector.stop()
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None
        self._remove_mask()
        self._reset_transform()
        print(f"{_TAG} 🎵  Bass animator stopped for '{self.source_name}'")

    # ── Main loop ──────────────────────────────────────────────────────────────

    def _loop(self) -> None:
        self._animate_jump(entering=True)
        if self._stop.is_set():
            self._finish_clean()
            return

        # Groove state
        phase        = 0.0
        melody_phase = 0.0
        x            = 0.0
        y            = 0.0
        tilt         = 0.0
        groove_scale = 1.0
        side_dir     = 1.0

        # Oomph state — completely separate from groove
        oomph_scale  = 1.0   # current oomph multiplier (decays toward 1.0)

        last_t = time.monotonic()

        while not self._stop.is_set() and not self._exit_requested.is_set():
            now = time.monotonic()
            dt  = max(1e-4, now - last_t)
            last_t = now

            # ── Read detectors ─────────────────────────────────────────────
            bass      = self._detector.get_level()
            motion    = self._detector.get_motion()
            intensity = self._detector.get_intensity()
            melody    = self._detector.get_melody()

            bass_drive   = _clamp((bass   - BASS_THRESHOLD) / max(1.0 - BASS_THRESHOLD, 1e-6), 0.0, 1.0)
            motion_drive = _clamp(motion,  0.0, 1.0)
            melody_drive = _clamp(melody,  0.0, 1.0)

            # ── Oomph hit ──────────────────────────────────────────────────
            # Fire the big spike only on a verified hard sub-bass hit.
            if self._detector.consume_oomph():
                oomph_scale = _OOMPH_PEAK_SCALE   # instant jump
                side_dir   *= -1.0                 # also nudge the sway direction

            # Decay oomph back to 1.0 exponentially
            oomph_scale = 1.0 + (oomph_scale - 1.0) * math.exp(-dt / _OOMPH_DECAY_TAU)

            # ── Groove scale (continuous, subtle) ──────────────────────────
            groove_target = _GROOVE_SCALE_IDLE + (_GROOVE_SCALE_MAX - _GROOVE_SCALE_IDLE) * bass_drive
            tau_groove    = _GROOVE_TAU_UP if groove_target > groove_scale else _GROOVE_TAU_DOWN
            groove_scale  = _smooth_toward(groove_scale, groove_target, dt, tau_groove)

            # ── Combined scale (oomph multiplies on top of groove) ─────────
            total_scale = groove_scale * oomph_scale

            # ── Position / tilt (groove only — oomph doesn't move position) ─
            phase        += dt * (0.45 + 0.40 * motion_drive + 0.20 * _clamp(intensity, 0.0, 1.0))
            melody_phase += dt * (0.95 + 1.55 * melody_drive + 0.30 * motion_drive)

            melodic_wave = (
                0.72 * math.sin(melody_phase)
                + 0.28 * math.sin(1.83 * melody_phase - 0.8)
            )
            support_wave = (
                0.65 * math.sin(phase - 0.4)
                + 0.35 * math.sin(0.52 * phase + 1.2)
            )

            x_amp    = DANCE_X_AMP  * (0.20 + 0.32 * motion_drive + 0.35 * melody_drive)
            y_amp    = DANCE_Y_AMP  * (0.04 + 0.06 * _clamp(intensity, 0.0, 1.0))
            tilt_amp = DANCE_TILT   * (0.18 + 0.18 * melody_drive + 0.10 * motion_drive)

            drift_x   = x_amp * (0.58 * support_wave + 0.42 * melodic_wave + side_dir * 0.06)
            drift_y   = y_amp * math.sin(0.67 * phase - 1.1)
            target_tilt = _clamp(
                tilt_amp * (0.60 * melodic_wave + 0.40 * (drift_x / max(x_amp, 1e-6))),
                -0.62 * DANCE_TILT, 0.62 * DANCE_TILT,
            )

            x    = _smooth_toward(x,    drift_x,     dt, tau=0.24)
            y    = _smooth_toward(y,    drift_y,      dt, tau=0.16)
            tilt = _smooth_toward(tilt, target_tilt,  dt, tau=0.18)

            # ── Apply transform ────────────────────────────────────────────
            bounds_w  = FIXED_SOURCE_WIDTH  * total_scale
            bounds_h  = FIXED_SOURCE_HEIGHT * total_scale
            cx_offset = (bounds_w - FIXED_SOURCE_WIDTH)  / 2.0
            cy_offset = (bounds_h - FIXED_SOURCE_HEIGHT) / 2.0

            self._set_transform(
                pos_x    = BASS_PADDING_X + x - cx_offset,
                pos_y    = BASS_PADDING_Y + y - cy_offset,
                rotation = tilt,
                bounds_w = bounds_w,
                bounds_h = bounds_h,
            )
            self._stop.wait(ANIM_INTERVAL)

        if self._stop.is_set():
            return

        self._animate_jump(entering=False)
        self._finish_clean()

    # ── Jump animation ─────────────────────────────────────────────────────────

    def _animate_jump(self, *, entering: bool) -> None:
        t0      = time.monotonic()
        rest_y  = float(BASS_PADDING_Y)
        start_y = _OFFSCREEN_Y if entering else rest_y
        end_y   = rest_y      if entering else _OFFSCREEN_Y

        while not self._stop.is_set():
            elapsed  = time.monotonic() - t0
            progress = min(elapsed / JUMP_DURATION, 1.0)
            eased    = _ease_out(progress, JUMP_EASE_POWER) if entering else _ease_in(progress, JUMP_EASE_POWER)
            pos_y    = start_y + (end_y - start_y) * eased

            self._set_transform(
                pos_x    = float(BASS_PADDING_X),
                pos_y    = pos_y,
                rotation = 0.0,
                bounds_w = float(FIXED_SOURCE_WIDTH),
                bounds_h = float(FIXED_SOURCE_HEIGHT),
            )
            if progress >= 1.0:
                break
            self._stop.wait(ANIM_INTERVAL)

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _finish_clean(self) -> None:
        self._detector.stop()
        self._remove_mask()
        self._reset_transform()

    def _set_transform(
        self,
        pos_x:    float,
        pos_y:    float,
        rotation: float,
        bounds_w: float,
        bounds_h: float,
    ) -> None:
        try:
            obs.set_source_transform_by_id(
                SCENE,
                self._get_item_id(),
                {
                    "boundsType":   _BOUNDS_TYPE,
                    "boundsWidth":  bounds_w,
                    "boundsHeight": bounds_h,
                    "positionX":    pos_x,
                    "positionY":    pos_y,
                    "rotation":     rotation,
                },
            )
        except Exception as exc:
            print(f"{_TAG} ⚠  Transform failed: {exc}")

    def _reset_transform(self) -> None:
        self._set_transform(
            pos_x    = float(BASS_PADDING_X),
            pos_y    = float(BASS_PADDING_Y),
            rotation = 0.0,
            bounds_w = float(FIXED_SOURCE_WIDTH),
            bounds_h = float(FIXED_SOURCE_HEIGHT),
        )

    # ── Mask filter management ─────────────────────────────────────────────────

    def _apply_mask(self) -> None:
        if not MASK_FILTER_ENABLED:
            self._mask_applied    = False
            self._disabled_filter = None
            return

        self._disabled_filter = None
        self._mask_applied    = False

        try:
            filters = obs.get_source_filters(self.source_name)
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not inspect filters for '{self.source_name}': {exc}")
            filters = []

        for f in filters:
            name = f.get("name", "")
            kind = f.get("kind", "")
            if name == MASK_FILTER_NAME:
                try:
                    obs.remove_source_filter(self.source_name, MASK_FILTER_NAME)
                except Exception:
                    pass
            elif kind in ("mask_filter", "mask_filter_v2"):
                try:
                    obs.set_source_filter_enabled(self.source_name, name, False)
                    self._disabled_filter = name
                    print(f"{_TAG} 🎭  Disabled existing mask filter '{name}' on '{self.source_name}'")
                except Exception as exc:
                    print(f"{_TAG} ⚠  Could not disable existing filter '{name}': {exc}")
                break

        try:
            obs.create_source_filter(
                self.source_name,
                MASK_FILTER_NAME,
                "mask_filter_v2",
                {
                    "type":       MASK_TYPE,
                    "image_path": str(MASK_PATH),
                    "opacity":    int(MASK_OPACITY),
                    "stretch":    bool(MASK_STRETCH),
                },
            )
            self._mask_applied = True
            print(f"{_TAG} 🎭  Mask filter created on '{self.source_name}'")
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not create mask filter on '{self.source_name}': {exc}")
            return

        try:
            obs.set_source_filter_settings(
                self.source_name,
                MASK_FILTER_NAME,
                {
                    "type":       MASK_TYPE,
                    "image_path": str(MASK_PATH),
                    "opacity":    int(MASK_OPACITY),
                    "stretch":    bool(MASK_STRETCH),
                },
            )
            print(f"{_TAG} 🎭  Mask opacity set to {int(MASK_OPACITY)}")
        except Exception as exc:
            print(f"{_TAG} ⚠  Raw opacity push failed: {exc}")

    def _remove_mask(self) -> None:
        if not MASK_FILTER_ENABLED:
            return

        if getattr(self, "_mask_applied", False):
            try:
                obs.remove_source_filter(self.source_name, MASK_FILTER_NAME)
                self._mask_applied = False
                print(f"{_TAG} 🎭  Mask filter removed from '{self.source_name}'")
            except Exception as exc:
                print(f"{_TAG} ⚠  Could not remove mask filter from '{self.source_name}': {exc}")

        if self._disabled_filter is not None:
            try:
                obs.set_source_filter_enabled(self.source_name, self._disabled_filter, True)
                print(f"{_TAG} 🎭  Re-enabled filter '{self._disabled_filter}' on '{self.source_name}'")
            except Exception as exc:
                print(f"{_TAG} ⚠  Could not re-enable filter '{self._disabled_filter}': {exc}")
            self._disabled_filter = None
from __future__ import annotations

import math
import threading
import time
from pathlib import Path

import obs
from obs import get_scene_item_id

from .bass_detector import BassDetector
from .config import (
    ANIM_INTERVAL,
    BASS_HIGH_HZ,
    BASS_LOW_HZ,
    BASS_PADDING_X,
    BASS_PADDING_Y,
    BASS_SMOOTHING,
    BASS_THRESHOLD,
    CANVAS_HEIGHT,
    DANCE_TILT,
    DANCE_X_AMP,
    DANCE_Y_AMP,
    FIXED_SOURCE_HEIGHT,
    FIXED_SOURCE_WIDTH,
    JUMP_DURATION,
    JUMP_EASE_POWER,
    MASK_FILTER_ENABLED,
    MASK_FILTER_NAME,
    MASK_OPACITY,
    MASK_PATH,
    MASK_STRETCH,
    MASK_TYPE,
    ONSET_COOLDOWN,
    ONSET_MIN_LEVEL,
    ONSET_RATIO,
    SCENE,
)

_TAG = "[specific_song]"
_BOUNDS_TYPE = "OBS_BOUNDS_SCALE_INNER"
_OFFSCREEN_Y = float(CANVAS_HEIGHT + FIXED_SOURCE_HEIGHT + 20)

# Standard practice for music-reactive motion:
#   • sustained body motion follows overall musical presence
#   • large accents come from transient/onset signals
#   • strict sub-bass hits add a separate big punch layer
#   • position and tilt are mostly driven by mid/melody, not only bass

_GROOVE_SCALE_IDLE = 1.00
_GROOVE_SCALE_MAX = 1.18
_GROOVE_TAU_UP = 0.032
_GROOVE_TAU_DOWN = 0.110

_BEAT_PUNCH = 1.12
_BEAT_DECAY_TAU = 0.18
_OOMPH_PEAK_SCALE = 1.28
_OOMPH_DECAY_TAU = 0.11

_TILT_TAU = 0.15
_X_TAU = 0.22
_Y_TAU = 0.18


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
    def __init__(
        self,
        source_name: str,
        audio_file: Path | None = None,
        *,
        label: str | None = None,
    ) -> None:
        self.source_name = source_name
        self.label = label or source_name
        self._audio_file = audio_file
        self._scene_item_id: int | None = None
        self._detector = BassDetector(
            audio_file=audio_file,
            bass_low_hz=BASS_LOW_HZ,
            bass_high_hz=BASS_HIGH_HZ,
            smoothing=BASS_SMOOTHING,
            onset_ratio=ONSET_RATIO,
            onset_min_level=ONSET_MIN_LEVEL,
            onset_cooldown=ONSET_COOLDOWN,
        )
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._exit_requested = threading.Event()
        self._disabled_filter: str | None = None
        self._mask_applied = False

    def preload(self) -> None:
        """Decode audio file into memory before start() is called.
        Call this before showing the OBS source for the tightest sync."""
        self._detector.preload()

    def _get_item_id(self) -> int:
        if self._scene_item_id is None:
            self._scene_item_id = get_scene_item_id(SCENE, self.source_name)
        return self._scene_item_id

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
        print(f"{_TAG} visualizer started for '{self.label}'")

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
        print(f"{_TAG} visualizer stopped for '{self.label}'")

    def _loop(self) -> None:
        self._animate_jump(entering=True)
        if self._stop.is_set():
            self._finish_clean()
            return

        phase = 0.0
        melody_phase = 0.0
        x = 0.0
        y = 0.0
        tilt = 0.0
        groove_scale = 1.0
        beat_scale = 1.0
        oomph_scale = 1.0
        side_dir = 1.0
        last_t = time.monotonic()

        while not self._stop.is_set() and not self._exit_requested.is_set():
            now = time.monotonic()
            dt = max(1e-4, now - last_t)
            last_t = now

            bass = self._detector.get_level()
            motion = self._detector.get_motion()
            intensity = self._detector.get_intensity()
            melody = self._detector.get_melody()
            presence = self._detector.get_presence()
            transient = self._detector.get_transient()

            bass_drive = _clamp((bass - BASS_THRESHOLD) / max(1.0 - BASS_THRESHOLD, 1e-6), 0.0, 1.0)
            motion_drive = _clamp(motion, 0.0, 1.0)
            melody_drive = _clamp(melody, 0.0, 1.0)
            presence_drive = _clamp(presence, 0.0, 1.0)
            transient_drive = _clamp(transient, 0.0, 1.0)
            intensity_drive = _clamp(intensity, 0.0, 1.0)

            if self._detector.consume_beat():
                beat_scale = max(beat_scale, _BEAT_PUNCH + 0.06 * transient_drive)
            if self._detector.consume_oomph():
                oomph_scale = _OOMPH_PEAK_SCALE + 0.10 * bass_drive
                side_dir *= -1.0

            beat_scale = 1.0 + (beat_scale - 1.0) * math.exp(-dt / _BEAT_DECAY_TAU)
            oomph_scale = 1.0 + (oomph_scale - 1.0) * math.exp(-dt / _OOMPH_DECAY_TAU)

            # Groove scale: driven by the full presence blend so that a quiet
            # bass section with active melody still has visible motion.
            groove_target = (
                _GROOVE_SCALE_IDLE
                + 0.07 * presence_drive   # all-band weighted blend
                + 0.05 * melody_drive     # explicit melody lift
                + 0.04 * motion_drive     # mid-range groove lift
                + 0.03 * bass_drive       # bass adds a bit on top
                + 0.02 * transient_drive
            )
            groove_target = min(groove_target, _GROOVE_SCALE_MAX)
            tau_groove = _GROOVE_TAU_UP if groove_target > groove_scale else _GROOVE_TAU_DOWN
            groove_scale = _smooth_toward(groove_scale, groove_target, dt, tau_groove)
            total_scale = groove_scale * beat_scale * oomph_scale

            phase += dt * (
                0.45
                + 0.35 * motion_drive
                + 0.35 * presence_drive
                + 0.18 * intensity_drive
            )
            melody_phase += dt * (
                0.90
                + 1.65 * melody_drive
                + 0.50 * transient_drive
                + 0.25 * motion_drive
            )

            melodic_wave = (
                0.62 * math.sin(melody_phase)
                + 0.24 * math.sin(1.91 * melody_phase - 0.75)
                + 0.14 * math.sin(2.73 * melody_phase + 1.1)
            )
            groove_wave = (
                0.56 * math.sin(phase - 0.3)
                + 0.29 * math.sin(0.55 * phase + 1.35)
                + 0.15 * math.sin(1.42 * phase - 1.0)
            )

            x_amp = DANCE_X_AMP * (
                0.16 + 0.30 * motion_drive + 0.32 * melody_drive + 0.12 * transient_drive
            )
            y_amp = DANCE_Y_AMP * (
                0.03 + 0.08 * presence_drive + 0.06 * transient_drive + 0.04 * bass_drive
            )
            tilt_amp = DANCE_TILT * (
                0.14 + 0.22 * melody_drive + 0.12 * motion_drive + 0.12 * transient_drive
            )

            drift_x = x_amp * (
                0.46 * groove_wave
                + 0.44 * melodic_wave
                + 0.10 * side_dir
            )
            drift_y = y_amp * (
                0.62 * math.sin(0.72 * phase - 1.0)
                + 0.38 * math.sin(0.68 * melody_phase + 0.35)
            )
            target_tilt = _clamp(
                tilt_amp * (0.58 * melodic_wave + 0.26 * groove_wave + 0.16 * transient_drive * side_dir),
                -0.70 * DANCE_TILT,
                0.70 * DANCE_TILT,
            )

            x = _smooth_toward(x, drift_x, dt, _X_TAU)
            y = _smooth_toward(y, drift_y, dt, _Y_TAU)
            tilt = _smooth_toward(tilt, target_tilt, dt, _TILT_TAU)

            bounds_w = FIXED_SOURCE_WIDTH * total_scale
            bounds_h = FIXED_SOURCE_HEIGHT * total_scale
            cx_offset = (bounds_w - FIXED_SOURCE_WIDTH) / 2.0
            cy_offset = (bounds_h - FIXED_SOURCE_HEIGHT) / 2.0

            self._set_transform(
                pos_x=BASS_PADDING_X + x - cx_offset,
                pos_y=BASS_PADDING_Y + y - cy_offset,
                rotation=tilt,
                bounds_w=bounds_w,
                bounds_h=bounds_h,
            )
            self._stop.wait(ANIM_INTERVAL)

        if self._stop.is_set():
            return

        self._animate_jump(entering=False)
        self._finish_clean()

    def _animate_jump(self, *, entering: bool) -> None:
        t0 = time.monotonic()
        rest_y = float(BASS_PADDING_Y)
        start_y = _OFFSCREEN_Y if entering else rest_y
        end_y = rest_y if entering else _OFFSCREEN_Y

        while not self._stop.is_set():
            elapsed = time.monotonic() - t0
            progress = min(elapsed / JUMP_DURATION, 1.0)
            eased = _ease_out(progress, JUMP_EASE_POWER) if entering else _ease_in(progress, JUMP_EASE_POWER)
            pos_y = start_y + (end_y - start_y) * eased

            self._set_transform(
                pos_x=float(BASS_PADDING_X),
                pos_y=pos_y,
                rotation=0.0,
                bounds_w=float(FIXED_SOURCE_WIDTH),
                bounds_h=float(FIXED_SOURCE_HEIGHT),
            )
            if progress >= 1.0:
                break
            self._stop.wait(ANIM_INTERVAL)

    def _finish_clean(self) -> None:
        self._detector.stop()
        self._remove_mask()
        self._reset_transform()

    def _set_transform(
        self,
        pos_x: float,
        pos_y: float,
        rotation: float,
        bounds_w: float,
        bounds_h: float,
    ) -> None:
        try:
            obs.set_source_transform_by_id(
                SCENE,
                self._get_item_id(),
                {
                    "boundsType": _BOUNDS_TYPE,
                    "boundsWidth": bounds_w,
                    "boundsHeight": bounds_h,
                    "positionX": pos_x,
                    "positionY": pos_y,
                    "rotation": rotation,
                },
            )
        except Exception as exc:
            print(f"{_TAG} transform failed: {exc}")

    def _reset_transform(self) -> None:
        self._set_transform(
            pos_x=float(BASS_PADDING_X),
            pos_y=float(BASS_PADDING_Y),
            rotation=0.0,
            bounds_w=float(FIXED_SOURCE_WIDTH),
            bounds_h=float(FIXED_SOURCE_HEIGHT),
        )

    def _apply_mask(self) -> None:
        if not MASK_FILTER_ENABLED:
            self._mask_applied = False
            self._disabled_filter = None
            return

        self._disabled_filter = None
        self._mask_applied = False

        try:
            filters = obs.get_source_filters(self.source_name)
        except Exception as exc:
            print(f"{_TAG} could not inspect filters for '{self.source_name}': {exc}")
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
                except Exception as exc:
                    print(f"{_TAG} could not disable existing filter '{name}': {exc}")
                break

        try:
            obs.create_source_filter(
                self.source_name,
                MASK_FILTER_NAME,
                "mask_filter_v2",
                {
                    "type": MASK_TYPE,
                    "image_path": str(MASK_PATH),
                    "opacity": int(MASK_OPACITY),
                    "stretch": bool(MASK_STRETCH),
                },
            )
            self._mask_applied = True
        except Exception as exc:
            print(f"{_TAG} could not create mask filter on '{self.source_name}': {exc}")
            return

        try:
            obs.set_source_filter_settings(
                self.source_name,
                MASK_FILTER_NAME,
                {
                    "type": MASK_TYPE,
                    "image_path": str(MASK_PATH),
                    "opacity": int(MASK_OPACITY),
                    "stretch": bool(MASK_STRETCH),
                },
            )
        except Exception as exc:
            print(f"{_TAG} raw opacity push failed: {exc}")

    def _remove_mask(self) -> None:
        if not MASK_FILTER_ENABLED:
            return

        if getattr(self, "_mask_applied", False):
            try:
                obs.remove_source_filter(self.source_name, MASK_FILTER_NAME)
                self._mask_applied = False
            except Exception as exc:
                print(f"{_TAG} could not remove mask filter from '{self.source_name}': {exc}")

        if self._disabled_filter is not None:
            try:
                obs.set_source_filter_enabled(self.source_name, self._disabled_filter, True)
            except Exception as exc:
                print(f"{_TAG} could not re-enable filter '{self._disabled_filter}': {exc}")
            self._disabled_filter = None

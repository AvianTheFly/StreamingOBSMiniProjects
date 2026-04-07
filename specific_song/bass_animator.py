# specific_song/bass_animator.py
#
# Calmer audio-driven motion for OBS scene items, with faster bass punch.
#
# Design goals:
#   • hard bass hits expand quickly and a bit larger
#   • release is quicker, so the object does not feel syrupy
#   • melody adds gentle sway / tilt phrasing without making the whole thing dizzy
#   • whole-object motion stays bounded and damped

from __future__ import annotations

import math
import threading
import time

import obs
from obs.client import get_obs

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
from .bass_detector import BassDetector

_TAG = "[specific_song]"
_BOUNDS_TYPE = "OBS_BOUNDS_SCALE_INNER"
_OFFSCREEN_Y = float(CANVAS_HEIGHT + FIXED_SOURCE_HEIGHT + 20)


def _extract_field(obj, *names):
    if obj is None:
        return None
    if isinstance(obj, dict):
        for name in names:
            if name in obj:
                return obj[name]
        d = obj.get("responseData") or obj.get("response_data")
        if isinstance(d, dict):
            for name in names:
                if name in d:
                    return d[name]
        return None
    for name in names:
        if hasattr(obj, name):
            return getattr(obj, name)
    d = getattr(obj, "__dict__", None)
    if isinstance(d, dict):
        for name in names:
            if name in d:
                return d[name]
        rd = d.get("responseData") or d.get("response_data")
        if isinstance(rd, dict):
            for name in names:
                if name in rd:
                    return rd[name]
    return None


def _get_scene_item_id(scene: str, source_name: str) -> int:
    obs_client = get_obs()
    try:
        resp = obs_client.send("GetSceneItemId", {"sceneName": scene, "sourceName": source_name})
        item_id = _extract_field(resp, "scene_item_id", "sceneItemId")
        if item_id is not None:
            return int(item_id)
    except Exception:
        pass
    try:
        resp = obs_client.send("GetSceneItemList", {"sceneName": scene})
        items = _extract_field(resp, "scene_items", "sceneItems") or []
        for item in items:
            if isinstance(item, dict):
                name = item.get("sourceName") or item.get("source_name")
                iid = item.get("sceneItemId") or item.get("scene_item_id")
            else:
                name = _extract_field(item, "sourceName", "source_name")
                iid = _extract_field(item, "sceneItemId", "scene_item_id")
            if name == source_name and iid is not None:
                return int(iid)
    except Exception:
        pass
    raise RuntimeError(f"Could not resolve scene item ID for {source_name!r} in scene {scene!r}")


def _ease_out(t: float, power: int) -> float:
    return 1.0 - (1.0 - t) ** power


def _ease_in(t: float, power: int) -> float:
    return t ** power


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _smooth_toward(current: float, target: float, dt: float, tau: float) -> float:
    alpha = 1.0 - math.exp(-dt / max(tau, 1e-6))
    return current + (target - current) * alpha


def _set_filter_settings_raw(source_name: str, filter_name: str, settings: dict) -> None:
    get_obs().send(
        "SetSourceFilterSettings",
        {
            "sourceName": source_name,
            "filterName": filter_name,
            "filterSettings": settings,
            "overlay": True,
        },
    )


class BassAnimator:
    def __init__(self, source_name: str) -> None:
        self.source_name = source_name
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
        self._stop = threading.Event()
        self._exit_requested = threading.Event()
        self._disabled_filter: str | None = None

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
        pulse = 1.0
        beat_scale_impulse = 0.0
        beat_drop_impulse = 0.0
        side_impulse = 0.0
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

            bass_drive = _clamp((bass - BASS_THRESHOLD) / max(1.0 - BASS_THRESHOLD, 1e-6), 0.0, 1.0)
            motion_drive = _clamp(motion, 0.0, 1.0)
            intensity_drive = _clamp(intensity, 0.0, 1.0)
            melody_drive = _clamp(melody, 0.0, 1.0)

            if self._detector.consume_beat():
                hit = 0.45 + 0.75 * bass_drive
                beat_scale_impulse = max(beat_scale_impulse, hit)
                beat_drop_impulse = max(beat_drop_impulse, 0.20 + 0.24 * bass_drive)
                side_dir *= -1.0
                side_impulse = max(side_impulse, 0.10 + 0.14 * melody_drive)

            beat_scale_impulse *= math.exp(-dt / max(PULSE_DECAY * 0.42, 1e-6))
            beat_drop_impulse *= math.exp(-dt / max(PULSE_DECAY * 0.33, 1e-6))
            side_impulse *= math.exp(-dt / 0.60)

            phase += dt * (0.45 + 0.40 * motion_drive + 0.20 * intensity_drive)
            melody_phase += dt * (0.95 + 1.55 * melody_drive + 0.30 * motion_drive)

            # Melody phrasing: broad slow sway plus a lighter upper-mid figure.
            melodic_wave = (
                0.72 * math.sin(melody_phase)
                + 0.28 * math.sin(1.83 * melody_phase - 0.8)
            )
            support_wave = (
                0.65 * math.sin(phase - 0.4)
                + 0.35 * math.sin(0.52 * phase + 1.2)
            )

            x_amp = DANCE_X_AMP * (0.20 + 0.32 * motion_drive + 0.35 * melody_drive)
            y_amp = DANCE_Y_AMP * (0.04 + 0.06 * intensity_drive + 0.03 * melody_drive)
            tilt_amp = DANCE_TILT * (0.18 + 0.18 * melody_drive + 0.10 * motion_drive)

            drift_x = x_amp * (0.58 * support_wave + 0.42 * melodic_wave + side_dir * side_impulse)
            drift_y = y_amp * math.sin(0.67 * phase - 1.1)
            weight_y = FIXED_SOURCE_HEIGHT * 0.028 * beat_drop_impulse
            target_y = drift_y + weight_y

            drift_norm = drift_x / max(x_amp, 1e-6) if x_amp > 1e-6 else 0.0
            melodic_tilt = 0.60 * melodic_wave + 0.40 * drift_norm
            target_tilt = tilt_amp * melodic_tilt
            target_tilt = _clamp(target_tilt, -0.62 * DANCE_TILT, 0.62 * DANCE_TILT)

            x = _smooth_toward(x, drift_x, dt, tau=0.24)
            y = _smooth_toward(y, target_y, dt, tau=0.16)
            tilt = _smooth_toward(tilt, target_tilt, dt, tau=0.18)

            # Bass size: fast attack, quicker release, with harder beat overshoot.
            base_scale_span = max(BASS_MAX_SCALE - 1.0, 0.0)
            continuous_scale = 1.0 + base_scale_span * (0.08 + 0.82 * bass_drive)
            beat_overshoot = 1.0 + base_scale_span * 1.10 * beat_scale_impulse
            target_pulse = max(continuous_scale, beat_overshoot)
            pulse_tau = 0.024 if target_pulse > pulse else 0.065
            pulse = _smooth_toward(pulse, target_pulse, dt, tau=pulse_tau)

            bounds_w = FIXED_SOURCE_WIDTH * pulse
            bounds_h = FIXED_SOURCE_HEIGHT * pulse
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
            item_id = _get_scene_item_id(SCENE, self.source_name)
            get_obs().send(
                "SetSceneItemTransform",
                {
                    "sceneName": SCENE,
                    "sceneItemId": item_id,
                    "sceneItemTransform": {
                        "boundsType": _BOUNDS_TYPE,
                        "boundsWidth": bounds_w,
                        "boundsHeight": bounds_h,
                        "positionX": pos_x,
                        "positionY": pos_y,
                        "rotation": rotation,
                    },
                },
            )
        except Exception as exc:
            print(f"{_TAG} ⚠  Transform failed: {exc}")

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
                    "type": MASK_TYPE,
                    "image_path": str(MASK_PATH),
                    "opacity": int(MASK_OPACITY),
                    "stretch": bool(MASK_STRETCH),
                },
            )
            self._mask_applied = True
            print(f"{_TAG} 🎭  Mask filter created on '{self.source_name}'")
        except Exception as exc:
            print(f"{_TAG} ⚠  Could not create mask filter on '{self.source_name}': {exc}")
            return

        try:
            _set_filter_settings_raw(
                self.source_name,
                MASK_FILTER_NAME,
                {
                    "type": MASK_TYPE,
                    "image_path": str(MASK_PATH),
                    "opacity": int(MASK_OPACITY),
                    "stretch": bool(MASK_STRETCH),
                },
            )
            print(f"{_TAG} 🎭  Mask opacity set to {int(MASK_OPACITY)} via raw send")
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

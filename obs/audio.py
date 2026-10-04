"""OBS audio capabilities, levels, monitoring, mute, and track routing."""
from __future__ import annotations

import math

from .client import get_obs, OBSUnavailable


def _is_unsupported_audio_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "returned code 604" in text or "does not support audio" in text

def get_input_audio_monitor_type(input_name: str):
    """Return the OBS audio monitor type for an input, or None on failure."""
    try:
        return get_obs().get_input_audio_monitor_type(input_name).monitor_type
    except OBSUnavailable:
        return None
    except Exception as e:
        if _is_unsupported_audio_error(e):
            return None
        print(f"[OBS] Could not get monitor type for '{input_name}': {e}")
        return None

def set_input_audio_monitor_type(input_name: str, monitor_type: str) -> None:
    """Set audio monitor type for an input.

    Valid values in OBS websocket v5 include:
      - OBS_MONITORING_TYPE_NONE
      - OBS_MONITORING_TYPE_MONITOR_ONLY
      - OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT
    """
    try:
        get_obs().set_input_audio_monitor_type(input_name, monitor_type)
    except Exception as e:
        if _is_unsupported_audio_error(e):
            return
        raise

def get_input_volume(input_name: str):
    """Return {'mul': float|None, 'db': float|None} for an input, or None on failure."""
    try:
        r = get_obs().get_input_volume(input_name)
        return {
            "mul": getattr(r, "input_volume_mul", None),
            "db": getattr(r, "input_volume_db", None),
        }
    except OBSUnavailable:
        return None
    except Exception as e:
        if _is_unsupported_audio_error(e):
            return None
        print(f"[OBS] Could not get volume for '{input_name}': {e}")
        return None

def set_input_volume_db(input_name: str, db: float) -> None:
    """Set an input's volume in dB.

    obsws-python's set_input_volume takes positional args:
      set_input_volume(inputName, inputVolumeMul, inputVolumeDb)
    Pass None for mul to leave it unset.
    """
    value = float(db)
    if not math.isfinite(value):
        raise ValueError('Volume must be a finite number')
    get_obs().set_input_volume(input_name, None, value)

def ensure_input_on_stream_track(input_name: str) -> int:
    """Include the active program audio track without resetting other tracks."""
    client = get_obs()
    mode = client.get_profile_parameter("Output", "Mode").parameter_value
    track = 1
    if str(mode).lower() == "advanced":
        track = int(client.get_profile_parameter("AdvOut", "TrackIndex").parameter_value)
    if track not in range(1, 7):
        raise ValueError(f"Invalid OBS streaming audio track: {track}")
    tracks = dict(client.get_input_audio_tracks(input_name).input_audio_tracks)
    if not tracks.get(str(track), False):
        tracks[str(track)] = True
        client.set_input_audio_tracks(input_name, tracks)
    return track

def set_input_volume_mul(input_name: str, mul: float) -> None:
    """Set an input's volume as a multiplier.

    obsws-python's set_input_volume takes positional args:
      set_input_volume(inputName, inputVolumeMul, inputVolumeDb)
    Pass None for db to leave it unset.
    """
    get_obs().set_input_volume(input_name, float(mul), None)

def get_input_list() -> list[str]:
    """Return a list of all OBS input names."""
    try:
        resp = get_obs().get_input_list()
        names: list[str] = []

        for item in getattr(resp, "inputs", []):
            if isinstance(item, dict):
                name = item.get("inputName") or item.get("input_name")
            else:
                name = getattr(item, "inputName", None) or getattr(item, "input_name", None)

            if name:
                names.append(str(name))

        return names
    except Exception as e:
        print(f"[OBS] Could not get input list: {e}")
        return []

def set_input_mute(source: str, muted: bool) -> None:
    """Mute or unmute an audio input source.

    muted=True  → source is silenced (no audio to stream/monitor).
    muted=False → source is restored to normal.
    """
    try:
        get_obs().set_input_mute(source, muted)
    except Exception as e:
        if _is_unsupported_audio_error(e):
            return
        print(f"[OBS] set_input_mute failed for '{source}' (muted={muted}): {e}")

def get_input_mute(source: str) -> bool | None:
    """Return True if the source is muted, False if not, None on error."""
    try:
        resp = get_obs().get_input_mute(source)
        return resp.input_muted
    except OBSUnavailable:
        return None
    except Exception as e:
        if _is_unsupported_audio_error(e):
            return None
        print(f"[OBS] get_input_mute failed for '{source}': {e}")
        return None

def set_desktop_audio_volume(level_percent: float, input_name: str | None = None) -> None:
    """
    Set an OBS Audio Mixer slider volume by name.

    level_percent: Target volume as a percentage (0–100).
    input_name:    Exact OBS input name. If None, auto-detects 'Desktop Audio'.
    """
    obs_client = get_obs()

    if input_name is None:
        inputs = get_input_list()
        print(f"[OBS] Available inputs ({len(inputs)}):")
        for inp in inputs:
            print(f"  • {inp!r}")

        # Heuristic: pick first match on common names
        for kw in ["desktop audio", "speaker"]:
            for inp in inputs:
                if kw in inp.lower():
                    input_name = inp
                    break
            if input_name:
                break

        if input_name is None:
            print("[OBS] Could not auto-detect desktop audio — falling back to the first input.")
            input_name = inputs[0] if inputs else None
            if input_name is None:
                print("[OBS] No inputs found, cannot set volume.")
                return

    try:
        volume_mul = level_percent / 100.0
        obs_client.set_input_volume(input_name, volume_mul, None)
        print(f"[OBS] Input {input_name!r} volume → {level_percent:.0f}%")
    except Exception as e:
        print(f"[OBS] Failed to set volume for {input_name!r}: {e}")

def set_input_audio_tracks(source: str, tracks: dict) -> None:
    """
    Set which OBS audio output tracks an input is sent to.

    tracks: mapping of track-number string → bool, e.g.:
        {"1": False, "2": True, "3": True, "4": True, "5": True, "6": True}

    Typical use — route a media source to tracks 2-6 only (exclude track 1):
        obs.set_input_audio_tracks(source, {"1": False, "2": True, ..., "6": True})
    """
    get_obs().send("SetInputAudioTracks", {
        "inputName": source,
        "inputAudioTracks": tracks,
    })

def configure_input_audio(
    input_name: str,
    monitor_type: str | None = None,
    volume_db: float | None = None,
    volume_mul: float | None = None,
) -> None:
    """Apply monitor/output routing and volume in one call."""
    if monitor_type is not None:
        try:
            set_input_audio_monitor_type(input_name, monitor_type)
        except Exception as e:
            print(f"[OBS] set_input_audio_monitor_type failed for '{input_name}': {e}")

    if volume_db is not None and volume_mul is not None:
        print(f"[OBS] Both volume_db and volume_mul were supplied for '{input_name}'. Using volume_db.")
        volume_mul = None

    if volume_db is not None:
        try:
            set_input_volume_db(input_name, volume_db)
        except Exception as e:
            print(f"[OBS] set_input_volume_db failed for '{input_name}': {e}")
    elif volume_mul is not None:
        try:
            set_input_volume_mul(input_name, volume_mul)
        except Exception as e:
            print(f"[OBS] set_input_volume_mul failed for '{input_name}': {e}")

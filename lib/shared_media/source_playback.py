"""Load a media source and confirm playback; admission belongs to media_startup."""
from __future__ import annotations
from pathlib import Path
import time
import obs
from .media_startup import media_startup
_MEDIA_STATE_PLAYING = "OBS_MEDIA_STATE_PLAYING"
_MEDIA_STATE_STARTING = {"OBS_MEDIA_STATE_OPENING", "OBS_MEDIA_STATE_BUFFERING", "OBS_MEDIA_STATE_RESTARTING"}


def _get_obs_input_settings(source_name: str) -> dict:
    client = obs.get_obs()
    try:
        resp = client.send("GetInputSettings", {"inputName": source_name}, raw=True)
    except TypeError:
        resp = client.send("GetInputSettings", {"inputName": source_name})
    except Exception:
        return {}

    if isinstance(resp, dict):
        settings = resp.get("inputSettings") or resp.get("input_settings") or {}
        return settings if isinstance(settings, dict) else {}

    settings = getattr(resp, "input_settings", None) or getattr(resp, "inputSettings", None) or {}
    return settings if isinstance(settings, dict) else {}

def _wait_for_media_source_file(source_name: str, filepath: Path, timeout: float = 1.0,
                                *, cancelled=lambda: False) -> bool:
    try:
        expected = str(Path(filepath).resolve()).casefold()
    except Exception:
        expected = str(filepath).casefold()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if cancelled():
            return False
        settings = _get_obs_input_settings(source_name)
        current = str(settings.get("local_file") or "").strip()
        if current:
            try:
                current = str(Path(current).resolve()).casefold()
            except Exception:
                current = current.casefold()
            if current == expected:
                return True
        time.sleep(0.05)
    return False

def _start_media_source_playback(
    *, scene: str, source_name: str, filepath: Path, start_timeout: float,
    swap_settle_ms: int = 0, cancelled=lambda: False,
) -> bool:
    with media_startup(source_name, cancelled=cancelled, timeout=start_timeout):
        if not _start_media_source_uncoordinated(
            scene=scene, source_name=source_name, filepath=filepath,
            start_timeout=start_timeout, swap_settle_ms=swap_settle_ms,
            cancelled=cancelled,
        ):
            raise RuntimeError(f"OBS did not start '{source_name}'")
    return True

def _start_media_source_uncoordinated(
    *,
    scene: str,
    source_name: str,
    filepath: Path,
    start_timeout: float,
    swap_settle_ms: int = 0,
    cancelled=lambda: False,
) -> bool:
    if cancelled():
        return False
    try:
        obs.stop_media(source_name)
    except Exception:
        pass
    try:
        obs.hide_source(scene, source_name)
    except Exception:
        pass
    time.sleep(0.03)

    if cancelled():
        return False

    same_file = not obs.set_media_source_file(source_name, filepath, managed_decode=True)
    file_applied = _wait_for_media_source_file(source_name, filepath,
        timeout=min(2.0, max(0.5, start_timeout)), cancelled=cancelled)
    if not file_applied or cancelled():
        return False
    # The changed file starts automatically with restart_on_activate=False.
    try:
        obs.show_source(scene, source_name)
    except Exception:
        pass
    if swap_settle_ms > 0:
        time.sleep(max(0.0, float(swap_settle_ms) / 1000.0))
    else:
        time.sleep(0.03)
    if cancelled():
        return False
    try:
        if same_file:
            obs.restart_media(source_name)
    except Exception:
        pass

    deadline = time.monotonic() + max(1.0, start_timeout)
    saw_progress = False
    while time.monotonic() < deadline:
        if cancelled():
            return False
        status = obs.get_media_status(source_name) or {}
        state = status.get("state")
        cursor_ms = status.get("cursor_ms")
        if cursor_ms is not None:
            try:
                saw_progress = saw_progress or float(cursor_ms) > 0.0
            except (TypeError, ValueError):
                pass
        if state == _MEDIA_STATE_PLAYING:
            return True
        if saw_progress:
            return True
        if state in _MEDIA_STATE_STARTING:
            time.sleep(0.05)
            continue
        time.sleep(0.08)

    return False

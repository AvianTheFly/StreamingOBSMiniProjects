"""OBS streaming, recording, replay capture, and stream metadata."""
from __future__ import annotations

import threading
import time

from .client import get_obs


def start_stream()  -> None: get_obs().start_stream()

def stop_stream()   -> None: get_obs().stop_stream()

def start_record()  -> None: get_obs().start_record()

def stop_record()   -> None: get_obs().stop_record()

def get_stream_status() -> dict:
    r = get_obs().get_stream_status()
    return {"active": r.output_active, "bytes": getattr(r, "output_bytes", None)}

def save_replay_buffer_and_wait(timeout: float = 15.0, *, on_save_requested=None) -> str | None:
    """
    Trigger OBS to save the replay buffer, block until OBS fires the
    ReplayBufferSaved event (meaning the file is fully written), and return
    the absolute path to the saved file.

    Returns None if the event doesn't arrive within `timeout` seconds.
    """
    from obsws_python import EventClient  # noqa: PLC0415
    from .obs_config import OBS_HOST as HOST, OBS_PORT as PORT, OBS_PASSWORD as PASSWORD

    saved_event = threading.Event()
    path_holder: list[str] = []

    def on_replay_buffer_saved(data) -> None:
        path = getattr(data, "saved_replay_path", "") or ""
        if path:
            path_holder.append(path)
            saved_event.set()

    ev = EventClient(host=HOST, port=PORT, password=PASSWORD)
    ev.callback.register(on_replay_buffer_saved)

    try:
        if on_save_requested is not None:
            on_save_requested(time.time())
        get_obs().save_replay_buffer()
        got_it = saved_event.wait(timeout=timeout)
    finally:
        try:
            ev.disconnect()
        except Exception:
            pass

    return path_holder[0] if (got_it and path_holder) else None

def get_stream_title() -> str | None:
    """Return the current stream title from OBS stream service settings."""
    try:
        resp = get_obs().send("GetStreamServiceSettings", {})
        settings = getattr(resp, "stream_service_settings", {})
        if isinstance(settings, dict):
            return settings.get("title")
        # obsws-python may return a dataclass
        return getattr(settings, "data", {}).get("title") if hasattr(settings, "data") else None
    except Exception as e:
        print(f"[OBS] get_stream_title failed: {e}")
    return None

def set_stream_title(title: str) -> None:
    """Set the stream title shown on Twitch/YouTube."""
    obs_client = get_obs()
    try:
        resp = obs_client.send("GetStreamServiceSettings", {})
        settings = getattr(resp, "stream_service_settings", {})
        service_type = getattr(resp, "stream_service_type", "rtmp_common")

        if isinstance(settings, dict):
            settings["title"] = title
            obs_client.send("SetStreamServiceSettings", {
                "streamServiceType": service_type,
                "streamServiceSettings": settings,
            })
            print(f"[OBS] Stream title → {title!r}")
        else:
            print(f"[OBS] set_stream_title: unexpected settings type {type(settings).__name__!r}")
    except Exception as e:
        print(f"[OBS] set_stream_title failed: {e}")

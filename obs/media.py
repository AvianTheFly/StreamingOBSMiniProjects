"""OBS media transport: load, configure, control, wait, and park sources."""
from __future__ import annotations

import time
from pathlib import Path

from .client import get_obs
from .sources import hide_source


def get_media_state(source: str) -> str | None:
    try:
        result = get_obs().get_media_input_status(source)
        return getattr(result, "media_state", None)
    except Exception as e:
        print(f"[OBS] Could not get media state for '{source}': {e}")
        return None

def get_media_status(source: str) -> dict:
    """Return media state details for older callers."""
    try:
        result = get_obs().get_media_input_status(source)
        return {
            "state": getattr(result, "media_state", None),
            "cursor_ms": getattr(result, "media_cursor", None),
            "duration_ms": getattr(result, "media_duration", None),
        }
    except Exception as e:
        print(f"[OBS] Could not get media status for '{source}': {e}")
        return {}

def stop_media(source: str) -> None:
    """Stop a media source."""
    try:
        get_obs().trigger_media_input_action(source, "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP")
    except Exception as e:
        print(f"[OBS] stop_media failed for '{source}': {e}")

def restart_media(source: str) -> None:
    """Seek a media source back to the beginning and play it."""
    try:
        get_obs().trigger_media_input_action(source, "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART")
    except Exception as e:
        print(f"[OBS] restart_media failed for '{source}': {e}")

def pause_media(source: str) -> None:
    """Pause a media source at its current position."""
    try:
        get_obs().trigger_media_input_action(source, "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE")
    except Exception as e:
        print(f"[OBS] pause_media failed for '{source}': {e}")

def play_media(source: str) -> None:
    """Resume a paused media source from its current position."""
    try:
        get_obs().trigger_media_input_action(source, "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY")
    except Exception as e:
        print(f"[OBS] play_media failed for '{source}': {e}")

def wait_for_media_end(
    source: str,
    poll_interval: float = 0.10,
    start_timeout: float = 5.0,
    total_timeout: float = 600.0,
    cancelled=lambda: False,
    allowed=None,
) -> bool:
    """
    Block until a media source finishes playing.
    Returns True if it ended cleanly, False on cancellation, timeout or never-started.
    """
    playing_state = "OBS_MEDIA_STATE_PLAYING"
    end_states = {"OBS_MEDIA_STATE_STOPPED", "OBS_MEDIA_STATE_ENDED", "OBS_MEDIA_STATE_NONE"}

    started = False
    t0 = time.monotonic()
    paused_by_gate = False
    previous_poll = t0

    while True:
        if cancelled():
            return False
        state = get_media_state(source)
        now = time.monotonic()
        if allowed is not None and not allowed():
            if not paused_by_gate:
                pause_media(source)
                paused_by_gate = True
            t0 += now - previous_poll
            previous_poll = now
            time.sleep(poll_interval)
            continue
        if paused_by_gate:
            play_media(source)
            paused_by_gate = False
        if state == 'OBS_MEDIA_STATE_PAUSED':
            t0 += now - previous_poll
        previous_poll = now
        elapsed = now - t0

        if state == playing_state:
            started = True
        if started and state in end_states:
            return True
        if not started and elapsed > start_timeout:
            print(f"[OBS] '{source}' never started within {start_timeout}s")
            return False
        if elapsed > total_timeout:
            print(f"[OBS] Timed out waiting for '{source}'")
            return False

        time.sleep(poll_interval)

def create_media_source(scene: str, source_name: str, filepath: str | Path, hidden: bool = True) -> bool:
    """
    Add an ffmpeg_source (mp4/audio file) to a scene.

    Returns:
        True  -> a new OBS input was actually created
        False -> the input already existed or creation failed
    """
    settings = {
        "local_file": str(filepath),
        "is_local_file": True,
        "restart_on_activate": True,
        "close_when_inactive": True,
        "hw_decode": True,
        "looping": False,
    }
    obs = get_obs()

    # Older obsws-python signature
    try:
        obs.create_input(scene, source_name, "ffmpeg_source", settings, not hidden)
        return True
    except TypeError:
        pass
    except Exception as e:
        if "already exists" in str(e).lower():
            return False
        print(f"[OBS] create_media_source failed (positional): {e}")
        return False

    # Newer obsws-python signature
    try:
        resp = obs.create_input(
            sceneName=scene,
            inputName=source_name,
            inputKind="ffmpeg_source",
            inputSettings=settings,
        )
        if hidden:
            try:
                obs.set_scene_item_enabled(
                    sceneName=scene,
                    sceneItemId=resp.scene_item_id,
                    sceneItemEnabled=False,
                )
            except Exception:
                pass
        return True
    except Exception as e:
        if "already exists" in str(e).lower():
            return False
        print(f"[OBS] create_media_source failed (kwargs): {e}")
        return False

def set_media_source_file(source: str, filepath: str | Path, *, managed_decode: bool = False) -> bool:
    """
    Point an ffmpeg_source (media source) input at a new local file without
    changing any other settings. OBS automatically starts a changed file when
    restart_on_activate=False, even if hidden. Do not immediately stop/restart
    it again. An unchanged file needs an explicit restart to replay it.
    Returns True if the file/decoder changed, False if already configured.
    """
    settings = {"local_file": str(filepath), "is_local_file": True}
    if managed_decode:
        from .media_decode import hardware_decode_for
        hardware = hardware_decode_for(filepath)
        if hardware is not None:
            settings['hw_decode'] = hardware
            print(f"[OBS] Loading '{Path(filepath).name}' on '{source}' ({'hardware' if hardware else 'software'} decode)")
    client = get_obs()
    current = client.get_input_settings(source).input_settings
    # OBS compares path strings literally. Avoid reopening the same file just
    # because one caller used Windows slashes and another used forward slashes.
    same_path = str(current.get('local_file') or '').replace('\\', '/').casefold() == str(filepath).replace('\\', '/').casefold()
    changes = {key: value for key, value in settings.items()
               if (not same_path if key == 'local_file' else current.get(key, True if key == 'is_local_file' else None) != value)}
    if not changes:
        return False
    client.set_input_settings(source, changes, overlay=True)
    return True

def configure_media_source_properties(
    source: str,
    *,
    restart_on_activate: bool | None = None,
    close_when_inactive: bool | None = None,
    looping: bool | None = None,
    hw_decode: bool | None = None,
    clear_on_media_end: bool | None = None,
    speed_percent: float | None = None,
) -> None:
    """
    Set behavioural properties on an ffmpeg_source input.  Only the keyword
    arguments you supply are changed; omitted ones are left as-is in OBS.

    restart_on_activate  — restart from beginning every time the source is shown
    close_when_inactive  — release the file handle when the source is hidden
    looping              — loop the media when it reaches the end
    hw_decode            — use hardware decoding when available
    clear_on_media_end   — clear the frame when media playback finishes
    speed_percent        — playback speed percentage for supported sources
    """
    settings: dict = {}
    if restart_on_activate is not None:
        settings["restart_on_activate"] = restart_on_activate
    if close_when_inactive is not None:
        settings["close_when_inactive"] = close_when_inactive
    if looping is not None:
        settings["looping"] = looping
    if hw_decode is not None:
        settings["hw_decode"] = hw_decode
    if clear_on_media_end is not None:
        settings["clear_on_media_end"] = clear_on_media_end
    if speed_percent is not None:
        settings["speed_percent"] = float(speed_percent)
    if settings:
        # Read live values so manual OBS edits are respected. Avoid invoking
        # the source update callback at all for repeated identical requests.
        client = get_obs()
        current = client.get_input_settings(source).input_settings
        changes = {key: value for key, value in settings.items()
                   if current.get(key) != value}
        if changes:
            client.set_input_settings(source, changes, overlay=True)

def park_media_source(scene: str, source: str) -> None:
    """Leave an unused managed source safe to restore on the next OBS launch.

    restart_on_activate=False allows OBS to start a local file even when hidden
    while constructing a scene collection. Both idle flags must be true.
    Playback code explicitly switches them back for an actual play request.
    """
    try:
        configure_media_source_properties(source, restart_on_activate=True, close_when_inactive=True)
    finally:
        try:
            stop_media(source)
        finally:
            hide_source(scene, source)

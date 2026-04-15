# obs/interaction.py
#
# Every OBS action any mini-project might want, in one place.
#
# Do NOT import from this file directly. Use the package instead:
#
#   from obs import show_source, hide_source, switch_scene, ...
#
# All public functions are re-exported from obs/__init__.py.

from __future__ import annotations

import json
import math
import random
import threading
import time
from pathlib import Path

from .client import get_obs


# ─────────────────────────────────────────────────────────────────────────────
#  Source visibility
# ─────────────────────────────────────────────────────────────────────────────

def _get_scene_item_id(obs, scene: str, source: str, retries: int = 3, delay: float = 0.1):
    """Get the scene item ID, retrying briefly if OBS returns None."""
    for attempt in range(1, retries + 1):
        result = obs.get_scene_item_id(scene, source)
        if result is not None and result.scene_item_id is not None:
            return result.scene_item_id
        print(f"[OBS] get_scene_item_id('{scene}', '{source}') returned None (attempt {attempt}/{retries})")
        if attempt < retries:
            time.sleep(delay)
    raise RuntimeError(
        f"Could not get scene_item_id for '{source}' in scene '{scene}' "
        f"after {retries} attempts — the source may not exist in that scene"
    )


def show_source(scene: str, source: str) -> None:
    """Turn on a scene item."""
    obs = get_obs()
    item_id = _get_scene_item_id(obs, scene, source)
    obs.set_scene_item_enabled(scene, item_id, True)


def hide_source(scene: str, source: str) -> None:
    """Turn off a scene item and stop any idle spin thread."""
    client = get_obs()
    item_id = _get_scene_item_id(client, scene, source)
    client.set_scene_item_enabled(scene, item_id, False)

    # Stop idle-spin thread if one exists for this source
    if hasattr(client, "_idle_spin_events"):
        stop = client._idle_spin_events.pop(source, None)
        if stop:
            stop.set()


def show_source_animated(
    scene: str,
    source: str,
    jump_duration: float = 2.0,
    filter_name: str = "3D Block",
) -> None:
    """
    Show a source with a jump-up animation and 3D-block coin-spin.

    1. Source appears upright at a random position off-screen bottom.
    2. It slides up to its target Y position in ``jump_duration`` seconds.
    3. During the ascent the triangle gradually starts spinning like a coin
       (tilt_x_deg cycled through the 3D Block filter).
    4. After landing it keeps continuously coin-spinning at its idle position.

    Rest positions are loaded from ``obs/positions.json``.  Edit those values
    or run ``python tools/detect_positions.py`` after moving things in OBS.
    """
    client = get_obs()
    item_id = _get_scene_item_id(client, scene, source)

    # ── 0. Load rest position from saved positions ────────────────────────
    positions_file = Path(__file__).resolve().parent / "positions.json"
    try:
        with open(positions_file) as f:
            data = json.load(f)
        saved = data.get("sources", {}).get(source, {})
        rest_x = saved.get("positionX", 1500)
        rest_y = saved.get("positionY", 100)
        rest_scale_x = saved.get("scaleX", 1.0)
        rest_scale_y = saved.get("scaleY", 1.0)
    except Exception:
        # Fallback: query OBS directly
        current = client.get_scene_item_transform(scene, item_id)
        t = getattr(current, "scene_item_transform", current)
        rest_x = t.get("positionX", 1500)
        rest_y = t.get("positionY", 100)
        rest_scale_x = t.get("scaleX", 1.0)
        rest_scale_y = t.get("scaleY", 1.0)

    # ── 1. Make sure the item is visible first ────────────────────────────
    client.set_scene_item_enabled(scene, item_id, True)

    # ── 2. Random jump start (off-screen bottom) ─────────────────────────
    start_x = rest_x + random.uniform(-80, 80)
    start_y = rest_y + random.uniform(900, 1200)

    # ── 3. Put the source at the start position ──────────────────────────
    client.set_scene_item_transform(scene, item_id, {
        "positionX": start_x,
        "positionY": start_y,
        "scaleX": rest_scale_x,
        "scaleY": rest_scale_y,
    })

    # Set 3D Block to upright and still, centered
    try:
        client.set_source_filter_settings(
            source, filter_name,
            {"tilt_x_deg": 0, "tilt_y_deg": 0, "tilt_z_deg": 0,
             "pos_x_percent": 0, "pos_y_percent": 0, "scale": 100, "wiggle": 0},
            overlay=True,
        )
    except Exception:
        pass

    # ── 4. Ease-in / ease-out jump ───────────────────────────────────────
    steps = int(jump_duration / 0.04)  # ~25 updates per second
    for i in range(1, steps + 1):
        progress = i / steps
        ease = progress * progress * (3 - 2 * progress)  # smoothstep

        x = start_x + (rest_x - start_x) * ease
        y = start_y + (rest_y - start_y) * ease

        client.set_scene_item_transform(scene, item_id, {
            "positionX": x,
            "positionY": y,
            "scaleX": rest_scale_x,
            "scaleY": rest_scale_y,
        })

        # Coin-spin accelerates during the jump: upright at start,
        # then spinning fast.  Cycle tilt_x_deg like a coin flip.
        # At progress 0: tilt = 0 (upright).  At progress 1: full coin spin.
        spin_speed = 200 * progress          # starts 0, ramps to 200
        tilt_angle = spin_speed * progress    # degrees, grows over time
        spin_x = 90 * math.sin(math.radians(tilt_angle))
        spin_z = 70 * math.cos(math.radians(tilt_angle))
        thickness = int(30 + 30 * progress)  # 3D block grows as it spins

        try:
            client.set_source_filter_settings(
                source, filter_name,
                {"tilt_x_deg": spin_x, "tilt_z_deg": spin_z, "thickness": thickness,
                 "pos_x_percent": 0, "pos_y_percent": 0,
                 "scale": 100, "wiggle": int(10 * progress), "wiggle_rot": True},
                overlay=True,
            )
        except Exception:
            pass  # filter may not exist — triangle just jumps

        time.sleep(0.04)

    # ── 5. Land at final position ────────────────────────────────────────
    client.set_scene_item_transform(scene, item_id, {
        "positionX": rest_x,
        "positionY": rest_y,
        "scaleX": rest_scale_x,
        "scaleY": rest_scale_y,
    })

    # ── 6. Continuous coin-spin at idle position ─────────────────────────
    # Use a background thread that keeps cycling the 3D Block tilt values
    # so the triangle endlessly flips like a coin.
    _stop_idle_spin: dict[str, threading.Event]
    if not hasattr(client, "_idle_spin_events"):
        client._idle_spin_events = {}

    # Kill any existing idle-spin thread for this source
    old = client._idle_spin_events.pop(source, None)
    if old:
        old.set()

    stop_event = threading.Event()
    client._idle_spin_events[source] = stop_event

    def _idle_spin_loop():
        t0 = time.time()
        while not stop_event.is_set():
            elapsed = time.time() - t0
            angle = elapsed * 300  # ~1 full cycle every 1.2 seconds
            tx = 90 * math.sin(math.radians(angle))
            tz = 60 * math.cos(math.radians(angle))
            try:
                client.set_source_filter_settings(
                    source, filter_name,
                    {"tilt_x_deg": tx, "tilt_z_deg": tz, "thickness": 50,
                     "pos_x_percent": 0, "pos_y_percent": 0, "scale": 100},
                    overlay=True,
                )
            except Exception as e:
                print(f"[idle_spin] Error on '{source}': {e}")
                break
            time.sleep(0.05)

    thread = threading.Thread(target=_idle_spin_loop, daemon=True)
    thread.start()


def show_logo_animated(
    scene: str,
    source: str,
    filter_name: str = "3D Block",
    jump_duration: float = 1.5,
) -> None:
    """
    Animate a logo sliding up from just below the canvas with an X-axis
    spin during the ascent.  Once it lands it snaps to the exact
    position, scale, and filter settings from ``instant_replay/logo_config.json``.
    """
    config_file = (
        Path(__file__).resolve().parents[1]
        / "tools"
        / "logo_config.json"
    )
    config = None
    try:
        with open(config_file) as f:
            config = json.load(f)
    except Exception:
        pass

    # ── 1. Make sure the item is visible ──────────────────────────────────
    client = get_obs()
    item_id = _get_scene_item_id(client, scene, source)
    client.set_scene_item_enabled(scene, item_id, True)

    # ── 2. Determine rest position + scale ────────────────────────────────
    if config:
        rest_x       = config.get("positionX", 600)
        rest_y       = config.get("positionY", 0)
        rest_scale_x = config.get("scaleX", 1.0)
        rest_scale_y = config.get("scaleY", 1.0)
        filter_defaults = config.get("filter_3d_block")
    else:
        current = client.get_scene_item_transform(scene, item_id)
        t = getattr(current, "scene_item_transform", current)
        rest_x       = t.get("positionX", 600)
        rest_y       = t.get("positionY", 0)
        rest_scale_x = t.get("scaleX", 1.0)
        rest_scale_y = t.get("scaleY", 1.0)
        filter_defaults = None

    # ── 2. Start position: 50 px below the 1080p canvas bottom ──────────
    start_x = rest_x
    start_y = 1080 + 50

    client.set_scene_item_transform(scene, item_id, {
        "positionX": start_x,
        "positionY": start_y,
        "scaleX": rest_scale_x,
        "scaleY": rest_scale_y,
    })

    # Reset filter to flat / still
    try:
        client.set_source_filter_settings(
            source, filter_name,
            {"tilt_x_deg": 0, "tilt_y_deg": 0, "tilt_z_deg": 0,
             "pos_x_percent": 0, "pos_y_percent": 0, "scale": 110, "wiggle": 0},
            overlay=True,
        )
    except Exception:
        pass

    # ── 3. Jump + X-axis spin only ───────────────────────────────────────
    CANVAS_BOTTOM = 1080 + 50
    steps = int(jump_duration / 0.04)
    for i in range(1, steps + 1):
        progress = i / steps
        ease = progress * progress * (3 - 2 * progress)

        x = start_x + (rest_x - start_x) * ease
        y = start_y + (rest_y - start_y) * ease

        client.set_scene_item_transform(scene, item_id, {
            "positionX": x,
            "positionY": y,
            "scaleX": rest_scale_x,
            "scaleY": rest_scale_y,
        })

        # X-axis spin: starts at 0 (flat facing camera), flips upward
        # 1.5 full rotations by the time it lands
        tx = 120 * math.sin(math.radians(progress * 540))

        try:
            client.set_source_filter_settings(
                source, filter_name,
                {"tilt_x_deg": tx, "tilt_z_deg": 0, "thickness": 30,
                 "pos_x_percent": 0, "pos_y_percent": 0, "scale": 110},
                overlay=True,
            )
        except Exception:
            pass

        time.sleep(0.04)

    # ── 4. Land at exact resting position ────────────────────────────────
    client.set_scene_item_transform(scene, item_id, {
        "positionX": rest_x,
        "positionY": rest_y,
        "scaleX": rest_scale_x,
        "scaleY": rest_scale_y,
    })

    # ── 5. Restore exact filter settings (or kill the spin) ─────────────
    try:
        if filter_defaults:
            client.set_source_filter_settings(
                source, filter_name, filter_defaults, overlay=True,
            )
        else:
            client.set_source_filter_settings(
                source, filter_name,
                {"tilt_x_deg": 0, "tilt_y_deg": 0, "tilt_z_deg": 0,
                 "pos_x_percent": 0, "pos_y_percent": 0, "scale": 110, "wiggle": 0},
                overlay=True,
            )
    except Exception:
        pass

    # Make sure no idle-spin thread is running for this source
    if hasattr(client, "_idle_spin_events"):
        stop = client._idle_spin_events.pop(source, None)
        if stop:
            stop.set()


def toggle_source(scene: str, source: str, duration: float | None = None) -> None:
    """Show a source, optionally hide it again after `duration` seconds."""
    show_source(scene, source)
    if duration is not None:
        time.sleep(duration)
        hide_source(scene, source)


def hide_sources(scene: str, sources: list[str]) -> None:
    """Hide multiple sources in one go. Silently skips any that error."""
    for source in sources:
        try:
            hide_source(scene, source)
        except Exception as e:
            print(f"[OBS] Could not hide '{source}': {e}")


# ─────────────────────────────────────────────────────────────────────────────
#  Scene switching
# ─────────────────────────────────────────────────────────────────────────────

def switch_scene(scene: str) -> None:
    get_obs().set_current_program_scene(scene)


def get_current_scene() -> str:
    return get_obs().get_current_program_scene().current_program_scene_name


def list_scenes() -> list[str]:
    return [s["sceneName"] for s in get_obs().get_scene_list().scenes]


def create_scene_if_missing(scene: str) -> bool:
    """
    Create an OBS scene if it does not already exist.
    Returns True if it was created, False if it already existed.
    """
    try:
        existing = list_scenes()
        if scene in existing:
            return False
        get_obs().create_scene(scene)
        print(f"[OBS] Created scene: {scene!r}")
        return True
    except Exception as e:
        print(f"[OBS] create_scene_if_missing failed for {scene!r}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
#  Media / playback
# ─────────────────────────────────────────────────────────────────────────────

def get_media_state(source: str) -> str | None:
    try:
        result = get_obs().get_media_input_status(source)
        return getattr(result, "media_state", None)
    except Exception as e:
        print(f"[OBS] Could not get media state for '{source}': {e}")
        return None


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
) -> bool:
    """
    Block until a media source finishes playing.
    Returns True if it ended cleanly, False on timeout or never-started.
    """
    playing_state = "OBS_MEDIA_STATE_PLAYING"
    end_states = {"OBS_MEDIA_STATE_STOPPED", "OBS_MEDIA_STATE_ENDED", "OBS_MEDIA_STATE_NONE"}

    started = False
    t0 = time.time()

    while True:
        state   = get_media_state(source)
        elapsed = time.time() - t0

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


# ─────────────────────────────────────────────────────────────────────────────
#  Source creation / deletion
# ─────────────────────────────────────────────────────────────────────────────

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
        "restart_on_activate": False,
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


def delete_source(scene: str, source_name: str) -> bool:
    """Remove a source from a scene and delete the underlying input."""
    obs = get_obs()
    try:
        item_id = obs.get_scene_item_id(scene, source_name).scene_item_id
        obs.remove_scene_item(scene, item_id)
    except Exception as e:
        print(f"[OBS] remove_scene_item failed for '{source_name}': {e}")
        return False
    try:
        obs.delete_input(source_name)
    except Exception:
        pass  # already gone
    return True

def create_scene_item(scene: str, source_name: str, enabled: bool = True) -> int:
    """
    Add an existing global input to a scene as a new scene item.
    Returns the new scene_item_id.
    """
    resp = get_obs().create_scene_item(scene, source_name, enabled)
    return resp.scene_item_id
    
def list_sources(scene: str) -> dict[str, int]:
    """Return {source_name: scene_item_id} for every source in the scene."""
    obs = get_obs()

    try:
        resp = obs.get_scene_item_list(scene)
    except Exception as e:
        print(f"[OBS] get_scene_item_list failed for scene '{scene}': {e}")
        return {}

    if resp is None:
        print(f"[OBS] get_scene_item_list({scene!r}) returned None")
        return {}

    items = getattr(resp, "scene_items", None)
    if items is None:
        print(f"[OBS] get_scene_item_list({scene!r}) returned no scene_items")
        return {}

    out = {}
    for item in items:
        if isinstance(item, dict):
            name = item.get("sourceName")
            item_id = item.get("sceneItemId")
        else:
            name = getattr(item, "sourceName", None) or getattr(item, "source_name", None)
            item_id = getattr(item, "sceneItemId", None) or getattr(item, "scene_item_id", None)

        if name and item_id is not None:
            out[str(name)] = int(item_id)

    return out
    
def list_group_sources(scene: str) -> dict[str, int]:
    """Returns {source_name: scene_item_id} for only group sources in the scene."""
    try:
        resp = get_obs().get_scene_item_list(scene)
        return {
            item["sourceName"]: item["sceneItemId"]
            for item in resp.scene_items
            if item.get("isGroup")
        }
    except Exception as e:
        print(f"[OBS] list_group_sources failed for scene '{scene}': {e}")
        return {}


# ─────────────────────────────────────────────────────────────────────────────
#  Streaming / recording
# ─────────────────────────────────────────────────────────────────────────────

def start_stream()  -> None: get_obs().start_stream()
def stop_stream()   -> None: get_obs().stop_stream()
def start_record()  -> None: get_obs().start_record()
def stop_record()   -> None: get_obs().stop_record()

def get_stream_status() -> dict:
    r = get_obs().get_stream_status()
    return {"active": r.output_active, "bytes": getattr(r, "output_bytes", None)}


# ─────────────────────────────────────────────────────────────────────────────
#  Text sources (GDI+ / FreeType)
# ─────────────────────────────────────────────────────────────────────────────

def set_text(source: str, text: str) -> None:
    """Update the text content of a Text (GDI+) or Text (FreeType 2) source."""
    get_obs().set_input_settings(source, {"text": text}, overlay=True)


# ─────────────────────────────────────────────────────────────────────────────
#  Filters
# ─────────────────────────────────────────────────────────────────────────────

def get_source_filters(source: str) -> list[dict]:
    """
    Return all filters on a source as a list of dicts with keys:
      name, kind, enabled, settings
    """
    resp = get_obs().get_source_filter_list(source)
    return getattr(resp, "filters", [])


def set_source_filter_enabled(source: str, filter_name: str, enabled: bool) -> None:
    """Enable or disable a named filter on a source."""
    get_obs().set_source_filter_enabled(source, filter_name, enabled)


def create_source_filter(
    source: str,
    filter_name: str,
    filter_kind: str,
    settings: dict,
) -> None:
    """Add a new filter of filter_kind to source with the given settings."""
    get_obs().create_source_filter(source, filter_name, filter_kind, settings)


def set_source_filter_settings(
    source: str,
    filter_name: str,
    settings: dict,
) -> None:
    """
    Push new settings onto an existing filter.
    Uses explicit keyword arguments and overlay=True so OBS merges the
    supplied keys into the existing settings rather than replacing them all
    (which would reset unspecified fields like opacity back to defaults).
    """
    get_obs().set_source_filter_settings(
        sourceName=source,
        filterName=filter_name,
        filterSettings=settings,
        overlay=True,
    )


def remove_source_filter(source: str, filter_name: str) -> None:
    """Remove a named filter from a source."""
    get_obs().remove_source_filter(source, filter_name)


# ─────────────────────────────────────────────────────────────────────────────
#  Scene item ID resolution
# ─────────────────────────────────────────────────────────────────────────────

def get_scene_item_id(scene: str, source: str) -> int:
    """
    Return the integer scene-item ID for `source` in `scene`.

    Use this when you need to cache an item_id for a hot animation loop —
    then pass it to set_source_transform_by_id() to avoid repeated lookups.
    Raises RuntimeError if the source cannot be found after retries.
    """
    return _get_scene_item_id(get_obs(), scene, source)


# ─────────────────────────────────────────────────────────────────────────────
#  Transform / position
# ─────────────────────────────────────────────────────────────────────────────

def set_source_transform(scene: str, source: str, transform: dict) -> None:
    """
    Update position/scale/rotation of a scene item (resolves source name → id).
    transform keys: positionX, positionY, scaleX, scaleY, rotation, etc.
    """
    obs = get_obs()
    item_id = _get_scene_item_id(obs, scene, source)
    obs.set_scene_item_transform(scene, item_id, transform)


def set_source_transform_by_id(scene: str, item_id: int, transform: dict) -> None:
    """
    Update position/scale/rotation using a pre-resolved scene-item ID.

    Use this in animation loops where the item_id is already cached —
    it skips the get_scene_item_id() lookup on every frame, which matters
    at 20–25 fps.  Obtain the id once with get_scene_item_id().
    """
    get_obs().set_scene_item_transform(scene, item_id, transform)


def get_source_transform(scene: str, source: str) -> dict:
    obs = get_obs()
    item_id = _get_scene_item_id(obs, scene, source)
    resp = obs.get_scene_item_transform(scene, item_id)
    return getattr(resp, "scene_item_transform", resp)

# ─────────────────────────────────────────────────────────────────────────────
#  Audio routing / volume
# ─────────────────────────────────────────────────────────────────────────────

def get_input_audio_monitor_type(input_name: str):
    """Return the OBS audio monitor type for an input, or None on failure."""
    try:
        return get_obs().get_input_audio_monitor_type(input_name).monitor_type
    except Exception as e:
        print(f"[OBS] Could not get monitor type for '{input_name}': {e}")
        return None


def set_input_audio_monitor_type(input_name: str, monitor_type: str) -> None:
    """Set audio monitor type for an input.

    Valid values in OBS websocket v5 include:
      - OBS_MONITORING_TYPE_NONE
      - OBS_MONITORING_TYPE_MONITOR_ONLY
      - OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT
    """
    get_obs().set_input_audio_monitor_type(input_name, monitor_type)


def get_input_volume(input_name: str):
    """Return {'mul': float|None, 'db': float|None} for an input, or None on failure."""
    try:
        r = get_obs().get_input_volume(input_name)
        return {
            "mul": getattr(r, "input_volume_mul", None),
            "db": getattr(r, "input_volume_db", None),
        }
    except Exception as e:
        print(f"[OBS] Could not get volume for '{input_name}': {e}")
        return None


def set_input_volume_db(input_name: str, db: float) -> None:
    """Set an input's volume in dB.

    obsws-python's set_input_volume takes positional args:
      set_input_volume(inputName, inputVolumeMul, inputVolumeDb)
    Pass None for mul to leave it unset.
    """
    get_obs().set_input_volume(input_name, None, float(db))


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
        print(f"[OBS] set_input_mute failed for '{source}' (muted={muted}): {e}")


def get_input_mute(source: str) -> bool | None:
    """Return True if the source is muted, False if not, None on error."""
    try:
        resp = get_obs().get_input_mute(source)
        return resp.input_muted
    except Exception as e:
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


# ─────────────────────────────────────────────────────────────────────────────
#  Replay buffer
# ─────────────────────────────────────────────────────────────────────────────

def save_replay_buffer_and_wait(timeout: float = 15.0) -> str | None:
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
        get_obs().save_replay_buffer()
        got_it = saved_event.wait(timeout=timeout)
    finally:
        try:
            ev.disconnect()
        except Exception:
            pass

    return path_holder[0] if (got_it and path_holder) else None


# ─────────────────────────────────────────────────────────────────────────────
#  Media source file targeting
# ─────────────────────────────────────────────────────────────────────────────

def set_media_source_file(source: str, filepath: str | Path) -> None:
    """
    Point an ffmpeg_source (media source) input at a new local file without
    changing any other settings.  Call restart_media() afterwards to play.
    """
    get_obs().set_input_settings(
        source,
        {
            "local_file"   : str(filepath),
            "is_local_file": True,
        },
        overlay=True,
    )


def configure_media_source_properties(
    source: str,
    *,
    restart_on_activate: bool | None = None,
    close_when_inactive: bool | None = None,
    looping: bool | None = None,
    hw_decode: bool | None = None,
) -> None:
    """
    Set behavioural properties on an ffmpeg_source input.  Only the keyword
    arguments you supply are changed; omitted ones are left as-is in OBS.

    restart_on_activate  — restart from beginning every time the source is shown
    close_when_inactive  — release the file handle when the source is hidden
    looping              — loop the media when it reaches the end
    hw_decode            — use hardware decoding when available
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
    if settings:
        get_obs().set_input_settings(source, settings, overlay=True)


# ─────────────────────────────────────────────────────────────────────────────
#  Stream title (Twitch / YouTube / etc.)
# ─────────────────────────────────────────────────────────────────────────────

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
"""OBS source inventory, visibility, filters, and placement."""
from __future__ import annotations

import time

from .client import get_obs


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

def set_text(source: str, text: str) -> None:
    """Update the text content of a Text (GDI+) or Text (FreeType 2) source."""
    get_obs().set_input_settings(source, {"text": text}, overlay=True)

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
    *,
    overlay: bool = True,
) -> None:
    """
    Push new settings onto an existing filter.
    Incremental edits merge by default. A complete saved filter snapshot uses
    overlay=False to reset omitted keys to defaults, matching filter recreation.
    """
    get_obs().set_source_filter_settings(
        source_name=source,
        filter_name=filter_name,
        settings=settings,
        overlay=overlay,
    )

def remove_source_filter(source: str, filter_name: str) -> None:
    """Remove a named filter from a source."""
    get_obs().remove_source_filter(source, filter_name)

def get_scene_item_id(scene: str, source: str) -> int:
    """
    Return the integer scene-item ID for `source` in `scene`.

    Use this when you need to cache an item_id for a hot animation loop —
    then pass it to set_source_transform_by_id() to avoid repeated lookups.
    Raises RuntimeError if the source cannot be found after retries.
    """
    return _get_scene_item_id(get_obs(), scene, source)

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

def get_canvas_size() -> dict[str, int]:
    """Return OBS base/output canvas dimensions."""
    resp = get_obs().get_video_settings()

    def _read(*names: str, default: int) -> int:
        for name in names:
            if hasattr(resp, name):
                return int(getattr(resp, name))
        if isinstance(resp, dict):
            for name in names:
                if name in resp:
                    return int(resp[name])
        return default

    return {
        "baseWidth": _read("base_width", "baseWidth", default=1920),
        "baseHeight": _read("base_height", "baseHeight", default=1080),
        "outputWidth": _read("output_width", "outputWidth", default=1920),
        "outputHeight": _read("output_height", "outputHeight", default=1080),
    }

def get_scene_source_transforms(scene: str, prefix: str | None = None) -> dict[str, dict]:
    """Return current scene-item transforms keyed by source name."""
    obs = get_obs()
    try:
        resp = obs.get_scene_item_list(scene)
    except Exception as exc:
        print(f"[OBS] Could not list scene item transforms for {scene!r}: {exc}")
        return {}

    result: dict[str, dict] = {}
    for item in getattr(resp, "scene_items", []) or []:
        if isinstance(item, dict):
            source_name = item.get("sourceName") or item.get("source_name")
            transform = item.get("sceneItemTransform") or item.get("scene_item_transform") or {}
        else:
            source_name = getattr(item, "sourceName", None) or getattr(item, "source_name", None)
            transform = getattr(item, "sceneItemTransform", None) or getattr(item, "scene_item_transform", None) or {}
        if not source_name:
            continue
        if prefix and not str(source_name).startswith(prefix):
            continue
        result[str(source_name)] = dict(transform)
    return result

def get_scene_sources(scene: str, prefix: str | None = None) -> list[dict]:
    """Return scene-item metadata for every source in a scene."""
    obs = get_obs()
    resp = obs.get_scene_item_list(scene)
    result: list[dict] = []
    for item in getattr(resp, "scene_items", []) or []:
        if isinstance(item, dict):
            source_name = item.get("sourceName") or item.get("source_name")
            item_id = item.get("sceneItemId") or item.get("scene_item_id")
            enabled = item.get("sceneItemEnabled")
            if enabled is None:
                enabled = item.get("scene_item_enabled")
            kind = item.get("sourceType") or item.get("source_type") or item.get("inputKind") or item.get("input_kind")
        else:
            source_name = getattr(item, "sourceName", None) or getattr(item, "source_name", None)
            item_id = getattr(item, "sceneItemId", None) or getattr(item, "scene_item_id", None)
            enabled = getattr(item, "sceneItemEnabled", None)
            if enabled is None:
                enabled = getattr(item, "scene_item_enabled", None)
            kind = (
                getattr(item, "sourceType", None)
                or getattr(item, "source_type", None)
                or getattr(item, "inputKind", None)
                or getattr(item, "input_kind", None)
            )
        if not source_name:
            continue
        if prefix and not str(source_name).startswith(prefix):
            continue
        result.append({
            "source": str(source_name),
            "scene_item_id": int(item_id) if item_id is not None else None,
            "visible": bool(enabled),
            "kind": str(kind or ""),
        })
    return result

def set_scene_source_visible(scene: str, source: str, visible: bool) -> None:
    """Set a source's scene-item visibility by source name."""
    obs = get_obs()
    item_id = _get_scene_item_id(obs, scene, source)
    obs.set_scene_item_enabled(scene, item_id, bool(visible))

# lib/sync.py
#
# Syncs a mini-project's asset directory with its OBS scene at startup.
#
# The asset directory is the source of truth: every file in it should have
# a corresponding OBS source in the project's scene, and sources for files
# that no longer exist should be removed.
#
# Usage (call once at the top of each mini-project's main entry point):
#
#   from obs import sync_assets, MONITOR_ONLY
#
#   sync_assets(
#       scene     = SCENE,
#       asset_dir = ASSETS_DIR,
#       prefix    = OBS_SOURCE_PREFIX,
#   )
#
# Returns a set[str] of source names that were BRAND-NEW on this run.
# Use this to apply default transforms only to freshly-created sources —
# pre-existing sources keep whatever position/size the user set manually.
#
# Do NOT import from this file directly in mini-projects —
# sync_assets and the MONITOR_* constants are re-exported from obs/__init__.py.

from __future__ import annotations

from pathlib import Path

# Import from the concrete sub-modules, not from obs/__init__, to avoid a
# circular import (obs/__init__ re-exports sync_assets from this file).
from obs.interaction import (
    create_scene_if_missing,
    list_sources,
    create_media_source,
    create_scene_item,
    delete_source,
    set_media_source_file,
    configure_media_source_properties,
    set_input_audio_monitor_type,
    set_input_volume_db,
    get_input_list,
)

# ── Supported extensions ──────────────────────────────────────────────────────

_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".tga", ".tiff"}
_VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv", ".ts", ".m4v"}
_AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".opus"}
_ALL_EXTS   = _IMAGE_EXTS | _VIDEO_EXTS | _AUDIO_EXTS

# ── OBS audio monitor-type constants ─────────────────────────────────────────
# Pass one of these as the `monitor` argument to sync_assets().

MONITOR_ONLY    = "OBS_MONITORING_TYPE_MONITOR_ONLY"
MONITOR_AND_OUT = "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT"
NO_MONITOR      = "OBS_MONITORING_TYPE_NONE"


# ── Public API ────────────────────────────────────────────────────────────────

def ensure_single_source(
    scene: str,
    asset_dir: str | Path,
    prefix: str,
    *,
    monitor: str = MONITOR_ONLY,
    volume_db: float | None = None,
) -> str:
    """
    Ensure exactly ONE OBS media source exists in ``scene`` for this project.

    The canonical source name is ``{prefix}player``.  Any other sources whose
    name starts with ``prefix`` are treated as stale per-file sources from the
    old multi-source design and are removed (scene item + underlying input).

    Returns the single source name (``{prefix}player``).
    """
    asset_dir = Path(asset_dir)
    single = f"{prefix}player"

    print(f"[sync] Ensuring single source '{single}' in scene '{scene}'")
    create_scene_if_missing(scene)

    # ── Remove old per-file sources from this scene ───────────────────────
    scene_sources = list_sources(scene)
    removed = 0
    for name in list(scene_sources):
        if name.startswith(prefix) and name != single:
            try:
                delete_source(scene, name)
                print(f"[sync]   - removed stale per-file source '{name}'")
                removed += 1
            except Exception as exc:
                print(f"[sync]   ✗ Could not remove '{name}': {exc}")

    scene_sources = list_sources(scene)  # refresh after removals

    if single in scene_sources:
        _apply_media_config(single, monitor, is_media=True)
        print(f"[sync]   ✓ '{single}' exists ({removed} stale source(s) removed)")
        return single

    # ── Source not yet in scene — check global inputs first ──────────────
    global_inputs = set(get_input_list())
    if single in global_inputs:
        try:
            create_scene_item(scene, single, enabled=False)
            print(f"[sync]   ↻ re-linked '{single}' from global inputs")
        except Exception as exc:
            print(f"[sync]   ✗ Could not re-link '{single}': {exc}")
        _apply_media_config(single, monitor, is_media=True)
        return single

    # ── Create fresh ——— need a real media file as placeholder ────────────
    placeholder: Path | None = None
    if asset_dir.is_dir():
        for fp in sorted(asset_dir.iterdir()):
            if fp.is_file() and fp.suffix.lower() in (_VIDEO_EXTS | _AUDIO_EXTS):
                placeholder = fp
                break

    if placeholder is None:
        print(f"[sync]   ⚠ No media files in {asset_dir} — '{single}' not created yet")
        return single

    ok = create_media_source(scene, single, placeholder, hidden=True)
    if ok:
        print(f"[sync]   + created '{single}'  (placeholder: {placeholder.name})")
    else:
        print(f"[sync]   ✓ '{single}' already exists (stale global snapshot)")

    _apply_media_config(single, monitor, is_media=True)
    if volume_db is not None:
        try:
            set_input_volume_db(single, volume_db)
        except Exception as exc:
            print(f"[sync]   ✗ Could not set volume for '{single}': {exc}")

    return single


def ensure_shared_sources(
    scene: str,
    asset_dir: str | Path,
    prefix: str,
    *,
    monitor: str = MONITOR_ONLY,
    volume_db: float | None = None,
    slots: int = 1,
) -> list[str]:
    """Ensure a stable pool of shared media sources exists for single-source mode."""
    slots = max(1, int(slots or 1))
    if slots == 1:
        return [ensure_single_source(scene, asset_dir, prefix, monitor=monitor, volume_db=volume_db)]

    asset_dir = Path(asset_dir)
    shared_sources = [f"{prefix}player"] + [f"{prefix}player_{index}" for index in range(2, slots + 1)]
    wanted = set(shared_sources)

    print(f"[sync] Ensuring {slots} shared sources in scene '{scene}'")
    create_scene_if_missing(scene)
    _dedup_scene_items(scene, prefix)

    scene_sources = list_sources(scene)
    removed = 0
    for name in list(scene_sources):
        if name.startswith(prefix) and name not in wanted:
            try:
                delete_source(scene, name)
                print(f"[sync]   - removed stale shared-source candidate '{name}'")
                removed += 1
            except Exception as exc:
                print(f"[sync]   âœ— Could not remove '{name}': {exc}")

    scene_sources = list_sources(scene)
    global_inputs = set(get_input_list())

    placeholder: Path | None = None
    if asset_dir.is_dir():
        for fp in sorted(asset_dir.iterdir()):
            if fp.is_file() and fp.suffix.lower() in (_VIDEO_EXTS | _AUDIO_EXTS):
                placeholder = fp
                break

    if placeholder is None:
        print(f"[sync]   âš  No media files in {asset_dir} â€” shared sources not created yet")
        return shared_sources

    for source_name in shared_sources:
        if source_name in scene_sources:
            _apply_media_config(source_name, monitor, is_media=True)
            print(f"[sync]   âœ“ '{source_name}' exists ({removed} stale source(s) removed)")
            continue

        if source_name in global_inputs:
            try:
                create_scene_item(scene, source_name, enabled=False)
                print(f"[sync]   â†» re-linked '{source_name}' from global inputs")
            except Exception as exc:
                print(f"[sync]   âœ— Could not re-link '{source_name}': {exc}")
            _apply_media_config(source_name, monitor, is_media=True)
            continue

        ok = create_media_source(scene, source_name, placeholder, hidden=True)
        if ok:
            print(f"[sync]   + created '{source_name}'  (placeholder: {placeholder.name})")
        else:
            print(f"[sync]   âœ“ '{source_name}' already exists (stale global snapshot)")

        _apply_media_config(source_name, monitor, is_media=True)
        if volume_db is not None:
            try:
                set_input_volume_db(source_name, volume_db)
            except Exception as exc:
                print(f"[sync]   âœ— Could not set volume for '{source_name}': {exc}")

    return shared_sources


def _dedup_scene_items(scene: str, prefix: str) -> int:
    """
    Remove duplicate scene items for sources whose name starts with prefix.

    OBS allows multiple scene items to reference the same underlying input.
    This happens when a re-link path fires on a source that is already in the
    scene (e.g. because list_sources() silently drops duplicates from its dict).

    Strategy: keep the first occurrence in stack order (bottom of the stack =
    the item the user originally positioned), remove all later ones.

    Returns the number of duplicates removed.
    """
    from obs.client import get_obs as _get_obs
    obs_client = _get_obs()
    try:
        resp = obs_client.get_scene_item_list(scene)
    except Exception as exc:
        print(f"[sync] Could not list items for dedup in '{scene}': {exc}")
        return 0

    items = getattr(resp, "scene_items", None) or []

    seen: dict[str, int] = {}   # source_name → first item_id
    extras: list[tuple[str, int]] = []  # (source_name, duplicate item_id)

    for item in items:
        if isinstance(item, dict):
            name = item.get("sourceName") or item.get("source_name")
            item_id = item.get("sceneItemId") or item.get("scene_item_id")
        else:
            name = getattr(item, "sourceName", None) or getattr(item, "source_name", None)
            item_id = getattr(item, "sceneItemId", None) or getattr(item, "scene_item_id", None)

        if not name or item_id is None:
            continue
        name = str(name)
        if not name.startswith(prefix):
            continue

        item_id = int(item_id)
        if name in seen:
            extras.append((name, item_id))
        else:
            seen[name] = item_id

    removed = 0
    for source_name, item_id in extras:
        try:
            obs_client.remove_scene_item(scene, item_id)
            print(f"[sync]   ✕ removed duplicate scene item '{source_name}' (id={item_id})")
            removed += 1
        except Exception as exc:
            print(f"[sync]   ✗ Could not remove duplicate scene item '{source_name}' (id={item_id}): {exc}")

    return removed


def sync_assets(
    scene: str,
    asset_dir: str | Path,
    prefix: str,
    *,
    monitor: str = MONITOR_ONLY,
    volume_db: float | None = None,
) -> set[str]:
    """
    Ensure the OBS scene matches the asset directory.

    For each file in asset_dir:
      - Already in the scene → update its file path and move on.
      - Exists globally but not in this scene → re-link it (hidden), update path.
      - New → create a hidden source and apply audio-monitoring settings.

    Any source whose name starts with `prefix` but whose backing file is gone
    from asset_dir is removed from the scene and deleted.

    Returns
    -------
    set[str]
        Names of sources that were brand-new on this run (did not previously
        exist anywhere in OBS).  Use this to apply default layout transforms
        without clobbering positions the user has already set manually.

    Parameters
    ----------
    scene     : OBS scene name.  Created automatically if it doesn't exist.
    asset_dir : Directory that is the source of truth.
    prefix    : Short string prepended to every source name (e.g. "tt__").
    monitor   : OBS audio monitor type applied to media/audio sources.
                Defaults to MONITOR_ONLY.
    """
    asset_dir = Path(asset_dir)
    if not asset_dir.is_dir():
        print(f"[sync] Asset dir not found, skipping sync: {asset_dir}")
        return set()

    print(f"[sync] Syncing scene '{scene}' ← {asset_dir}  (prefix={prefix!r})")

    # ── 1. Ensure the scene exists ────────────────────────────────────────
    create_scene_if_missing(scene)

    # ── 1b. Remove any duplicate scene items left from previous bad runs ──
    dupes_removed = _dedup_scene_items(scene, prefix)
    if dupes_removed:
        print(f"[sync] Removed {dupes_removed} duplicate scene item(s).")

    # ── 2. Build the expected source → file mapping ───────────────────────
    expected: dict[str, Path] = {}
    for fp in sorted(asset_dir.iterdir()):
        if fp.is_file() and fp.suffix.lower() in _ALL_EXTS:
            expected[f"{prefix}{fp.stem}"] = fp

    # ── 3. Snapshot current state ─────────────────────────────────────────
    scene_sources = list_sources(scene)   # {source_name: scene_item_id}
    global_inputs = set(get_input_list()) # all OBS inputs project-wide

    newly_created: set[str] = set()
    created = stale = already_ok = 0

    # ── 4. Create / update sources ────────────────────────────────────────
    for source_name, filepath in expected.items():
        is_media = filepath.suffix.lower() in (_VIDEO_EXTS | _AUDIO_EXTS)

        if source_name in scene_sources:
            # Already in the scene — keep the file pointer and audio monitor
            # current, but don't touch position/size (user may have resized).
            if is_media:
                try:
                    set_media_source_file(source_name, filepath)
                except Exception as e:
                    print(f"[sync]   ✗ Could not update file for '{source_name}': {e}")
                try:
                    set_input_audio_monitor_type(source_name, monitor)
                except Exception as e:
                    print(f"[sync]   ✗ Could not update monitor for '{source_name}': {e}")
            #print(f"[sync]   ✓ exists   {source_name}")
            already_ok += 1
            continue

        if source_name in global_inputs:
            # Input exists globally (maybe from another scene) — re-link it
            # into this scene without duplicating the underlying input.
            # Do NOT add to newly_created: the user may have sized it already.
            try:
                create_scene_item(scene, source_name, enabled=False)
                print(f"[sync]   ↻ re-linked {source_name}")
            except Exception as e:
                print(f"[sync]   ✗ Could not re-link '{source_name}': {e}")
                continue

            if is_media:
                try:
                    set_media_source_file(source_name, filepath)
                except Exception as e:
                    print(f"[sync]   ✗ Could not update file for '{source_name}': {e}")

            _apply_media_config(source_name, monitor, is_media=is_media)
            created += 1
            continue

        # ── Brand-new source — track for default layout application ───────
        if filepath.suffix.lower() in _IMAGE_EXTS:
            ok = _create_image_source(scene, source_name, filepath)
        else:
            ok = False
            try:
                result = create_media_source(scene, source_name, filepath, hidden=True)
                if result:
                    print(f"[sync]   + created   {source_name}")
                    ok = True
                else:
                    # Source exists in OBS but wasn't caught by get_input_list()
                    # (stale snapshot). Re-link it into the scene only if it is
                    # genuinely absent — a fresh list_sources check prevents
                    # accidentally adding a duplicate.
                    fresh = list_sources(scene)
                    if source_name not in fresh:
                        print(f"[sync]   ↻ re-linked (was orphaned)  {source_name}")
                        try:
                            create_scene_item(scene, source_name, enabled=False)
                        except Exception as link_err:
                            if "already exists" not in str(link_err).lower():
                                print(f"[sync]   ✗ Could not re-link '{source_name}': {link_err}")
                    else:
                        print(f"[sync]   ✓ already in scene (stale snapshot)  {source_name}")
            except Exception as e:
                print(f"[sync]   ✗ FAILED to create '{source_name}': {e}")
                continue

        _apply_media_config(source_name, monitor, is_media=is_media)
        if ok and volume_db is not None:
            try:
                set_input_volume_db(source_name, volume_db)
            except Exception as e:
                print(f"[sync]   ✗ Could not set volume for '{source_name}': {e}")
        created += 1

        if ok:
            newly_created.add(source_name)

    # ── 5. Remove stale sources owned by this prefix ─────────────────────
    for source_name in list(scene_sources):
        if source_name.startswith(prefix) and source_name not in expected:
            try:
                delete_source(scene, source_name)
                print(f"[sync]   - removed stale  {source_name}")
                stale += 1
            except Exception as e:
                print(f"[sync]   ✗ Could not remove '{source_name}': {e}")

    print(
        f"[sync] Done — {created} created/re-linked, "
        f"{already_ok} already up-to-date, {stale} stale removed."
    )

    return newly_created


# ── Internal helpers ──────────────────────────────────────────────────────────

def _apply_media_config(source_name: str, monitor: str, *, is_media: bool) -> None:
    """Apply restart/hw_decode properties and audio monitoring to a media source."""
    if not is_media:
        return
    try:
        configure_media_source_properties(
            source_name,
            restart_on_activate=False,
            hw_decode=True,
        )
    except Exception as e:
        print(f"[sync]     (media config failed for '{source_name}'): {e}")
    try:
        set_input_audio_monitor_type(source_name, monitor)
    except Exception as e:
        print(f"[sync]     (audio monitor config failed for '{source_name}'): {e}")


def _create_image_source(scene: str, source_name: str, filepath: Path) -> bool:
    """Create an image_source input and add it to the scene (hidden).

    Returns True if the source was successfully created, False otherwise.
    """
    from obs.client import get_obs
    obs_client = get_obs()
    settings = {"file": str(filepath.resolve())}
    try:
        obs_client.create_input(scene, source_name, "image_source", settings, False)
        print(f"[sync]   + created (image)  {source_name}")
        return True
    except TypeError:
        try:
            obs_client.create_input(
                sceneName=scene,
                inputName=source_name,
                inputKind="image_source",
                inputSettings=settings,
                sceneItemEnabled=False,
            )
            print(f"[sync]   + created (image)  {source_name}")
            return True
        except Exception as e:
            print(f"[sync]   ✗ FAILED to create image source '{source_name}': {e}")
            return False
    except Exception as e:
        if "already exists" not in str(e).lower():
            print(f"[sync]   ✗ FAILED to create image source '{source_name}': {e}")
        return False

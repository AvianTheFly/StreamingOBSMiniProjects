# obs/sync.py
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
# Do NOT import from this file directly in mini-projects —
# sync_assets and the MONITOR_* constants are re-exported from obs/__init__.py.

from __future__ import annotations

from pathlib import Path

from .interaction import (
    create_scene_if_missing,
    list_sources,
    create_media_source,
    create_scene_item,
    delete_source,
    set_media_source_file,
    configure_media_source_properties,
    set_input_audio_monitor_type,
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

def sync_assets(
    scene: str,
    asset_dir: str | Path,
    prefix: str,
    *,
    monitor: str = MONITOR_ONLY,
) -> None:
    """
    Ensure the OBS scene matches the asset directory.

    For each file in asset_dir:
      - Already in the scene → update its file path and move on.
      - Exists globally but not in this scene → re-link it (hidden), update path.
      - New → create a hidden source and apply audio-monitoring settings.

    Any source whose name starts with `prefix` but whose backing file is gone
    from asset_dir is removed from the scene and deleted.

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
        return

    print(f"[sync] Syncing scene '{scene}' ← {asset_dir}  (prefix={prefix!r})")

    # ── 1. Ensure the scene exists ────────────────────────────────────────
    create_scene_if_missing(scene)

    # ── 2. Build the expected source → file mapping ───────────────────────
    expected: dict[str, Path] = {}
    for fp in sorted(asset_dir.iterdir()):
        if fp.is_file() and fp.suffix.lower() in _ALL_EXTS:
            expected[f"{prefix}{fp.stem}"] = fp

    # ── 3. Snapshot current state ─────────────────────────────────────────
    scene_sources = list_sources(scene)   # {source_name: scene_item_id}
    global_inputs = set(get_input_list()) # all OBS inputs project-wide

    created = stale = already_ok = 0

    # ── 4. Create / update sources ────────────────────────────────────────
    for source_name, filepath in expected.items():
        is_media = filepath.suffix.lower() in (_VIDEO_EXTS | _AUDIO_EXTS)

        if source_name in scene_sources:
            # Already in the scene — keep the file pointer current in case the
            # file was renamed/moved, but don't touch anything else.
            if is_media:
                try:
                    set_media_source_file(source_name, filepath)
                except Exception as e:
                    print(f"[sync]   ✗ Could not update file for '{source_name}': {e}")
            #print(f"[sync]   ✓ exists   {source_name}")
            already_ok += 1
            continue

        if source_name in global_inputs:
            # Input exists globally (maybe from another scene) — re-link it
            # into this scene without duplicating the underlying input.
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

        # ── Brand-new source ──────────────────────────────────────────────
        if filepath.suffix.lower() in _IMAGE_EXTS:
            _create_image_source(scene, source_name, filepath)
        else:
            try:
                ok = create_media_source(scene, source_name, filepath, hidden=True)
                if ok:
                    print(f"[sync]   + created   {source_name}")
                else:
                    # Source exists in OBS but wasn't caught by get_input_list()
                    # (stale snapshot). Re-link it into the scene manually.
                    print(f"[sync]   ↻ re-linked (was orphaned)  {source_name}")
                    try:
                        create_scene_item(scene, source_name, enabled=False)
                    except Exception as link_err:
                        # Already in scene — that's fine, move on
                        if "already exists" not in str(link_err).lower():
                            print(f"[sync]   ✗ Could not re-link '{source_name}': {link_err}")
            except Exception as e:
                print(f"[sync]   ✗ FAILED to create '{source_name}': {e}")
                continue

        _apply_media_config(source_name, monitor, is_media=is_media)
        created += 1

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


def _create_image_source(scene: str, source_name: str, filepath: Path) -> None:
    """Create an image_source input and add it to the scene (hidden)."""
    from .client import get_obs
    obs_client = get_obs()
    settings = {"file": str(filepath.resolve())}
    try:
        obs_client.create_input(scene, source_name, "image_source", settings, False)
        print(f"[sync]   + created (image)  {source_name}")
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
        except Exception as e:
            print(f"[sync]   ✗ FAILED to create image source '{source_name}': {e}")
    except Exception as e:
        if "already exists" not in str(e).lower():
            print(f"[sync]   ✗ FAILED to create image source '{source_name}': {e}")
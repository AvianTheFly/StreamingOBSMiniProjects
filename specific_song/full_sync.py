"""
specific_song/full_sync.py
==========================
Three-layer sync: Assets folder → songs.json → OBS scene.

    Layer 1  →  2 : Adds/removes entries in songs.json to match .mp4 files on disk.
                    New entries get an empty aliases list — fill them in manually.
                    Removed entries are moved to deleted_songs.json (preserving
                    their aliases so they can be restored if the file comes back).

    Layer 2  →  3 : Adds/removes ffmpeg_source inputs in the OBS "SpecificSongs"
                    scene so each songs.json entry has exactly one OBS source.

                    OBS source names are prefixed with OBS_SOURCE_PREFIX (default
                    "ss__") so they never collide with other sub-projects that
                    share the same .mp4 stem names (e.g. meme_songs).
                    songs.json and the asset filenames are NOT affected.

Usage
─────
    python full_sync.py            # dry-run preview (nothing is changed)
    python full_sync.py --apply    # write songs.json + modify OBS
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

# ── Make config importable when running this script directly ──────────────────
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))

from config import ASSETS_DIR, SONGS_JSON, SCENE, OBS_SOURCE_PREFIX

# ── OBS connection (from environment — see .env.example) ───────────────────────
OBS_HOST     = os.environ.get("OBS_HOST", "localhost")
OBS_PORT     = int(os.environ.get("OBS_PORT", "4455"))
OBS_PASSWORD = os.environ.get("OBS_PASSWORD", "")
OBS_TIMEOUT  = 10   # seconds

# Deleted entries are kept here so aliases survive if you restore a song file.
_DELETED_JSON = SONGS_JSON.parent / "deleted_songs.json"

_TAG = "[full_sync]"


# ─────────────────────────────────────────────────────────────────────────────
#  JSON helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_songs() -> list[dict]:
    if not SONGS_JSON.exists():
        return []
    text = SONGS_JSON.read_text(encoding="utf-8").strip()
    return json.loads(text) if text else []


def _save_songs(songs: list[dict]) -> None:
    if SONGS_JSON.exists():
        shutil.copy(SONGS_JSON, SONGS_JSON.with_suffix(".bak"))
    SONGS_JSON.write_text(json.dumps(songs, indent=2, ensure_ascii=False), encoding="utf-8")


def _load_deleted() -> dict[str, dict]:
    """Returns {source_name: record}."""
    if not _DELETED_JSON.exists():
        return {}
    entries = json.loads(_DELETED_JSON.read_text(encoding="utf-8"))
    return {e["source"]: e for e in entries if "source" in e}


def _save_deleted(deleted: dict[str, dict]) -> None:
    _DELETED_JSON.parent.mkdir(parents=True, exist_ok=True)
    _DELETED_JSON.write_text(
        json.dumps(list(deleted.values()), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


# ─────────────────────────────────────────────────────────────────────────────
#  OBS helpers
# ─────────────────────────────────────────────────────────────────────────────

def _connect_obs():
    try:
        import obsws_python as obs
        req = obs.ReqClient(host=OBS_HOST, port=OBS_PORT, password=OBS_PASSWORD, timeout=OBS_TIMEOUT)
        req.get_version()
        print(f"  OBS connected ({OBS_HOST}:{OBS_PORT})")
        return req
    except ImportError:
        print("  obsws_python not installed — run:  pip install obsws-python")
        return None
    except Exception as e:
        print(f"  OBS connection failed: {e}")
        print("  Is OBS running with Tools > WebSocket Server enabled?")
        return None


def _ensure_scene(req) -> bool:
    try:
        existing = [s["sceneName"] for s in req.get_scene_list().scenes]
        if SCENE not in existing:
            req.create_scene(SCENE)
            print(f"  Created OBS scene '{SCENE}'.")
        return True
    except Exception as e:
        print(f"  Could not ensure scene '{SCENE}' exists: {e}")
        return False


def _get_obs_sources(req) -> dict[str, int]:
    """Returns {obs_source_name: scene_item_id} for ALL sources in the scene."""
    try:
        resp = req.get_scene_item_list(SCENE)
        return {item["sourceName"]: item["sceneItemId"] for item in resp.scene_items}
    except Exception as e:
        print(f"  Could not list OBS sources: {e}")
        return {}


def _obs_delete(req, obs_name: str, item_id: int) -> bool:
    try:
        req.remove_scene_item(SCENE, item_id)
    except Exception as e:
        print(f"  remove_scene_item failed for '{obs_name}': {e}")
        return False
    try:
        req.delete_input(obs_name)
    except Exception:
        pass  # already gone
    return True


def _obs_create(req, obs_name: str, mp4_path: Path) -> bool:
    """Add a hidden ffmpeg_source for mp4_path under obs_name."""
    settings = {
        "local_file"         : str(mp4_path),
        "is_local_file"      : True,
        "restart_on_activate": True,
        "close_when_inactive": True,
        "looping"            : False,
    }

    # Style 1 — older obsws-python (5th positional arg = sceneItemEnabled)
    try:
        req.create_input(SCENE, obs_name, "ffmpeg_source", settings, False)
        return True
    except TypeError:
        pass
    except Exception as e:
        if "already exists" in str(e).lower():
            return True
        print(f"  create_input (positional) failed for '{obs_name}': {e}")
        return False

    # Style 2 — newer obsws-python (keyword args, disable afterwards)
    try:
        resp = req.create_input(
            sceneName=SCENE, inputName=obs_name,
            inputKind="ffmpeg_source", inputSettings=settings,
        )
        try:
            req.set_scene_item_enabled(
                sceneName=SCENE,
                sceneItemId=resp.scene_item_id,
                sceneItemEnabled=False,
            )
        except Exception:
            pass
        return True
    except Exception as e:
        if "already exists" in str(e).lower():
            return True
        print(f"  create_input (kwargs) failed for '{obs_name}': {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
#  Diff logic
# ─────────────────────────────────────────────────────────────────────────────

def _json_diff(mp4_files: list[Path], songs: list[dict], deleted: dict[str, dict]):
    """
    Compare disk files vs songs.json.

    Returns:
        to_remove   — song records in songs.json with no matching .mp4
        to_restore  — deleted records whose .mp4 has reappeared
        to_add      — new .mp4 files not in songs.json or deleted list
    """
    disk = {p.stem: p for p in mp4_files}
    existing_sources = {s["source"] for s in songs}

    to_remove  = [s for s in songs  if s["source"] not in disk]
    to_restore = [deleted[stem] for stem in disk if stem in deleted and stem not in existing_sources]
    to_add     = [p for stem, p in disk.items() if stem not in existing_sources and stem not in deleted]

    return to_remove, to_restore, to_add


def _obs_diff(songs: list[dict], obs_sources: dict[str, int], mp4_map: dict[str, Path]):
    """
    Compare songs.json vs the OBS sources that belong to this project.

    Only sources whose name starts with OBS_SOURCE_PREFIX are considered —
    we never touch sources owned by other sub-projects.

    Returns:
        to_create — songs that have no corresponding prefixed OBS source
        to_delete — prefixed OBS sources with no matching songs.json entry
    """
    # The OBS name for a song is OBS_SOURCE_PREFIX + song["source"]
    expected_obs_names = {
        OBS_SOURCE_PREFIX + s["source"]
        for s in songs
        if s["source"] in mp4_map
    }

    # Filter to only the sources that belong to this project
    our_sources = {
        name: iid
        for name, iid in obs_sources.items()
        if name.startswith(OBS_SOURCE_PREFIX)
    }

    to_create = [
        s for s in songs
        if s["source"] in mp4_map
        and OBS_SOURCE_PREFIX + s["source"] not in our_sources
    ]
    to_delete = [
        (name, iid)
        for name, iid in our_sources.items()
        if name not in expected_obs_names
    ]
    return to_create, to_delete


# ─────────────────────────────────────────────────────────────────────────────
#  Preview (dry-run)
# ─────────────────────────────────────────────────────────────────────────────

def preview(mp4_files: list[Path]) -> None:
    songs   = _load_songs()
    deleted = _load_deleted()
    mp4_map = {p.stem: p for p in mp4_files}

    to_remove, to_restore, to_add = _json_diff(mp4_files, songs, deleted)

    print("\n  ── Layer 1→2 : songs.json ──────────────────────────────────────")
    if not any([to_remove, to_restore, to_add]):
        print("  ✅  songs.json already matches the assets folder.")
    for s in to_remove:
        print(f"  REMOVE   source='{s['source']}' name='{s['name']}'")
    for s in to_restore:
        print(f"  RESTORE  source='{s['source']}' name='{s['name']}'  (aliases preserved)")
    for p in to_add:
        print(f"  ADD      source='{p.stem}'  ←  {p.name}")

    print("\n  ── Layer 2→3 : OBS sources ─────────────────────────────────────")
    print(f"  (OBS source prefix: '{OBS_SOURCE_PREFIX}')")
    req = _connect_obs()
    if req is None:
        return
    if not _ensure_scene(req):
        return

    # Simulate what songs.json would look like after applying Layer 1→2
    remove_sources = {s["source"] for s in to_remove}
    sim  = [s for s in songs if s["source"] not in remove_sources]
    sim += to_restore
    sim += [
        {"id": p.stem, "name": p.stem.replace("_", " ").title(), "source": p.stem, "aliases": []}
        for p in to_add
    ]

    obs_sources          = _get_obs_sources(req)
    to_create, to_delete = _obs_diff(sim, obs_sources, mp4_map)

    if not any([to_create, to_delete]):
        print("  ✅  OBS sources already match songs.json.")
    for name, _ in to_delete:
        print(f"  DELETE   OBS source '{name}'")
    for s in to_create:
        obs_name = OBS_SOURCE_PREFIX + s["source"]
        print(f"  CREATE   OBS source '{obs_name}'  (file: {s['source']}.mp4)")

    print("\n  Run with --apply to make these changes.")


# ─────────────────────────────────────────────────────────────────────────────
#  Apply
# ─────────────────────────────────────────────────────────────────────────────

def apply(mp4_files: list[Path]) -> None:
    songs   = _load_songs()
    deleted = _load_deleted()
    mp4_map = {p.stem: p for p in mp4_files}

    to_remove, to_restore, to_add = _json_diff(mp4_files, songs, deleted)

    print("\n  ── Layer 1→2 : songs.json ──────────────────────────────────────")
    changed = False

    if to_remove:
        rm_sources = {s["source"] for s in to_remove}
        for s in to_remove:
            deleted[s["source"]] = s
            print(f"  Removed   '{s['source']}' (saved to deleted_songs.json)")
        songs   = [s for s in songs if s["source"] not in rm_sources]
        changed = True

    if to_restore:
        for s in to_restore:
            songs.append(s)
            deleted.pop(s["source"], None)
            print(f"  Restored  '{s['source']}' (aliases preserved)")
        changed = True

    if to_add:
        for p in to_add:
            entry = {
                "id"     : p.stem,
                "name"   : p.stem.replace("_", " ").title(),
                "source" : p.stem,
                "aliases": [],
            }
            songs.append(entry)
            print(f"  Added     '{p.stem}'  ←  {p.name}")
        changed = True

    if changed:
        _save_songs(songs)
        _save_deleted(deleted)
        print(
            f"\n  songs.json saved ({len(songs)} songs).  "
            f"Add aliases manually for better voice recognition."
        )
    else:
        print("  Already in sync — no changes to songs.json.")

    print("\n  ── Layer 2→3 : OBS sources ─────────────────────────────────────")
    print(f"  (OBS source prefix: '{OBS_SOURCE_PREFIX}')")
    req = _connect_obs()
    if req is None:
        return
    if not _ensure_scene(req):
        return

    obs_sources          = _get_obs_sources(req)
    to_create, to_delete = _obs_diff(songs, obs_sources, mp4_map)

    if not any([to_create, to_delete]):
        print("  Already in sync — no changes to OBS.")
        return

    deleted_ok = created_ok = failed = 0

    if to_delete:
        print(f"\n  Deleting {len(to_delete)} stale OBS source(s)…")
        for name, iid in to_delete:
            if _obs_delete(req, name, iid):
                print(f"  Deleted  '{name}'")
                deleted_ok += 1
            else:
                failed += 1

    if to_create:
        print(f"\n  Creating {len(to_create)} new OBS source(s)…")
        for s in to_create:
            mp4 = mp4_map.get(s["source"])
            if mp4 is None:
                print(f"  ⚠  No .mp4 found for source '{s['source']}' — skipping.")
                continue
            obs_name = OBS_SOURCE_PREFIX + s["source"]
            if _obs_create(req, obs_name, mp4):
                print(f"  Created  '{obs_name}'  (file: {s['source']}.mp4)")
                created_ok += 1
            else:
                failed += 1

    suffix = f", {failed} failed" if failed else ""
    print(f"\n  OBS sync done — {deleted_ok} deleted, {created_ok} created{suffix}.")


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    do_apply = "--apply" in sys.argv

    print("=" * 62)
    print("  Specific Song — Full Sync")
    print(f"  Assets dir  : {ASSETS_DIR}")
    print(f"  songs.json  : {SONGS_JSON}")
    print(f"  OBS scene   : {SCENE}")
    print(f"  OBS prefix  : {OBS_SOURCE_PREFIX!r}")
    print(f"  OBS host    : {OBS_HOST}:{OBS_PORT}")
    print("=" * 62)

    if not ASSETS_DIR.exists():
        print(f"\n  ❌  ASSETS_DIR not found: {ASSETS_DIR}")
        print("      Update ASSETS_DIR in config.py and try again.")
        return

    mp4_files = sorted(ASSETS_DIR.glob("*.mp4"))
    print(f"\n  Found {len(mp4_files)} .mp4 file(s) in assets dir.")

    if do_apply:
        apply(mp4_files)
    else:
        preview(mp4_files)
        print()


if __name__ == "__main__":
    main()
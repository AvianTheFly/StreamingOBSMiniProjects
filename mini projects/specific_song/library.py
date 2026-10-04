"""Load song aliases, categories and manual bindings without playback state."""
from __future__ import annotations

import json
from pathlib import Path

from lib.json_store import write_json
from lib.settings_backups import SettingsBackups

_TAG = "[specific_song]"


def load_library(songs_path: Path, project_dir: Path) -> list[dict]:
    if not songs_path.exists():
        print(f"{_TAG} ⚠  songs.json not found at {songs_path}")
        print(f"{_TAG}    Run  full_sync.py --apply  to generate it.")
        return []
    with open(songs_path, encoding="utf-8") as f:
        data = json.load(f)

    # Merge aliases from phrases.json (managed by the hotkey editor)
    phrases_path = project_dir / "phrases.json"
    if phrases_path.exists():
        try:
            raw = json.loads(phrases_path.read_text(encoding="utf-8"))
            ext_phrases = {
                k: v for k, v in raw.items()
                if not k.startswith("_") and isinstance(v, list)
            }
            for song in data:
                source = song.get("source", "")
                if source and source in ext_phrases:
                    existing = set(song.get("aliases", []))
                    extra    = {str(a).strip() for a in ext_phrases[source] if str(a).strip()}
                    song["aliases"] = sorted(existing | extra)
        except Exception as e:
            print(f"{_TAG} ⚠  Could not merge phrases.json: {e}")
    else:
        # Bootstrap phrases.json from existing aliases on first run
        try:
            bootstrap = {}
            for song in data:
                if song.get("aliases") and song.get("source"):
                    bootstrap[song["source"]] = song["aliases"]
            if bootstrap:
                payload = {
                    "_comment": "Keys are song source stems. Values are alternate voice phrases.",
                    **bootstrap,
                }
                SettingsBackups().snapshot()
                write_json(phrases_path, payload)
                print(f"{_TAG} 📝  Bootstrapped phrases.json from {len(bootstrap)} song alias(es).")
        except Exception:
            pass

    print(f"{_TAG} 📚  {len(data)} song(s) loaded from songs.json")
    for s in data:
        aliases = s.get("aliases", [])
        alias_str = f"  +{len(aliases)} alias(es)" if aliases else ""
        print(f"     • {s['name']}{alias_str}")
    return data


def load_categories(project_dir: Path) -> dict[str, list[str]]:
    # Prefer the hotkey editor's state file (categories + sound_categories)
    editor_state_path = project_dir / "hotkeys_editor.json"
    if editor_state_path.exists():
        try:
            state     = json.loads(editor_state_path.read_text(encoding="utf-8"))
            profiles  = state.get("profiles", {})
            live_prof = state.get("live_profile", "default")
            profile   = profiles.get(live_prof) or profiles.get("default") or {}
            cat_names = [str(c) for c in profile.get("categories", []) if str(c).strip()]
            if cat_names:
                result: dict[str, list[str]] = {cat: [] for cat in cat_names}
                for stem, cats in profile.get("sound_categories", {}).items():
                    for cat in (cats if isinstance(cats, list) else [cats]):
                        if cat in result:
                            result[cat].append(str(stem))
                print(f"{_TAG} 🏷  {len(result)} category(ies) from editor: "
                      f"{', '.join(sorted(result)) or '(none)'}")
                return result
        except Exception as e:
            print(f"{_TAG} ⚠  Could not read editor categories: {e}")

    # Fallback: categories.json (hub UI or manual)
    cats_path = project_dir / "categories.json"
    if not cats_path.exists():
        return {}
    try:
        with open(cats_path, encoding="utf-8") as f:
            data = json.load(f)
        print(f"{_TAG} 🏷  {len(data)} category(ies) loaded: {', '.join(sorted(data)) or '(none)'}")
        return data
    except Exception as e:
        print(f"{_TAG} ⚠  Could not load categories.json: {e}")
        return {}


def load_manual_triggers(project_dir: Path, fallback: dict[str, str]) -> dict[str, str]:
    """Load manual trigger hotkeys from hotkeys.json (written by the hotkey editor)."""
    hotkeys_path = project_dir / "hotkeys.json"
    if hotkeys_path.exists():
        try:
            raw = json.loads(hotkeys_path.read_text(encoding="utf-8"))
            loaded = {k: v for k, v in raw.items()
                      if isinstance(k, str) and isinstance(v, str)}
            if loaded:
                return loaded
        except Exception:
            pass
    return dict(fallback)  # fallback to config.py constants


"""Audio settings and OBS fader reconciliation.

The loaded asset owns a shared-source fader. All disk/OBS reconciliation keeps
the existing audio_settings_transaction lock; this module starts no workers.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any
from lib.paths import PROJECT_ROOT
from lib.project_settings import audio_settings_transaction

_audio_sync_suppressed_until: dict[str, float] = {}
_LOVE_ME_AUDIO_FILE = PROJECT_ROOT / "mini projects" / "love_me" / "hub_audio.json"

def scan_audio_assets(asset_dir: Path | None, valid_extensions: set[str] | None) -> list[str]:
    if asset_dir is None or not asset_dir.is_dir():
        return []
    allowed = {str(ext).lower() for ext in (valid_extensions or set())}
    stems: list[str] = []
    for path in sorted(asset_dir.iterdir(), key=lambda item: item.name.lower()):
        if not path.is_file():
            continue
        if allowed and path.suffix.lower() not in allowed:
            continue
        stems.append(path.stem)
    return stems


def editor_state_file_for_project(project_info) -> Path | None:
    hotkeys_file = getattr(project_info, "hotkeys_file", None)
    if not hotkeys_file:
        return None
    hotkeys_path = Path(hotkeys_file)
    return hotkeys_path.parent / f"{hotkeys_path.stem}_editor.json"


def read_json_object(path: Path | None) -> dict[str, Any]:
    if path is None or not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def write_json_object(path: Path | None, data: dict[str, Any]) -> None:
    if path is None:
        return
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def love_me_audio_items() -> list[dict[str, str]]:
    try:
        import runpy
    except Exception:
        return []

    config_path = PROJECT_ROOT / "mini projects" / "love_me" / "config.py"
    if not config_path.is_file():
        return []

    try:
        items_raw = runpy.run_path(str(config_path)).get("ITEMS", [])
    except Exception:
        return []

    items: list[dict[str, str]] = []
    for item in items_raw:
        if not isinstance(item, dict):
            continue
        monitor = str(item.get("monitor_name") or "").strip()
        display = str(item.get("display_name") or monitor).strip()
        if not monitor:
            continue
        items.append({"stem": monitor, "display": display})
    return items


def default_love_me_audio_state() -> dict[str, Any]:
    return {
        "project_volume_db": 0.0,
        "profile_volume_db": 0.0,
        "file_volume_offsets": {},
    }


def load_love_me_audio_state() -> dict[str, Any]:
    raw = read_json_object(_LOVE_ME_AUDIO_FILE)
    state = default_love_me_audio_state()
    if isinstance(raw.get("project_volume_db"), (int, float, str)):
        try:
            state["project_volume_db"] = float(raw.get("project_volume_db") or 0.0)
        except (TypeError, ValueError):
            pass
    if isinstance(raw.get("profile_volume_db"), (int, float, str)):
        try:
            state["profile_volume_db"] = float(raw.get("profile_volume_db") or 0.0)
        except (TypeError, ValueError):
            pass
    offsets = raw.get("file_volume_offsets") if isinstance(raw.get("file_volume_offsets"), dict) else {}
    clean_offsets: dict[str, float] = {}
    for stem, value in offsets.items():
        name = str(stem).strip()
        if not name:
            continue
        try:
            clean_offsets[name] = float(value)
        except (TypeError, ValueError):
            continue
    state["file_volume_offsets"] = clean_offsets
    return state


def save_love_me_audio_state(state: dict[str, Any]) -> None:
    _LOVE_ME_AUDIO_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def apply_love_me_audio_state(state: dict[str, Any]) -> None:
    try:
        import obs
    except Exception:
        return

    project_db = float(state.get("project_volume_db") or 0.0)
    profile_db = float(state.get("profile_volume_db") or 0.0)
    offsets = state.get("file_volume_offsets") if isinstance(state.get("file_volume_offsets"), dict) else {}

    for item in love_me_audio_items():
        stem = item["stem"]
        effective_db = round(project_db + profile_db + float(offsets.get(stem, 0.0) or 0.0), 2)
        try:
            obs.set_input_volume_db(stem, effective_db)
        except Exception:
            continue


def love_me_audio_payload() -> dict[str, Any] | None:
    items = love_me_audio_items()
    if not items:
        return None

    state = load_love_me_audio_state()
    project_db = float(state.get("project_volume_db") or 0.0)
    profile_db = float(state.get("profile_volume_db") or 0.0)
    offsets = state.get("file_volume_offsets") if isinstance(state.get("file_volume_offsets"), dict) else {}

    files = []
    for item in items:
        stem = item["stem"]
        offset = float(offsets.get(stem, 0.0) or 0.0)
        files.append({
            "stem": stem,
            "display": item["display"],
            "categories": [],
            "offset_db": round(offset, 2),
            "effective_db": round(project_db + profile_db + offset, 2),
        })

    return {
        "key": "love_me",
        "name": "Love Me",
        "project_volume_db": round(project_db, 2),
        "profiles": [{
            "name": "default",
            "live": True,
            "profile_volume_db": round(profile_db, 2),
            "effective_db": round(project_db + profile_db, 2),
            "files": files,
        }],
    }


def save_love_me_audio_payload(body: dict[str, Any]) -> None:
    state = load_love_me_audio_state()
    if "project_volume_db" in body:
        try:
            state["project_volume_db"] = float(body.get("project_volume_db") or 0.0)
        except (TypeError, ValueError):
            pass

    payload_profiles = body.get("profiles") if isinstance(body.get("profiles"), dict) else {}
    default_profile = payload_profiles.get("default") if isinstance(payload_profiles.get("default"), dict) else {}
    if "profile_volume_db" in default_profile:
        try:
            state["profile_volume_db"] = float(default_profile.get("profile_volume_db") or 0.0)
        except (TypeError, ValueError):
            pass
    if isinstance(default_profile.get("file_volume_offsets"), dict):
        next_offsets: dict[str, float] = {}
        for stem, value in default_profile["file_volume_offsets"].items():
            name = str(stem).strip()
            if not name:
                continue
            try:
                number = float(value)
            except (TypeError, ValueError):
                continue
            if abs(number) > 0.05:
                next_offsets[name] = number
        state["file_volume_offsets"] = next_offsets

    save_love_me_audio_state(state)
    apply_love_me_audio_state(state)


def runtime_audio_bindings() -> dict[str, dict[str, Any]]:
    try:
        from shared import project_registry
    except Exception:
        return {}

    bindings: dict[str, dict[str, Any]] = {}
    for iface in project_registry.all():
        if not getattr(iface, "produces_audio", False):
            continue
        getter = getattr(iface, "volume_state", None)
        if not callable(getter):
            continue
        try:
            payload = getter() or {}
        except Exception:
            continue
        if isinstance(payload, dict):
            bindings[str(getattr(iface, "name", "") or "")] = payload
    return bindings


def project_audio_context(
    project_key: str,
    project_info,
    *,
    runtime: dict[str, Any] | None = None,
) -> tuple[Path | None, dict[str, Any], str, str, str] | None:
    runtime = runtime or {}
    current_stem = str(runtime.get("current_stem") or "").strip()
    source_name = str(runtime.get("source_name") or "").strip()
    if not current_stem and project_key in {'soundboard', 'tik_tok'}:
        # Shared-source faders remain editable while stopped. Attribute the
        # change to the file still loaded in OBS, rather than dropping it.
        defaults = project_info.config_defaults or {}
        prefix = defaults.get('obs_source_prefix')
        if prefix:
            source_name = f'{prefix}player'
            loaded = str(obs_input_settings(source_name).get('local_file') or '')
            current_stem = Path(loaded).stem if loaded else ''
    if not current_stem or not source_name:
        return None

    state_file = editor_state_file_for_project(project_info)
    state = read_json_object(state_file)
    profiles = state.get("profiles")
    if not isinstance(profiles, dict) or not profiles:
        profiles = {"default": {}}
        state["profiles"] = profiles

    profile_name = str(runtime.get("profile") or state.get("live_profile") or state.get("active_profile") or next(iter(profiles)))
    if profile_name not in profiles:
        profiles[profile_name] = {}
    profile = profiles[profile_name]
    if not isinstance(profile, dict):
        profile = {}
        profiles[profile_name] = profile

    return state_file, state, profile_name, current_stem, source_name


def obs_input_settings(source_name: str) -> dict[str, Any]:
    try:
        import obs
    except Exception:
        return {}

    client = obs.get_obs()
    try:
        resp = client.send("GetInputSettings", {"inputName": source_name}, raw=True)
    except TypeError:
        try:
            resp = client.send("GetInputSettings", {"inputName": source_name})
        except Exception:
            return {}
    except Exception:
        return {}

    if isinstance(resp, dict):
        settings = resp.get("inputSettings") or resp.get("input_settings") or {}
        return settings if isinstance(settings, dict) else {}
    settings = getattr(resp, "input_settings", None) or getattr(resp, "inputSettings", None) or {}
    return settings if isinstance(settings, dict) else {}


def obs_source_matches_runtime_stem(source_name: str, stem: str) -> bool:
    try:
        import obs
    except Exception:
        return False

    stem = str(stem or "").strip()
    if not stem:
        return False

    # Browser sources load a fixed page; their owning session knows the asset.
    from lib.browser_effects.runtime import find_channel
    from lib.browser_effects.obs_source import source_name as browser_source_name
    if source_name == browser_source_name('soundboard'):
        channel = find_channel('soundboard')
        return bool(channel and channel.matches(stem))

    settings = obs_input_settings(source_name)
    local_file = str(settings.get("local_file") or "").strip()
    if not local_file:
        return False

    return Path(local_file).stem.casefold() == stem.casefold()


def stem_value(mapping, stem, default=0.0):
    return next((value for key, value in (mapping or {}).items()
                 if str(key).casefold() == stem.casefold()), default)


def category_db(profile, stem):
    categories = stem_value(profile.get('sound_categories'), stem, [])
    if isinstance(categories, str):
        categories = [categories]
    return float((profile.get('category_volume_db') or {}).get(categories[0], 0.0)) if categories else 0.0


@audio_settings_transaction
def sync_audio_memory_from_obs(project_key: str | None = None) -> set[str]:
    changed: set[str] = set()
    try:
        import obs
        from lib.project_registry import discover_editor_projects
    except Exception:
        return changed

    projects = discover_editor_projects()
    runtime_bindings = runtime_audio_bindings()

    for key, project_info in projects.items():
        if project_key and key != project_key:
            continue
        if time.monotonic() < _audio_sync_suppressed_until.get(key, 0.0):
            continue
        runtime = runtime_bindings.get(key) or {}
        context = project_audio_context(key, project_info, runtime=runtime)
        if context is None:
            continue

        state_file, state, profile_name, current_stem, source_name = context
        if runtime.get("shared_volume"):
            # Music keeps one shared OBS source loaded even while stopped.  Its
            # fader remains a valid user edit in that idle state.
            settings = obs_input_settings(source_name)
            loaded_file = str(settings.get("local_file") or "").strip()
            if not loaded_file or Path(loaded_file).stem.casefold() != current_stem.casefold():
                continue
        elif not obs_source_matches_runtime_stem(source_name, current_stem):
            continue
        volume = obs.get_input_volume(source_name) or {}
        live_db = volume.get("db")
        if live_db is None:
            continue

        profiles = state["profiles"]
        profile = profiles[profile_name]
        project_db = float(profile.get("project_volume_db") or 0.0)
        profile_db = float(profile.get("profile_volume_db") or 0.0)
        offsets = profile.setdefault("file_volume_offsets", {})
        if not isinstance(offsets, dict):
            offsets = {}
            profile["file_volume_offsets"] = offsets

        # The source is shared, but its fader belongs to the currently loaded
        # asset. Never turn an asset edit into a project-wide volume shift.
        if not obs_source_matches_runtime_stem(source_name, current_stem):
            continue
        next_offset = round(float(live_db) - project_db - profile_db - category_db(profile, current_stem), 2)
        prev_offset = float(stem_value(offsets, current_stem))
        if abs(prev_offset - next_offset) <= 0.05:
            continue

        for old_key in list(offsets):
            if old_key.casefold() == current_stem.casefold():
                offsets.pop(old_key)
        if abs(next_offset) <= 0.05:
            offsets.pop(current_stem, None)
        else:
            offsets[current_stem] = next_offset

        write_json_object(state_file, state)
        changed.add(key)

    return changed


@audio_settings_transaction
def apply_live_audio_to_obs(project_key: str) -> bool:
    try:
        import obs
        from lib.project_registry import discover_editor_projects
    except Exception:
        return False

    project_info = discover_editor_projects().get(project_key)
    if project_info is None:
        return False

    runtime = runtime_audio_bindings().get(project_key) or {}
    context = project_audio_context(project_key, project_info, runtime=runtime)
    if context is None:
        return False

    _state_file, state, profile_name, current_stem, source_name = context
    if runtime.get('shared_volume'):
        loaded = str(obs_input_settings(source_name).get('local_file') or '')
        if not loaded or Path(loaded).stem.casefold() != current_stem.casefold():
            return False
    elif not obs_source_matches_runtime_stem(source_name, current_stem):
        return False
    profiles = state["profiles"]
    profile = profiles[profile_name]
    offsets = profile.get("file_volume_offsets") if isinstance(profile.get("file_volume_offsets"), dict) else {}
    project_db = float(profile.get("project_volume_db") or 0.0)
    profile_db = float(profile.get("profile_volume_db") or 0.0)
    file_db = float(stem_value(offsets, current_stem))
    effective_db = round(project_db + profile_db + category_db(profile, current_stem) + file_db, 2)
    obs.set_input_volume_db(source_name, effective_db)
    return True


def suppress_sync(project_key: str) -> None:
    """Ignore the brief disk/OBS echo window after a UI fader write."""
    _audio_sync_suppressed_until[project_key] = time.monotonic() + 1.0

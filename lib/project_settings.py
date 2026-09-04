from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


HotkeyValue = str | list[str]
_STATE_LOCKS: dict[str, threading.Lock] = {}


@dataclass(frozen=True, slots=True)
class SoundSettings:
    stem: str
    display_name: str
    categories: tuple[str, ...] = ()
    path: Path | None = None
    filename: str = ""


@dataclass(frozen=True, slots=True)
class HotkeyGroup:
    key: str
    name: str
    stems: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ProjectSettings:
    project_dir: Path
    hotkeys_file: Path
    editor_state_file: Path
    profile_name: str
    profile_trigger_sequences: str = ""
    hotkeys: dict[str, HotkeyValue] = field(default_factory=dict)
    group_names: dict[str, str] = field(default_factory=dict)
    display_names: dict[str, str] = field(default_factory=dict)
    categories: tuple[str, ...] = ()
    sound_categories: dict[str, tuple[str, ...]] = field(default_factory=dict)
    interface_hotkeys: dict[str, str] = field(default_factory=dict)
    project_volume_db: float = 0.0
    profile_volume_db: float = 0.0
    category_volume_db: dict[str, float] = field(default_factory=dict)
    file_volume_offsets: dict[str, float] = field(default_factory=dict)
    sounds: dict[str, SoundSettings] = field(default_factory=dict)

    def group_name(self, key: str, default: str = "") -> str:
        return self.group_names.get(key, default)

    def display_name(self, stem: str) -> str:
        stem_key = str(stem).strip().lower()
        return self.display_names.get(stem_key) or stem

    def categories_for(self, stem: str) -> tuple[str, ...]:
        stem_key = str(stem).strip().lower()
        return self.sound_categories.get(stem_key, ())

    def stems_in_category(self, category: str) -> tuple[str, ...]:
        needle = category.strip().lower()
        return tuple(
            stem
            for stem, categories in self.sound_categories.items()
            if any(item.lower() == needle for item in categories)
        )

    def asset_for_stem(self, stem: str) -> Path | None:
        sound = self.sounds.get(str(stem).strip().lower())
        return sound.path if sound else None

    @property
    def groups(self) -> dict[str, HotkeyGroup]:
        return {
            key: HotkeyGroup(
                key=key,
                name=self.group_names.get(key, ""),
                stems=tuple(_hotkey_stems(value)),
            )
            for key, value in self.hotkeys.items()
        }


def load_project_settings(
    project_dir: Path,
    *,
    hotkeys_file: Path | None = None,
    asset_dir: Path | None = None,
    valid_extensions: set[str] | None = None,
    profile: str | None = None,
) -> ProjectSettings:
    """Load normalized settings written by the hotkey editor.

    The editor stores rich UI state in ``*_editor.json`` and mirrors the live
    hotkeys into the legacy ``hotkeys.json`` file. This loader prefers the
    editor state when present, then falls back to the legacy file.
    """

    project_dir = Path(project_dir)
    hotkeys_file = Path(hotkeys_file) if hotkeys_file else project_dir / "hotkeys.json"
    editor_state_file = hotkeys_file.parent / f"{hotkeys_file.stem}_editor.json"

    profile_name = "default"
    profile_data: dict[str, Any] = {}

    state = _read_json_object(editor_state_file)
    if state:
        profiles = state.get("profiles")
        if isinstance(profiles, dict) and profiles:
            selected = profile or state.get("live_profile") or state.get("active_profile")
            if selected not in profiles:
                selected = next(iter(profiles))
            profile_name = str(selected)
            raw_profile = profiles.get(profile_name)
            if isinstance(raw_profile, dict):
                profile_data = raw_profile

    if not profile_data:
        profile_data = {"hotkeys": _read_legacy_hotkeys(hotkeys_file)}

    hotkeys = _normalize_hotkeys(profile_data.get("hotkeys"))
    group_names = _string_dict(profile_data.get("group_names"))
    display_names = _stem_keyed_string_dict(profile_data.get("display_names"))
    categories = tuple(_string_list(profile_data.get("categories")))
    sound_categories = {
        stem: tuple(items)
        for stem, items in _stem_keyed_category_map(profile_data.get("sound_categories")).items()
    }
    interface_hotkeys = _string_dict(profile_data.get("interface_hotkeys"))
    project_volume_db = _number(profile_data.get("project_volume_db"), 0.0)
    profile_volume_db = _number(profile_data.get("profile_volume_db"), 0.0)
    category_volume_db = _number_dict(profile_data.get("category_volume_db"))
    file_volume_offsets = _stem_keyed_number_dict(profile_data.get("file_volume_offsets"))
    sounds = _scan_sound_settings(
        asset_dir=asset_dir,
        valid_extensions=valid_extensions,
        display_names=display_names,
        sound_categories=sound_categories,
    )

    return ProjectSettings(
        project_dir=project_dir,
        hotkeys_file=hotkeys_file,
        editor_state_file=editor_state_file,
        profile_name=profile_name,
        hotkeys=hotkeys,
        profile_trigger_sequences=str(profile_data.get("trigger_sequences") or ""),
        group_names=group_names,
        display_names=display_names,
        categories=categories,
        sound_categories=sound_categories,
        interface_hotkeys=interface_hotkeys,
        project_volume_db=project_volume_db,
        profile_volume_db=profile_volume_db,
        category_volume_db=category_volume_db,
        file_volume_offsets=file_volume_offsets,
        sounds=sounds,
    )


def shift_project_volume_db(
    project_dir: Path,
    delta_db: float,
    *,
    hotkeys_file: Path | None = None,
) -> bool:
    """Shift every profile by the same amount and persist it.

    This is used when the user moves a shared source's fader directly in OBS.
    Per-file offsets stay intact, so the OBS move behaves like the project-level
    slider in the Hub.
    """
    delta = float(delta_db)
    if abs(delta) <= 0.05:
        return False

    project_dir = Path(project_dir)
    hotkeys_file = Path(hotkeys_file) if hotkeys_file else project_dir / "hotkeys.json"
    state_file = hotkeys_file.parent / f"{hotkeys_file.stem}_editor.json"
    lock = _STATE_LOCKS.setdefault(str(state_file), threading.Lock())
    with lock:
        state = _read_json_object(state_file)
        profiles = state.get("profiles")
        if not isinstance(profiles, dict) or not profiles:
            profiles = {"default": {}}
            state["profiles"] = profiles
            state.setdefault("live_profile", "default")
            state.setdefault("active_profile", "default")
        for name, raw_profile in list(profiles.items()):
            profile = raw_profile if isinstance(raw_profile, dict) else {}
            try:
                current = float(profile.get("project_volume_db") or 0.0)
            except (TypeError, ValueError):
                current = 0.0
            profile["project_volume_db"] = round(current + delta, 2)
            profiles[name] = profile
        state_file.write_text(
            json.dumps(state, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    return True


def load_project_profile_summaries(project_dir: Path, *, hotkeys_file: Path | None = None) -> list[dict[str, Any]]:
    project_dir = Path(project_dir)
    hotkeys_file = Path(hotkeys_file) if hotkeys_file else project_dir / "hotkeys.json"
    editor_state_file = hotkeys_file.parent / f"{hotkeys_file.stem}_editor.json"
    state = _read_json_object(editor_state_file)
    profiles = state.get("profiles") if isinstance(state.get("profiles"), dict) else {}
    if not profiles:
        hotkeys = _read_legacy_hotkeys(hotkeys_file)
        return [{
            "name": "default",
            "live": True,
            "trigger_sequences": "",
            "hotkey_count": len(hotkeys),
            "hotkeys": sorted(str(key) for key in hotkeys.keys()),
            "hotkey_map": hotkeys,
        }] if hotkeys else []
    live = str(state.get("live_profile") or state.get("active_profile") or "")
    result: list[dict[str, Any]] = []
    for name, profile in sorted(profiles.items()):
        if not isinstance(profile, dict):
            continue
        hotkeys = _normalize_hotkeys(profile.get("hotkeys"))
        result.append({
            "name": str(name),
            "live": str(name) == live,
            "trigger_sequences": str(profile.get("trigger_sequences") or ""),
            "hotkey_count": len(hotkeys),
            "hotkeys": sorted(hotkeys.keys()),
            "hotkey_map": hotkeys,
            "interface_hotkeys": _string_dict(profile.get("interface_hotkeys")),
            "project_volume_db": _number(profile.get("project_volume_db"), 0.0),
            "profile_volume_db": _number(profile.get("profile_volume_db"), 0.0),
        })
    return result


def _read_json_object(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _read_legacy_hotkeys(path: Path) -> dict[str, Any]:
    raw = _read_json_object(path)
    return raw if raw else {}


def _normalize_hotkeys(raw: Any) -> dict[str, HotkeyValue]:
    if not isinstance(raw, dict):
        return {}

    result: dict[str, HotkeyValue] = {}
    for key, value in raw.items():
        key_text = str(key)
        if not key_text:
            continue
        stems = _hotkey_stems(value)
        if len(stems) == 1:
            result[key_text] = stems[0]
        elif len(stems) > 1:
            result[key_text] = stems
    return result


def _hotkey_stems(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    if value:
        return [str(value)]
    return []


def _string_dict(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {str(key): str(value) for key, value in raw.items() if str(value).strip()}


def _stem_keyed_string_dict(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    result: dict[str, str] = {}
    for key, value in raw.items():
        stem = str(key).strip().lower()
        text = str(value)
        if stem and text.strip():
            result[stem] = text
    return result


def _string_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    seen: set[str] = set()
    result: list[str] = []
    for item in raw:
        text = str(item).strip()
        folded = text.lower()
        if text and folded not in seen:
            result.append(text)
            seen.add(folded)
    return result


def _number(raw: Any, default: float = 0.0) -> float:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return float(default)


def _number_dict(raw: Any) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    result: dict[str, float] = {}
    for key, value in raw.items():
        stem = str(key).strip()
        if not stem:
            continue
        try:
            result[stem] = float(value)
        except (TypeError, ValueError):
            continue
    return result


def _stem_keyed_number_dict(raw: Any) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    result: dict[str, float] = {}
    for key, value in raw.items():
        stem = str(key).strip().lower()
        if not stem:
            continue
        try:
            result[stem] = float(value)
        except (TypeError, ValueError):
            continue
    return result


def _category_map(raw: Any) -> dict[str, list[str]]:
    if not isinstance(raw, dict):
        return {}
    return {
        str(stem): _string_list(categories)
        for stem, categories in raw.items()
        if str(stem).strip()
    }


def _stem_keyed_category_map(raw: Any) -> dict[str, list[str]]:
    if not isinstance(raw, dict):
        return {}
    return {
        str(stem).strip().lower(): _string_list(categories)
        for stem, categories in raw.items()
        if str(stem).strip()
    }


def _scan_sound_settings(
    *,
    asset_dir: Path | None,
    valid_extensions: set[str] | None,
    display_names: dict[str, str],
    sound_categories: dict[str, tuple[str, ...]],
) -> dict[str, SoundSettings]:
    if asset_dir is None:
        return {
            stem: SoundSettings(
                stem=stem,
                display_name=display_names.get(stem) or stem,
                categories=categories,
            )
            for stem, categories in sound_categories.items()
        }

    asset_dir = Path(asset_dir)
    if not asset_dir.is_dir():
        return {}

    extensions = {ext.lower() for ext in valid_extensions} if valid_extensions else None
    sounds: dict[str, SoundSettings] = {}
    for path in asset_dir.iterdir():
        if not path.is_file():
            continue
        if extensions is not None and path.suffix.lower() not in extensions:
            continue
        stem = path.stem
        stem_key = stem.lower()
        sounds[stem_key] = SoundSettings(
            stem=stem,
            display_name=display_names.get(stem_key) or stem,
            categories=sound_categories.get(stem_key, ()),
            path=path,
            filename=path.name,
        )
    return sounds

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from lib.hotkeys import load_hotkeys

from .config_overrides import (
    bool_override,
    extensions_override,
    float_override,
    int_override,
    load_config_overrides,
    path_override,
    text_override,
)
from .controls import DEFAULT_INTERFACE_HOTKEYS, normalize_interface_hotkeys
from .media_config import MediaProjectConfig


DEFAULT_EXTENSIONS = {".mp3", ".mp4", ".wav", ".ogg", ".webm", ".m4a", ".mov"}
DEFAULT_FEATURES = {
    "manual_hotkeys_enabled": True,
    "voice_commands_enabled": True,
    "random_commands_enabled": False,
    "categories_enabled": True,
    "obs_layout_enabled": True,
    "audio_settings_enabled": True,
    "trigger_restarts_listen": False,
}


@dataclass(slots=True)
class MediaProfile:
    key: str
    name: str
    root_dir: Path
    profile_dir: Path
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def hotkeys_file(self) -> Path:
        return self.profile_dir / "hotkeys.json"

    @property
    def phrases_file(self) -> Path:
        return self.profile_dir / "phrases.json"

    @property
    def layout_rules_file(self) -> Path:
        return self.profile_dir / "obs_layout_rules.json"

    @property
    def enabled(self) -> bool:
        return bool(self.raw.get("enabled", True))

    @property
    def features(self) -> dict[str, bool]:
        merged = dict(DEFAULT_FEATURES)
        raw_features = self.raw.get("features")
        if isinstance(raw_features, dict):
            merged.update({str(key): bool(value) for key, value in raw_features.items()})
        overrides = load_config_overrides(self.profile_dir)
        for key in list(merged):
            merged[key] = bool_override(overrides, key, merged[key])
        return merged

    def editor_payload(self, *, store_file: Path) -> dict[str, Any]:
        defaults = self.config_defaults()
        return {
            "key": self.key,
            "name": self.name,
            "asset_dir": Path(defaults["asset_dir"]),
            "hotkeys_file": self.hotkeys_file,
            "extensions": set(defaults["valid_extensions"]),
            "config_defaults": defaults,
            "features": self.features,
            "profile_store_file": store_file,
            "can_create_profiles": True,
            "phrases_file": self.phrases_file,
            "profile_dir": self.profile_dir,
        }

    def config_defaults(self) -> dict[str, Any]:
        asset_dir = _asset_dir_from_raw(self.raw, self.profile_dir / "assets")
        valid_extensions = _string_extensions(self.raw.get("valid_extensions"), DEFAULT_EXTENSIONS)
        features = self.features
        matching = self.raw.get("matching") if isinstance(self.raw.get("matching"), dict) else {}
        audio = self.raw.get("audio") if isinstance(self.raw.get("audio"), dict) else {}
        defaults = {
            "asset_dir": str(asset_dir),
            "scene": str(self.raw.get("scene", self.name)),
            "obs_source_prefix": str(self.raw.get("obs_source_prefix", f"{self.key}__")),
            "single_source_mode": bool(self.raw.get("single_source_mode", False)),
            "shared_source_slots": max(1, int(self.raw.get("shared_source_slots", 1) or 1)),
            "valid_extensions": sorted(valid_extensions),
            "trigger_sequences": _format_trigger_sequences(
                self.raw.get("trigger_sequences", [[self.key[0] if self.key else "m"]])
            ),
            "trigger_max_interval": self.raw.get("trigger_max_interval", 0.5),
            "auto_record_timeout": self.raw.get("auto_record_timeout", 2.0),
            "manual_trigger_window": self.raw.get("manual_trigger_window", 1.0),
            "interface_hotkeys": normalize_interface_hotkeys(self.raw.get("interface_hotkeys", DEFAULT_INTERFACE_HOTKEYS)),
            "fuzzy_threshold": matching.get("fuzzy_threshold", self.raw.get("fuzzy_threshold", 75)),
            "semantic_gap": matching.get("semantic_gap", self.raw.get("semantic_gap", 15)),
            "matching_strategy": matching.get("strategy", self.raw.get("matching_strategy", "hybrid")),
            "fuzzy_scorer": matching.get("fuzzy_scorer", self.raw.get("fuzzy_scorer", "WRatio")),
            "fuzzy_weight": matching.get("fuzzy_weight", self.raw.get("fuzzy_weight", 0.70)),
            "token_weight": matching.get("token_weight", self.raw.get("token_weight", 0.30)),
            "embedding_weight": matching.get("embedding_weight", self.raw.get("embedding_weight", 0.0)),
            "embedding_model": matching.get("embedding_model", self.raw.get("embedding_model", "")),
            "media_start_timeout": self.raw.get("media_start_timeout", 5.0),
            "media_total_timeout": self.raw.get("media_total_timeout", 300.0),
            "media_swap_settle_ms": max(0, int(self.raw.get("media_swap_settle_ms", 0) or 0)),
            "default_volume_db": audio.get("default_volume_db", self.raw.get("default_volume_db", 0)),
            "project_volume_db": audio.get("project_volume_db", self.raw.get("project_volume_db", 0)),
            "profile_volume_db": audio.get("profile_volume_db", self.raw.get("profile_volume_db", 0)),
            "monitor": audio.get("monitor", self.raw.get("monitor", "OBS_MONITORING_TYPE_MONITOR_ONLY")),
            "audio_tracks": _format_audio_tracks(audio.get("tracks", self.raw.get("audio_tracks"))),
            "event_name": self.raw.get("event_name", f"{self.key}.play"),
            "verbose_matcher": self.raw.get("verbose_matcher", True),
        }
        defaults.update(features)
        return defaults

    def to_config(self) -> MediaProjectConfig:
        defaults = self.config_defaults()
        overrides = load_config_overrides(self.profile_dir)
        current = {**defaults, **overrides}
        features = {
            key: bool_override(overrides, key, bool(defaults.get(key)))
            for key in DEFAULT_FEATURES
        }
        valid_extensions = extensions_override(
            overrides,
            "valid_extensions",
            set(defaults["valid_extensions"]),
        )
        asset_dir = path_override(overrides, "asset_dir", Path(defaults["asset_dir"]))
        trigger_sequences = _parse_trigger_sequences(str(current.get("trigger_sequences", "")))
        audio_tracks = _parse_audio_tracks(current.get("audio_tracks"))

        return MediaProjectConfig(
            project_name=self.key,
            scene=text_override(overrides, "scene", str(defaults["scene"])),
            event_name=text_override(overrides, "event_name", str(defaults["event_name"])),
            asset_dir=asset_dir,
            obs_source_prefix=text_override(overrides, "obs_source_prefix", str(defaults["obs_source_prefix"])),
            trigger_sequences=trigger_sequences,
            trigger_max_interval=float_override(overrides, "trigger_max_interval", float(defaults["trigger_max_interval"])) or 0.5,
            auto_record_timeout=float_override(overrides, "auto_record_timeout", float(defaults["auto_record_timeout"])) or 2.0,
            manual_trigger_map=load_hotkeys(self.hotkeys_file, self.key),
            manual_trigger_window=float_override(overrides, "manual_trigger_window", float(defaults["manual_trigger_window"])) or 1.0,
            interface_hotkeys=normalize_interface_hotkeys(current.get("interface_hotkeys")),
            valid_extensions=valid_extensions,
            phrases_file=self.phrases_file,
            fuzzy_threshold=int(float_override(overrides, "fuzzy_threshold", float(defaults["fuzzy_threshold"])) or 75),
            semantic_gap=int(float_override(overrides, "semantic_gap", float(defaults["semantic_gap"])) or 15),
            media_start_timeout=float_override(overrides, "media_start_timeout", float(defaults["media_start_timeout"])) or 5.0,
            media_total_timeout=float_override(overrides, "media_total_timeout", float(defaults["media_total_timeout"])) or 300.0,
            media_swap_settle_ms=max(0, int_override(overrides, "media_swap_settle_ms", int(defaults["media_swap_settle_ms"]))),
            verbose_matcher=bool_override(overrides, "verbose_matcher", bool(defaults["verbose_matcher"])),
            project_dir=self.profile_dir,
            features=features,
            manual_hotkeys_enabled=features["manual_hotkeys_enabled"],
            voice_commands_enabled=features["voice_commands_enabled"],
            random_commands_enabled=features["random_commands_enabled"],
            matching_strategy=text_override(overrides, "matching_strategy", str(defaults["matching_strategy"])),
            fuzzy_scorer=text_override(overrides, "fuzzy_scorer", str(defaults["fuzzy_scorer"])),
            fuzzy_weight=float_override(overrides, "fuzzy_weight", float(defaults["fuzzy_weight"])) or 0.70,
            token_weight=float_override(overrides, "token_weight", float(defaults["token_weight"])) or 0.30,
            embedding_weight=float_override(overrides, "embedding_weight", float(defaults["embedding_weight"])) or 0.0,
            embedding_model=text_override(overrides, "embedding_model", str(defaults["embedding_model"])),
            source_bounds=self.raw.get("source_bounds") if isinstance(self.raw.get("source_bounds"), dict) else None,
            monitor=text_override(overrides, "monitor", str(defaults["monitor"])),
            default_volume_db=float_override(overrides, "default_volume_db", float(defaults["default_volume_db"]) if defaults["default_volume_db"] != "" else None),
            project_volume_db=float_override(overrides, "project_volume_db", float(defaults["project_volume_db"]) if defaults["project_volume_db"] != "" else 0.0) or 0.0,
            profile_volume_db=float_override(overrides, "profile_volume_db", float(defaults["profile_volume_db"]) if defaults["profile_volume_db"] != "" else 0.0) or 0.0,
            audio_tracks=audio_tracks,
            single_source_mode=bool_override(overrides, "single_source_mode", bool(defaults["single_source_mode"])),
            shared_source_slots=max(1, int_override(overrides, "shared_source_slots", int(defaults["shared_source_slots"]))),
        )


def load_media_profiles(root_dir: Path, *, include_disabled: bool = False) -> list[MediaProfile]:
    root_dir = Path(root_dir)
    store_file = root_dir / "profiles.json"
    raw = _load_store(store_file)
    profiles = raw.get("profiles", [])
    if not isinstance(profiles, list):
        return []
    result: list[MediaProfile] = []
    for item in profiles:
        if not isinstance(item, dict):
            continue
        key = _sanitize_key(str(item.get("key", "")))
        if not key:
            continue
        profile_dir = root_dir / "profiles" / key
        profile_dir.mkdir(parents=True, exist_ok=True)
        profile = MediaProfile(
            key=key,
            name=str(item.get("name") or key.replace("_", " ").title()),
            root_dir=root_dir,
            profile_dir=profile_dir,
            raw={**item, "key": key},
        )
        _ensure_profile_files(profile)
        if profile.enabled or include_disabled:
            result.append(profile)
    return result


def editor_projects(root_dir: Path) -> list[dict[str, Any]]:
    store_file = Path(root_dir) / "profiles.json"
    return [profile.editor_payload(store_file=store_file) for profile in load_media_profiles(root_dir)]


def create_media_profile(store_file: Path, payload: dict[str, Any]) -> dict[str, Any]:
    store_file = Path(store_file)
    root_dir = store_file.parent
    raw = _load_store(store_file)
    profiles = raw.setdefault("profiles", [])
    if not isinstance(profiles, list):
        profiles = []
        raw["profiles"] = profiles

    name = str(payload.get("name", "")).strip()
    if not name:
        raise ValueError("Profile name is required")
    key = _sanitize_key(str(payload.get("key", "")).strip() or name)
    if not key:
        raise ValueError("Profile key is required")
    if any(isinstance(item, dict) and _sanitize_key(str(item.get("key", ""))) == key for item in profiles):
        raise ValueError(f"Media profile '{key}' already exists")

    features = dict(DEFAULT_FEATURES)
    requested_features = payload.get("features")
    if isinstance(requested_features, dict):
        features.update({str(k): bool(v) for k, v in requested_features.items() if str(k) in features})

    profile = {
        "key": key,
        "name": name,
        "enabled": True,
        "asset_dir": str(payload.get("asset_dir", "")).strip() or str(root_dir / "profiles" / key / "assets"),
        "scene": str(payload.get("scene", "")).strip() or name,
        "obs_source_prefix": str(payload.get("obs_source_prefix", "")).strip() or f"{key}__",
        "single_source_mode": bool(payload.get("single_source_mode", False)),
        "shared_source_slots": max(1, int(payload.get("shared_source_slots", 1) or 1)),
        "event_name": str(payload.get("event_name", "")).strip() or f"{key}.play",
        "trigger_sequences": _parse_trigger_sequences(str(payload.get("trigger_sequences", key[:1] or "m"))),
        "trigger_max_interval": _number(payload.get("trigger_max_interval"), 0.5),
        "auto_record_timeout": _number(payload.get("auto_record_timeout"), 2.0),
        "manual_trigger_window": _number(payload.get("manual_trigger_window"), 1.0),
        "media_swap_settle_ms": max(0, int(payload.get("media_swap_settle_ms", 0) or 0)),
        "valid_extensions": sorted(_string_extensions(payload.get("valid_extensions"), DEFAULT_EXTENSIONS)),
        "features": features,
        "matching": {
            "strategy": str(payload.get("matching_strategy", "hybrid")),
            "fuzzy_scorer": str(payload.get("fuzzy_scorer", "WRatio")),
            "fuzzy_threshold": int(_number(payload.get("fuzzy_threshold"), 75)),
            "semantic_gap": int(_number(payload.get("semantic_gap"), 15)),
            "fuzzy_weight": _number(payload.get("fuzzy_weight"), 0.70),
            "token_weight": _number(payload.get("token_weight"), 0.30),
            "embedding_weight": _number(payload.get("embedding_weight"), 0.0),
        },
        "audio": {
            "monitor": str(payload.get("monitor", "OBS_MONITORING_TYPE_MONITOR_ONLY")),
            "default_volume_db": _number(payload.get("default_volume_db"), 0.0),
        },
    }
    profiles.append(profile)
    _save_store(store_file, raw)

    created = MediaProfile(
        key=key,
        name=name,
        root_dir=root_dir,
        profile_dir=root_dir / "profiles" / key,
        raw=profile,
    )
    created.profile_dir.mkdir(parents=True, exist_ok=True)
    _ensure_profile_files(created)
    return created.editor_payload(store_file=store_file)


def _load_store(store_file: Path) -> dict[str, Any]:
    if not store_file.is_file():
        return {"profiles": []}
    try:
        raw = json.loads(store_file.read_text(encoding="utf-8"))
    except Exception:
        return {"profiles": []}
    return raw if isinstance(raw, dict) else {"profiles": []}


def _save_store(store_file: Path, raw: dict[str, Any]) -> None:
    store_file.write_text(json.dumps(raw, indent=2, ensure_ascii=False), encoding="utf-8")


def _ensure_profile_files(profile: MediaProfile) -> None:
    profile.profile_dir.mkdir(parents=True, exist_ok=True)
    if not profile.hotkeys_file.exists():
        profile.hotkeys_file.write_text("{}", encoding="utf-8")
    if not profile.phrases_file.exists():
        profile.phrases_file.write_text(
            json.dumps(
                {
                    "_comment": (
                        "Keys are canonical asset file stems without extensions. "
                        "Values are alternate phrases that should trigger that asset."
                    )
                },
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    if not profile.layout_rules_file.exists():
        profile.layout_rules_file.write_text(
            json.dumps({"rules": {}, "overrides": {}}, indent=2),
            encoding="utf-8",
        )


def _asset_dir_from_raw(raw: dict[str, Any], fallback: Path) -> Path:
    env_name = str(raw.get("asset_dir_env", "")).strip()
    if env_name and os.environ.get(env_name):
        return Path(os.environ[env_name])
    value = str(raw.get("asset_dir") or raw.get("asset_dir_default") or "").strip()
    return Path(value) if value else fallback


def _string_extensions(raw: Any, default: set[str]) -> set[str]:
    if isinstance(raw, str):
        items = raw.split(",")
    elif isinstance(raw, list):
        items = raw
    else:
        return set(default)
    cleaned = {
        ext if str(ext).strip().startswith(".") else f".{str(ext).strip()}"
        for ext in items
        if str(ext).strip()
    }
    return {item.lower() for item in cleaned} or set(default)


def _format_trigger_sequences(raw: Any) -> str:
    return " ; ".join(" ".join(seq) for seq in _trigger_sequences(raw))


def _parse_trigger_sequences(raw: str) -> list[list[str]]:
    if not raw.strip():
        return []
    groups = [part.strip() for part in raw.split(";") if part.strip()]
    sequences: list[list[str]] = []
    for group in groups:
        if " " in group:
            seq = [item for item in group.split(" ") if item]
        else:
            seq = list(group)
        if seq:
            sequences.append(seq)
    return sequences


def _trigger_sequences(raw: Any) -> list[list[str]]:
    if isinstance(raw, list):
        out: list[list[str]] = []
        for item in raw:
            if isinstance(item, list):
                seq = [str(part) for part in item if str(part)]
            else:
                seq = list(str(item))
            if seq:
                out.append(seq)
        return out
    return _parse_trigger_sequences(str(raw))


def _parse_audio_tracks(raw: Any) -> dict[str, bool] | None:
    if isinstance(raw, dict):
        return {str(key): bool(value) for key, value in raw.items() if str(key).strip()}
    text = str(raw or "").strip()
    if not text:
        return None
    tracks = {str(i): False for i in range(1, 7)}
    for item in re.split(r"[, ]+", text):
        if item in tracks:
            tracks[item] = True
    return tracks if any(tracks.values()) else None


def _format_audio_tracks(raw: Any) -> str:
    tracks = _parse_audio_tracks(raw)
    if not tracks:
        return ""
    return ", ".join(str(key) for key, value in sorted(tracks.items()) if value)


def _sanitize_key(value: str) -> str:
    text = re.sub(r"[^a-z0-9_ -]+", "", value.lower()).strip()
    text = re.sub(r"[\s-]+", "_", text)
    return text.strip("_")


def _number(value: Any, default: float) -> float:
    try:
        if value in ("", None):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default

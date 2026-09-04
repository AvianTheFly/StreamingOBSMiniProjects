from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

import obs


_TRANSFORM_KEYS = {
    "positionX",
    "positionY",
    "rotation",
    "scaleX",
    "scaleY",
    "boundsType",
    "boundsWidth",
    "boundsHeight",
    "alignment",
    "boundsAlignment",
    "cropLeft",
    "cropTop",
    "cropRight",
    "cropBottom",
}
_MEDIA_SETTING_KEYS = {
    "restart_on_activate",
    "close_when_inactive",
    "looping",
    "hw_decode",
    "clear_on_media_end",
    "speed_percent",
}
_TRACK_KEYS = tuple(str(index) for index in range(1, 7))
_STATE_LOCKS: dict[str, threading.Lock] = {}


def state_file_for_project(project_dir: Path) -> Path:
    return Path(project_dir) / "single_source_state.json"


class SingleSourceStateStore:
    def __init__(
        self,
        *,
        project_dir: Path,
        scene: str,
        source_name: str,
        tag: str,
        include_filters: bool = True,
        include_transform: bool = True,
        include_audio: bool = True,
        include_audio_volume: bool = True,
        include_media_settings: bool = True,
    ) -> None:
        self.project_dir = Path(project_dir)
        self.scene = scene
        self.source_name = source_name
        self.tag = tag
        self.include_filters = include_filters
        self.include_transform = include_transform
        self.include_audio = include_audio
        self.include_audio_volume = include_audio_volume
        self.include_media_settings = include_media_settings
        self.path = state_file_for_project(self.project_dir)
        self._lock = _STATE_LOCKS.setdefault(str(self.path), threading.Lock())
        self._data = self._load()
        changed = False
        if not self.include_filters and self._strip_filters_from_state():
            changed = True
        if not self.include_audio_volume and self._strip_volume_from_state():
            changed = True
        if changed:
            self._save()

    def ensure_baseline(self) -> None:
        with self._lock:
            self._data = self._load()
            if isinstance(self._data.get("baseline"), dict):
                return
            self._data["baseline"] = self.snapshot_current_state()
            self._save()
            print(f"{self.tag} Captured single-source baseline for '{self.source_name}'.")

    def apply_for_stem(self, stem: str) -> None:
        self.ensure_baseline()
        with self._lock:
            self._data = self._load()
        baseline = _normalize_snapshot(self._data.get("baseline"))
        override = _normalize_snapshot((self._data.get("overrides") or {}).get(stem))
        target = _merge_snapshots(baseline, override)
        _apply_snapshot(self.scene, self.source_name, target)

    def capture_override_for_stem(self, stem: str) -> None:
        self.ensure_baseline()
        current = self.snapshot_current_state()
        with self._lock:
            self._data = self._load()
            baseline = _normalize_snapshot(self._data.get("baseline"))
            diff = _snapshot_diff(baseline, current)
            overrides = self._data.setdefault("overrides", {})
            if diff:
                overrides[stem] = diff
                print(f"{self.tag} Saved single-source override for '{stem}'.")
            else:
                overrides.pop(stem, None)
            self._save()

    def snapshot_current_state(self) -> dict[str, Any]:
        return {
            "filters": _snapshot_filters(self.source_name) if self.include_filters else [],
            "transform": _snapshot_transform(self.scene, self.source_name) if self.include_transform else {},
            "audio": _snapshot_audio(self.source_name, include_volume_db=self.include_audio_volume) if self.include_audio else {},
            "media_settings": _snapshot_media_settings(self.source_name) if self.include_media_settings else {},
        }

    def _strip_volume_from_state(self) -> bool:
        changed = False
        baseline = self._data.get("baseline")
        if isinstance(baseline, dict):
            audio = baseline.get("audio")
            if isinstance(audio, dict) and "volume_db" in audio:
                audio.pop("volume_db", None)
                changed = True
        overrides = self._data.get("overrides")
        if isinstance(overrides, dict):
            for payload in overrides.values():
                if not isinstance(payload, dict):
                    continue
                audio = payload.get("audio")
                if isinstance(audio, dict) and "volume_db" in audio:
                    audio.pop("volume_db", None)
                    changed = True
        return changed

    def _strip_filters_from_state(self) -> bool:
        changed = False
        baseline = self._data.get("baseline")
        if isinstance(baseline, dict) and baseline.get("filters"):
            baseline["filters"] = []
            changed = True
        overrides = self._data.get("overrides")
        if isinstance(overrides, dict):
            for payload in overrides.values():
                if not isinstance(payload, dict):
                    continue
                if payload.get("filters"):
                    payload["filters"] = []
                    changed = True
        return changed

    def _load(self) -> dict[str, Any]:
        if not self.path.is_file():
            return {"version": 1, "baseline": None, "overrides": {}}
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {"version": 1, "baseline": None, "overrides": {}}
        if not isinstance(raw, dict):
            return {"version": 1, "baseline": None, "overrides": {}}
        raw.setdefault("version", 1)
        raw.setdefault("baseline", None)
        raw.setdefault("overrides", {})
        if not isinstance(raw["overrides"], dict):
            raw["overrides"] = {}
        return raw

    def _save(self) -> None:
        self.path.write_text(
            json.dumps(self._data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )


def _snapshot_transform(scene: str, source_name: str) -> dict[str, Any]:
    try:
        raw = obs.get_source_transform(scene, source_name)
    except Exception:
        return {}
    return _normalize_transform(raw)


def _snapshot_filters(source_name: str) -> list[dict[str, Any]]:
    try:
        raw_filters = obs.get_source_filters(source_name)
    except Exception:
        return []
    filters: list[dict[str, Any]] = []
    for item in raw_filters or []:
        if isinstance(item, dict):
            name = item.get("filterName") or item.get("name")
            kind = item.get("filterKind") or item.get("kind")
            enabled = item.get("filterEnabled")
            if enabled is None:
                enabled = item.get("enabled")
            settings = item.get("filterSettings") or item.get("settings") or {}
        else:
            name = getattr(item, "filterName", None) or getattr(item, "name", None)
            kind = getattr(item, "filterKind", None) or getattr(item, "kind", None)
            enabled = getattr(item, "filterEnabled", None)
            if enabled is None:
                enabled = getattr(item, "enabled", None)
            settings = getattr(item, "filterSettings", None) or getattr(item, "settings", None) or {}
        if not name or not kind:
            continue
        filters.append(
            {
                "name": str(name),
                "kind": str(kind),
                "enabled": bool(enabled),
                "settings": _json_safe_obj(settings),
            }
        )
    return filters


def _snapshot_audio(source_name: str, *, include_volume_db: bool = True) -> dict[str, Any]:
    audio: dict[str, Any] = {}
    monitor_type = obs.get_input_audio_monitor_type(source_name)
    if monitor_type is not None:
        audio["monitor_type"] = monitor_type
    volume = obs.get_input_volume(source_name) or {}
    if include_volume_db and volume.get("db") is not None:
        audio["volume_db"] = float(volume["db"])
    muted = obs.get_input_mute(source_name)
    if muted is not None:
        audio["muted"] = bool(muted)
    tracks = _get_input_audio_tracks(source_name)
    if tracks:
        audio["tracks"] = tracks
    return audio


def _snapshot_media_settings(source_name: str) -> dict[str, Any]:
    raw = _get_input_settings(source_name)
    return {
        key: raw[key]
        for key in _MEDIA_SETTING_KEYS
        if key in raw
    }


def _get_input_settings(source_name: str) -> dict[str, Any]:
    client = obs.get_obs()
    try:
        resp = client.send("GetInputSettings", {"inputName": source_name}, raw=True)
    except TypeError:
        resp = client.send("GetInputSettings", {"inputName": source_name})
    except Exception:
        return {}

    if isinstance(resp, dict):
        settings = resp.get("inputSettings") or resp.get("input_settings") or {}
        return settings if isinstance(settings, dict) else {}
    settings = getattr(resp, "input_settings", None) or getattr(resp, "inputSettings", None) or {}
    return settings if isinstance(settings, dict) else {}


def _get_input_audio_tracks(source_name: str) -> dict[str, bool]:
    client = obs.get_obs()
    try:
        resp = client.send("GetInputAudioTracks", {"inputName": source_name}, raw=True)
    except TypeError:
        resp = client.send("GetInputAudioTracks", {"inputName": source_name})
    except Exception:
        return {}

    if isinstance(resp, dict):
        tracks = resp.get("inputAudioTracks") or resp.get("input_audio_tracks") or {}
    else:
        tracks = getattr(resp, "input_audio_tracks", None) or getattr(resp, "inputAudioTracks", None) or {}
    if not isinstance(tracks, dict):
        return {}
    return {key: bool(tracks.get(key, False)) for key in _TRACK_KEYS if key in tracks}


def _apply_snapshot(scene: str, source_name: str, snapshot: dict[str, Any]) -> None:
    media_settings = snapshot.get("media_settings") or {}
    if media_settings:
        obs.get_obs().set_input_settings(source_name, media_settings, overlay=True)

    transform = snapshot.get("transform") or {}
    if transform:
        obs.set_source_transform(scene, source_name, transform)

    _apply_filters(source_name, snapshot.get("filters") or [])

    audio = snapshot.get("audio") or {}
    if "monitor_type" in audio:
        obs.set_input_audio_monitor_type(source_name, str(audio["monitor_type"]))
    if "volume_db" in audio:
        obs.set_input_volume_db(source_name, float(audio["volume_db"]))
    if "muted" in audio:
        obs.set_input_mute(source_name, bool(audio["muted"]))
    if isinstance(audio.get("tracks"), dict) and audio["tracks"]:
        obs.set_input_audio_tracks(source_name, audio["tracks"])


def _apply_filters(source_name: str, desired_filters: list[dict[str, Any]]) -> None:
    current = _snapshot_filters(source_name)
    for item in current:
        try:
            obs.remove_source_filter(source_name, item["name"])
        except Exception:
            pass

    for item in desired_filters:
        name = str(item.get("name", "")).strip()
        kind = str(item.get("kind", "")).strip()
        if not name or not kind:
            continue
        settings = item.get("settings") if isinstance(item.get("settings"), dict) else {}
        obs.create_source_filter(source_name, name, kind, settings)
        obs.set_source_filter_enabled(source_name, name, bool(item.get("enabled", True)))
        if settings:
            obs.set_source_filter_settings(source_name, name, settings)


def _snapshot_diff(baseline: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    diff: dict[str, Any] = {}
    if not _transforms_equal(baseline.get("transform") or {}, current.get("transform") or {}):
        diff["transform"] = current.get("transform") or {}
    if not _filters_equal(baseline.get("filters") or [], current.get("filters") or []):
        diff["filters"] = current.get("filters") or []
    if not _objects_equal(baseline.get("audio") or {}, current.get("audio") or {}):
        diff["audio"] = current.get("audio") or {}
    if not _objects_equal(baseline.get("media_settings") or {}, current.get("media_settings") or {}):
        diff["media_settings"] = current.get("media_settings") or {}
    return diff


def _merge_snapshots(baseline: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = {
        "filters": list(baseline.get("filters") or []),
        "transform": dict(baseline.get("transform") or {}),
        "audio": dict(baseline.get("audio") or {}),
        "media_settings": dict(baseline.get("media_settings") or {}),
    }
    if override.get("filters") is not None:
        merged["filters"] = list(override.get("filters") or [])
    merged["transform"].update(override.get("transform") or {})
    merged["audio"].update(override.get("audio") or {})
    merged["media_settings"].update(override.get("media_settings") or {})
    return merged


def _normalize_snapshot(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    return {
        "filters": list(raw.get("filters") or []),
        "transform": _normalize_transform(raw.get("transform") or {}),
        "audio": _json_safe_obj(raw.get("audio") or {}),
        "media_settings": _json_safe_obj(raw.get("media_settings") or {}),
    }


def _normalize_transform(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    clean: dict[str, Any] = {}
    for key, value in raw.items():
        if key not in _TRANSFORM_KEYS:
            continue
        if key == "boundsType":
            clean[key] = str(value)
        elif key in {"alignment", "boundsAlignment"}:
            try:
                clean[key] = int(float(value))
            except (TypeError, ValueError):
                continue
        else:
            try:
                clean[key] = float(value)
            except (TypeError, ValueError):
                continue
    return clean


def _transforms_equal(left: dict[str, Any], right: dict[str, Any]) -> bool:
    keys = set(left) | set(right)
    for key in keys:
        left_value = left.get(key)
        right_value = right.get(key)
        if isinstance(left_value, (int, float)) or isinstance(right_value, (int, float)):
            try:
                if abs(float(left_value or 0.0) - float(right_value or 0.0)) > 0.001:
                    return False
            except (TypeError, ValueError):
                return False
        else:
            if left_value != right_value:
                return False
    return True


def _filters_equal(left: list[dict[str, Any]], right: list[dict[str, Any]]) -> bool:
    return _json_safe_obj(left) == _json_safe_obj(right)


def _objects_equal(left: dict[str, Any], right: dict[str, Any]) -> bool:
    return _json_safe_obj(left) == _json_safe_obj(right)


def _json_safe_obj(value: Any) -> Any:
    try:
        return json.loads(json.dumps(value, ensure_ascii=False))
    except Exception:
        return value

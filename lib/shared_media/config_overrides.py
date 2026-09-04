from __future__ import annotations

import json
from pathlib import Path
from typing import Any


OVERRIDES_FILE = "editor_config_overrides.json"


def load_config_overrides(project_dir: Path) -> dict[str, Any]:
    path = Path(project_dir) / OVERRIDES_FILE
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def text_override(overrides: dict[str, Any], key: str, default: str) -> str:
    value = overrides.get(key, default)
    return str(value).strip() or default


def float_override(overrides: dict[str, Any], key: str, default: float | None) -> float | None:
    value = overrides.get(key, default)
    if value in ("", None):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def int_override(overrides: dict[str, Any], key: str, default: int) -> int:
    value = overrides.get(key, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def bool_override(overrides: dict[str, Any], key: str, default: bool) -> bool:
    value = overrides.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def path_override(overrides: dict[str, Any], key: str, default: Path) -> Path:
    value = str(overrides.get(key, "")).strip()
    return Path(value) if value else default


def extensions_override(overrides: dict[str, Any], key: str, default: set[str]) -> set[str]:
    value = overrides.get(key)
    if isinstance(value, list):
        items = value
    elif isinstance(value, str):
        items = value.split(",")
    else:
        return default
    cleaned = {
        ext if str(ext).strip().startswith(".") else f".{str(ext).strip()}"
        for ext in items
        if str(ext).strip()
    }
    return {ext.lower() for ext in cleaned} or default

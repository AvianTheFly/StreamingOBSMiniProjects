from __future__ import annotations

import json
import subprocess
from pathlib import Path

import obs

from lib.project_settings import load_project_settings

from .media_config import MediaProjectConfig


VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv", ".ts", ".m4v", ".ogv"}


def layout_rules_file_for_config(cfg: MediaProjectConfig) -> Path:
    project_dir = Path(getattr(cfg, "project_dir", "") or Path(cfg.phrases_file).parent)
    return project_dir / "obs_layout_rules.json"


def load_layout_rules(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def probe_dimension_key(path: Path) -> str:
    if path.suffix.lower() not in VIDEO_EXTS:
        return ""
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode != 0:
            return ""
        raw = json.loads(proc.stdout or "{}")
        stream = (raw.get("streams") or [{}])[0]
        width = int(stream.get("width") or 0)
        height = int(stream.get("height") or 0)
        return f"{width}x{height}" if width and height else ""
    except Exception:
        return ""


def safe_transform(raw: dict) -> dict:
    allowed = {
        "positionX", "positionY", "rotation", "scaleX", "scaleY",
        "boundsType", "boundsWidth", "boundsHeight", "alignment", "boundsAlignment",
        "cropLeft", "cropTop", "cropRight", "cropBottom",
    }
    clean: dict = {}
    for key, value in (raw or {}).items():
        if key not in allowed:
            continue
        if key == "boundsType":
            clean[key] = str(value)
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        clean[key] = int(number) if key in {"alignment", "boundsAlignment"} else number
    clean.setdefault("alignment", 5)
    clean.setdefault("boundsAlignment", 0)
    clean.setdefault("boundsType", "OBS_BOUNDS_SCALE_INNER")
    return clean


def obs_transform_from_rule(rule: dict) -> dict:
    clean = safe_transform(rule)
    crop_left = float(clean.get("cropLeft") or 0)
    crop_top = float(clean.get("cropTop") or 0)
    scale_x = float(clean.get("scaleX") or 1)
    scale_y = float(clean.get("scaleY") or 1)
    # The editor stores position as the un-cropped source box. OBS positions
    # the visible cropped scene item, so offset by the crop amount when applying.
    clean["positionX"] = float(clean.get("positionX") or 0) + crop_left * scale_x
    clean["positionY"] = float(clean.get("positionY") or 0) + crop_top * scale_y
    return clean


def resolve_rule_for_stem(
    saved: dict,
    *,
    stem: str,
    path: Path | None = None,
    categories: list[str] | None = None,
) -> dict | None:
    """Return the resolved layout rule for a specific stem, or None if none matches.

    Looks up: overrides[stem] → rules[dim::category] → rules[dim].
    Probes video dimensions via ffprobe when path is provided.
    """
    rules = saved.get("rules", {})
    overrides = saved.get("overrides", {})
    if not isinstance(rules, dict):
        rules = {}
    if not isinstance(overrides, dict):
        overrides = {}

    rule = overrides.get(stem)
    if isinstance(rule, dict):
        return rule

    if path is not None:
        dim_key = probe_dimension_key(path)
        if dim_key:
            rule = _layout_rule_for_stem(
                rules,
                dimension_key=dim_key,
                stem=stem,
                categories=list(categories or []),
            )
            if isinstance(rule, dict):
                return rule

    return None


def apply_saved_layout_rules(
    cfg: MediaProjectConfig,
    name_index: dict[str, tuple[Path, str]],
) -> dict[str, list]:
    rules_path = layout_rules_file_for_config(cfg)
    saved = load_layout_rules(rules_path)
    rules = saved.get("rules", {})
    overrides = saved.get("overrides", {})
    if not isinstance(rules, dict):
        rules = {}
    if not isinstance(overrides, dict):
        overrides = {}
    if not rules and not overrides:
        return {"applied": [], "failed": []}

    categories_by_stem = _categories_by_stem(cfg)
    applied: list[str] = []
    failed: list[dict[str, str]] = []
    for _stem, (path, source_name) in name_index.items():
        key = probe_dimension_key(path)
        if not key:
            continue
        rule = overrides.get(path.stem) or _layout_rule_for_stem(
            rules,
            dimension_key=key,
            stem=path.stem,
            categories=categories_by_stem.get(path.stem, []),
        )
        if not isinstance(rule, dict):
            continue
        try:
            obs.set_source_transform(cfg.scene, source_name, obs_transform_from_rule(rule))
            applied.append(source_name)
        except Exception as exc:
            failed.append({"source": source_name, "error": str(exc)})

    if applied or failed:
        print(
            f"[{cfg.project_name}] OBS layout rules: "
            f"{len(applied)} applied, {len(failed)} failed."
        )
    return {"applied": applied, "failed": failed}


def _layout_rule_for_stem(
    rules: dict,
    *,
    dimension_key: str,
    stem: str,
    categories: list[str],
) -> dict | None:
    for category in categories or ["Uncategorized"]:
        composite_key = f"{dimension_key}::{category}"
        rule = rules.get(composite_key)
        if isinstance(rule, dict):
            return rule
    rule = rules.get(dimension_key)
    return rule if isinstance(rule, dict) else None


def _categories_by_stem(cfg: MediaProjectConfig) -> dict[str, list[str]]:
    project_dir = Path(getattr(cfg, "project_dir", "") or Path(cfg.phrases_file).parent)
    try:
        settings = load_project_settings(
            project_dir,
            hotkeys_file=project_dir / "hotkeys.json",
            asset_dir=cfg.asset_dir,
            valid_extensions=cfg.valid_extensions,
        )
    except Exception:
        return {}
    return {
        stem: list(categories)
        for stem, categories in settings.sound_categories.items()
        if categories
    }

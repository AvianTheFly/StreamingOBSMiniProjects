from __future__ import annotations

import importlib
import queue
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from lib.paths import MINI_PROJECTS_DIR, PROJECT_ROOT, display_name_from_key, ensure_import_paths


SKIP_PROJECT_DIRS = {
    ".claude",
    "__pycache__",
    "archive",
    "docs",
    "lib",
    "mini projects",
    "obs",
    "sandbox_testing",
    "tools",
    "voice",
}

SUPPORTED_RUNTIME_PROJECTS = {
    "instant_replay",
    "league",
    "love_me",
    "scene_voice_switcher",
    "sound_effects",
    "soundboard",
    "specific_song",
    "tik_tok",
}


@dataclass(slots=True)
class RunnableProject:
    name: str
    package: str
    path: Path
    module: Any
    queue: queue.Queue
    thread: Any = None


@dataclass(slots=True)
class EditorProject:
    key: str
    display: str
    path: Path
    asset_dir: Path | None = None
    hotkeys_file: Path | None = None
    phrases_file: Path | None = None
    extensions: set[str] | None = None
    config_defaults: dict[str, object] | None = None
    features: dict[str, bool] | None = None
    profile_store_file: Path | None = None
    can_create_profiles: bool = False
    error: str = ""


def normalize_project_names(values: list[str] | None) -> set[str]:
    return {value.strip() for value in (values or []) if value and value.strip()}


def iter_project_dirs(*, include_root: bool = True) -> list[Path]:
    roots = [MINI_PROJECTS_DIR]
    if include_root:
        roots.insert(0, PROJECT_ROOT)

    dirs: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        if not root.is_dir():
            continue
        for folder in sorted(root.iterdir(), key=lambda item: item.name.lower()):
            if not _is_project_candidate(folder):
                continue
            if folder.name in seen:
                continue
            seen.add(folder.name)
            dirs.append(folder)
    return dirs


def discover_runnable_projects(logger: Any | None = None) -> list[RunnableProject]:
    ensure_import_paths()
    projects: list[RunnableProject] = []

    for folder in iter_project_dirs(include_root=True):
        if not (folder / "__init__.py").is_file():
            _debug(logger, f"Skipping '{folder.name}' - no __init__.py")
            continue
        if not (folder / "main.py").is_file():
            _debug(logger, f"Skipping '{folder.name}' - no main.py")
            continue

        package = folder.name
        module_name = f"{package}.main"
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:
            _error(logger, f"Could not import '{module_name}': {exc}")
            continue

        if not callable(getattr(module, "run", None)):
            _warn(logger, f"Skipping '{package}' - main.py has no run() function.")
            continue

        try:
            importlib.import_module(f"{package}.interface")
        except ImportError:
            pass
        except Exception as exc:
            _warn(logger, f"Could not import '{package}.interface': {exc}")

        projects.append(
            RunnableProject(
                name=package,
                package=package,
                path=folder,
                module=module,
                queue=queue.Queue(),
            )
        )

    return projects


def filter_projects(
    projects: list[RunnableProject],
    *,
    only: set[str],
    skip: set[str],
    logger: Any | None = None,
) -> list[RunnableProject]:
    available = {project.name for project in projects}
    for name in sorted(only - available):
        _warn(logger, f"--only requested unknown project '{name}'")
    for name in sorted(skip - available):
        _warn(logger, f"--skip requested unknown project '{name}'")

    filtered = projects
    if only:
        filtered = [project for project in filtered if project.name in only]
    if skip:
        filtered = [project for project in filtered if project.name not in skip]
    return filtered


def discover_editor_projects() -> dict[str, EditorProject]:
    ensure_import_paths()
    projects: dict[str, EditorProject] = {}

    for folder in iter_project_dirs(include_root=False):
        key = folder.name
        display = display_name_from_key(key)
        config_path = folder / "config.py"
        if not config_path.is_file():
            continue

        project = EditorProject(key=key, display=display, path=folder)
        try:
            config_module = importlib.import_module(f"{key}.config")
            if getattr(config_module, "EDITOR_DISABLED", False):
                continue
            profile_discovery = getattr(config_module, "discover_editor_projects", None)
            if callable(profile_discovery):
                for raw_profile in profile_discovery():
                    editor_project = _editor_project_from_payload(folder, raw_profile)
                    projects[editor_project.key] = editor_project
                continue
            if not hasattr(config_module, "CONFIG"):
                continue
            cfg = getattr(config_module, "CONFIG")
            project.display = display_name_from_key(getattr(cfg, "project_name", key))
            project.asset_dir = Path(getattr(cfg, "asset_dir"))
            project.extensions = set(getattr(cfg, "valid_extensions"))
            project.hotkeys_file = Path(
                getattr(config_module, "HOTKEYS_FILE", folder / "hotkeys.json")
            )
            project.phrases_file = Path(getattr(cfg, "phrases_file", folder / "phrases.json"))
            raw_seqs = getattr(cfg, "trigger_sequences", [])
            project.config_defaults = {
                "asset_dir": str(getattr(cfg, "asset_dir", "")),
                "scene": getattr(cfg, "scene", ""),
                "obs_source_prefix": getattr(cfg, "obs_source_prefix", ""),
                "event_name": getattr(cfg, "event_name", ""),
                "valid_extensions": sorted(getattr(cfg, "valid_extensions", [])),
                "trigger_sequences": " ; ".join(" ".join(seq) for seq in raw_seqs),
                "trigger_max_interval": getattr(cfg, "trigger_max_interval", ""),
                "auto_record_timeout": getattr(cfg, "auto_record_timeout", ""),
                "manual_trigger_window": getattr(cfg, "manual_trigger_window", ""),
                "interface_hotkeys": getattr(cfg, "interface_hotkeys", {}),
                "fuzzy_threshold": getattr(cfg, "fuzzy_threshold", ""),
                "semantic_gap": getattr(cfg, "semantic_gap", ""),
                "matching_strategy": getattr(cfg, "matching_strategy", "hybrid"),
                "fuzzy_scorer": getattr(cfg, "fuzzy_scorer", "WRatio"),
                "fuzzy_weight": getattr(cfg, "fuzzy_weight", ""),
                "token_weight": getattr(cfg, "token_weight", ""),
                "embedding_weight": getattr(cfg, "embedding_weight", ""),
                "embedding_model": getattr(cfg, "embedding_model", ""),
                "media_start_timeout": getattr(cfg, "media_start_timeout", ""),
                "media_total_timeout": getattr(cfg, "media_total_timeout", ""),
                "monitor": getattr(cfg, "monitor", ""),
                "default_volume_db": getattr(cfg, "default_volume_db", ""),
                "project_volume_db": getattr(cfg, "project_volume_db", 0.0),
                "profile_volume_db": getattr(cfg, "profile_volume_db", 0.0),
                "audio_tracks": getattr(cfg, "audio_tracks", ""),
                "manual_hotkeys_enabled": getattr(cfg, "manual_hotkeys_enabled", True),
                "voice_commands_enabled": getattr(cfg, "voice_commands_enabled", True),
                "random_commands_enabled": getattr(cfg, "random_commands_enabled", False),
                "categories_enabled": getattr(cfg, "features", {}).get("categories_enabled", True),
                "obs_layout_enabled": getattr(cfg, "features", {}).get("obs_layout_enabled", True),
                "audio_settings_enabled": getattr(cfg, "features", {}).get("audio_settings_enabled", True),
                "verbose_matcher": getattr(cfg, "verbose_matcher", ""),
                "single_source_mode": getattr(cfg, "single_source_mode", False),
            }
            project.features = dict(getattr(cfg, "features", {}) or {})
        except Exception as exc:
            project.error = str(exc)
        projects[key] = project

    return projects


def _editor_project_from_payload(folder: Path, payload: dict[str, Any]) -> EditorProject:
    key = str(payload.get("key", "")).strip()
    display = str(payload.get("name", "") or display_name_from_key(key))
    project = EditorProject(
        key=key,
        display=display,
        path=Path(payload.get("profile_dir") or folder),
        asset_dir=Path(payload["asset_dir"]),
        hotkeys_file=Path(payload["hotkeys_file"]),
        phrases_file=Path(payload.get("phrases_file") or Path(payload["hotkeys_file"]).parent / "phrases.json"),
        extensions=set(payload.get("extensions", set())),
        config_defaults=dict(payload.get("config_defaults") or {}),
        features=dict(payload.get("features") or {}),
        profile_store_file=Path(payload["profile_store_file"]) if payload.get("profile_store_file") else None,
        can_create_profiles=bool(payload.get("can_create_profiles", False)),
    )
    return project


def _is_project_candidate(folder: Path) -> bool:
    return (
        folder.is_dir()
        and folder.name in SUPPORTED_RUNTIME_PROJECTS
        and folder.name not in SKIP_PROJECT_DIRS
        and not folder.name.startswith((".", "_"))
    )


def _debug(logger: Any | None, message: str) -> None:
    if logger and hasattr(logger, "debug"):
        logger.debug("hub", message)


def _warn(logger: Any | None, message: str) -> None:
    if logger and hasattr(logger, "warn"):
        logger.warn("hub", message)


def _error(logger: Any | None, message: str) -> None:
    if logger and hasattr(logger, "error"):
        logger.error("hub", message)

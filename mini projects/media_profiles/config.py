from __future__ import annotations

import os
from pathlib import Path

from lib.shared_media.profile_store import editor_projects, load_media_profiles


PROJECT_NAME = "media_profiles"
PROJECT_DIR = Path(__file__).resolve().parent
PROFILES_FILE = PROJECT_DIR / "profiles.json"
EDITOR_PROFILE_CONTAINER = True


def discover_editor_projects():
    return editor_projects(PROJECT_DIR)


def load_configs():
    only = _csv_env("MEDIA_PROFILES_ONLY")
    skip = _csv_env("MEDIA_PROFILES_SKIP")
    configs = [profile.to_config() for profile in load_media_profiles(PROJECT_DIR)]
    if only:
        configs = [cfg for cfg in configs if cfg.project_name in only]
    if skip:
        configs = [cfg for cfg in configs if cfg.project_name not in skip]
    return configs


def profile_keys() -> set[str]:
    return {profile.key for profile in load_media_profiles(PROJECT_DIR, include_disabled=True)}


def _csv_env(name: str) -> set[str]:
    return {
        item.strip()
        for item in os.environ.get(name, "").split(",")
        if item.strip()
    }

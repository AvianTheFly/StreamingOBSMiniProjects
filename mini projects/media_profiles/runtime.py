from __future__ import annotations

from pathlib import Path

from lib.shared_media.profile_store import load_media_profiles


PROJECT_DIR = Path(__file__).resolve().parent
PROFILE_LIVE_STATES: dict[str, dict] = {}


def enabled_profiles():
    return load_media_profiles(PROJECT_DIR)


def live_state_for(profile_key: str) -> dict:
    return PROFILE_LIVE_STATES.setdefault(profile_key, {})

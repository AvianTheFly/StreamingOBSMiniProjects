"""Translate a module's CONFIG into hotkey-editor defaults.

This adapter only reads the supplied config object: it does not import modules,
read saved profiles, write settings, or contact OBS. Runtime discovery remains in
project_registry.py; persisted profile selection belongs to project_settings.py.
"""
from __future__ import annotations

from typing import Any


def editor_defaults(config: Any) -> dict[str, object]:
    """Preserve editor field names, fallback values and JSON-friendly types."""
    cfg = config
    raw_seqs = getattr(cfg, "trigger_sequences", [])
    return {
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

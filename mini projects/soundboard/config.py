import os
from pathlib import Path

from lib.shared_media.media_config import MediaProjectConfig
from lib.hotkeys import load_hotkeys
from lib.shared_media.config_overrides import (
    bool_override,
    extensions_override,
    float_override,
    load_config_overrides,
    path_override,
    text_override,
)

PROJECT_NAME = "soundboard"
SCENE = "soundboard"
EVENT_NAME = "soundboard.play"
PROJECT_DIR = Path(__file__).resolve().parent
OVERRIDES = load_config_overrides(PROJECT_DIR)

# Falls back to the default machine path; override in .env if your assets live
# somewhere else.
ASSET_DIR = Path(
    os.environ.get(
        "SOUNDBOARD_ASSETS_DIR",
        r"F:\EVERYTHING STREAM RELATED\Assets\VisualAndAudio\soundboard",
    )
)

HOTKEYS_FILE = PROJECT_DIR / "hotkeys.json"

CONFIG = MediaProjectConfig(
    project_name=PROJECT_NAME,
    scene=text_override(OVERRIDES, "scene", SCENE),
    event_name=EVENT_NAME,
    features={"trigger_restarts_listen": True},

    asset_dir=path_override(OVERRIDES, "asset_dir", ASSET_DIR),
    obs_source_prefix=text_override(OVERRIDES, "obs_source_prefix", "sb__"),

    # Trigger: type / - * quickly (within 0.5 s) to open the input window.
    trigger_sequences=[["/", "*"]],
    trigger_max_interval=float_override(OVERRIDES, "trigger_max_interval", 0.5) or 0.5,

    auto_record_timeout=float_override(OVERRIDES, "auto_record_timeout", 2.0) or 2.0,

    # Loaded from hotkeys.json — edit via hotkey_editor.py, then restart hub.
    manual_trigger_map=load_hotkeys(HOTKEYS_FILE, PROJECT_NAME),
    # Keep the direct-hotkey window aligned with the voice listener timeout so
    # a second trigger cleanly stops the current clip and gives the same 2s
    # response window for the next hotkey.
    manual_trigger_window=float_override(OVERRIDES, "manual_trigger_window", 2.0) or 2.0,

    valid_extensions=extensions_override(OVERRIDES, "valid_extensions", {".mp3", ".mp4", ".wav", ".ogg", ".webm"}),

    phrases_file=PROJECT_DIR / "phrases.json",
    fuzzy_threshold=int(float_override(OVERRIDES, "fuzzy_threshold", 75) or 75),
    semantic_gap=int(float_override(OVERRIDES, "semantic_gap", 15) or 15),

    media_start_timeout=float_override(OVERRIDES, "media_start_timeout", 5.0) or 5.0,
    media_total_timeout=float_override(OVERRIDES, "media_total_timeout", 300.0) or 300.0,
    media_swap_settle_ms=175,

    verbose_matcher=bool_override(OVERRIDES, "verbose_matcher", True),
    default_volume_db=float_override(OVERRIDES, "default_volume_db", 0),

    single_source_mode=True,
    shared_source_slots=1,
)

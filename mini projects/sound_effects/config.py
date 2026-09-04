# sound_effects/config.py

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

PROJECT_NAME = "sound_effects"
PROJECT_DIR = Path(__file__).resolve().parent
HOTKEYS_FILE = PROJECT_DIR / "hotkeys.json"
OVERRIDES = load_config_overrides(PROJECT_DIR)

CONFIG = MediaProjectConfig(
    project_name=PROJECT_NAME,
    scene=text_override(OVERRIDES, "scene", "Sound Effects"),
    event_name="sfx.play",

    asset_dir=path_override(OVERRIDES, "asset_dir", Path(os.environ["SOUND_EFFECTS_DIR"])),
    obs_source_prefix=text_override(OVERRIDES, "obs_source_prefix", "sfx__"),

    trigger_sequences=[
        ["9", "8", "9"],  # primary
        ["(", "*", "("],  # shift variant
    ],
    trigger_max_interval=float_override(OVERRIDES, "trigger_max_interval", 0.150) or 0.150,

    auto_record_timeout=float_override(OVERRIDES, "auto_record_timeout", 2.0) or 2.0,

    manual_trigger_map=load_hotkeys(HOTKEYS_FILE, PROJECT_NAME) or {
        "!": "hooray",   # 989!
        "@": "hooray",   # 989@
        "#": "mom frog", # 989#
        "$": "oh no",    # 989$
        "%": "",         # unassigned
        "^": "",         # unassigned
    },
    manual_trigger_window=float_override(OVERRIDES, "manual_trigger_window", 1.0) or 1.0,

    features={"trigger_restarts_listen": bool_override(OVERRIDES, "trigger_restarts_listen", True)},

    valid_extensions=extensions_override(OVERRIDES, "valid_extensions", {".mp3", ".mp4", ".wav", ".ogg", ".webm"}),

    phrases_file=PROJECT_DIR / "phrases.json",
    fuzzy_threshold=int(float_override(OVERRIDES, "fuzzy_threshold", 75) or 75),

    media_start_timeout=float_override(OVERRIDES, "media_start_timeout", 5.0) or 5.0,
    media_total_timeout=float_override(OVERRIDES, "media_total_timeout", 300.0) or 300.0,

    verbose_matcher=bool_override(OVERRIDES, "verbose_matcher", True),

    source_bounds={"left": 0, "right": 1639, "top": 600, "bottom": 322},
)

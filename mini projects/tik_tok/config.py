import os
from pathlib import Path

from shared_media.media_config import MediaProjectConfig

PROJECT_NAME = "tik_tok"
SCENE = "TikTok"
EVENT_NAME = "tiktok.play"

CONFIG = MediaProjectConfig(
    project_name=PROJECT_NAME,
    scene=SCENE,
    event_name=EVENT_NAME,

    asset_dir=Path(os.environ["TIKTOK_ASSETS_DIR"]),
    obs_source_prefix="tt__",

    trigger_sequences=[
        ["+", "+"],
    ],
    trigger_max_interval=0.3,

    auto_record_timeout=2.0,

    manual_trigger_map={
        "!": "",
        "@": "",
        "#": "",
        "$": "",
        "%": "",
        "^": "",
    },
    manual_trigger_window=1.0,

    valid_extensions={".mp3", ".mp4", ".wav", ".ogg", ".webm"},

    phrases_file=Path(__file__).resolve().parent / "phrases.json",
    fuzzy_threshold=75,

    media_start_timeout=5.0,
    media_total_timeout=300.0,

    verbose_matcher=True,
)
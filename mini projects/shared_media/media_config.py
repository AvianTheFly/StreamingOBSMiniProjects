from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class MediaProjectConfig:
    project_name: str
    scene: str
    asset_dir: Path
    obs_source_prefix: str
    trigger_sequences: list[list[str]]
    trigger_max_interval: float
    auto_record_timeout: float
    manual_trigger_map: dict[str, str]
    manual_trigger_window: float
    valid_extensions: set[str]
    phrases_file: Path
    fuzzy_threshold: int = 75
    semantic_gap: int = 15
    media_start_timeout: float = 5.0
    media_total_timeout: float = 300.0
    event_name: str = ""
    verbose_matcher: bool = True
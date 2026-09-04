from __future__ import annotations

from dataclasses import dataclass, field
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
    manual_trigger_map: dict[str, str | list[str]]
    manual_trigger_window: float
    valid_extensions: set[str]
    phrases_file: Path
    fuzzy_threshold: int = 75
    semantic_gap: int = 15
    media_start_timeout: float = 5.0
    media_total_timeout: float = 300.0
    media_swap_settle_ms: int = 0
    event_name: str = ""
    verbose_matcher: bool = True
    project_dir: Path | None = None
    features: dict[str, bool] = field(default_factory=dict)
    manual_hotkeys_enabled: bool = True
    voice_commands_enabled: bool = True
    random_commands_enabled: bool = False
    interface_hotkeys: dict[str, str] = field(default_factory=dict)
    matching_strategy: str = "hybrid"
    fuzzy_scorer: str = "WRatio"
    fuzzy_weight: float = 0.70
    token_weight: float = 0.30
    embedding_weight: float = 0.0
    embedding_model: str = ""
    # Optional: pin every new source to a canvas region on creation.
    # Dict keys match set_source_bounds() kwargs: left, right, top, bottom.
    # If None, no transform is applied.
    source_bounds: dict | None = None
    # OBS audio monitoring mode applied to media/audio sources.
    # Use the string constants from obs (MONITOR_ONLY, MONITOR_AND_OUT, NO_MONITOR).
    # Applied to newly-created and re-linked sources at sync time.
    monitor: str = "OBS_MONITORING_TYPE_MONITOR_ONLY"
    # Default volume in dB applied to brand-new sources only.
    # Pre-existing sources keep whatever volume the user has set manually.
    # None means don't touch volume at all.
    default_volume_db: float | None = None
    # Additive runtime volume layers. Effective source volume is:
    # project_volume_db + active profile_volume_db + file_volume_offsets[stem].
    project_volume_db: float = 0.0
    profile_volume_db: float = 0.0
    file_volume_offsets: dict[str, float] = field(default_factory=dict)
    # OBS output-track routing, e.g. {"1": False, "2": True, ...}.
    # None means do not touch track routing.
    audio_tracks: dict[str, bool] | None = None
    # When True, the project uses ONE shared OBS source (named {prefix}player)
    # for all media files instead of one source per file.  The source's local_file
    # is swapped at play time.  Any existing per-file sources are removed at startup.
    single_source_mode: bool = False
    # Number of shared OBS player sources to keep in the scene for single-source
    # mode. 1 preserves the legacy behavior. Values above 1 allow alternating
    # buffers so the next file can be loaded into a different hidden source.
    shared_source_slots: int = 1

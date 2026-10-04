"""Initialize configured OBS slots and preserve each asset's personal state."""
from dataclasses import dataclass
from pathlib import Path
import obs
from .inventory import build_name_index
from .runtime_settings import _read_input_audio_tracks
from .layout_rules import apply_saved_layout_rules
from .source_layout import set_source_bounds
from .single_source_state import SingleSourceStateStore
from lib.snapshots import SnapshotMap

@dataclass
class PreparedSources:
    single_source_mode: bool
    shared_sources: list
    primary: str | None
    name_index: dict
    state_stores: dict
    managed_sources: set


def prepare_sources(cfg, project_dir, *, obs_api=obs):
    obs = obs_api
    _single_source_mode = getattr(cfg, "single_source_mode", False)
    _shared_source_slots = max(1, int(getattr(cfg, "shared_source_slots", 1) or 1))
    if _single_source_mode:
        print(f"[{cfg.project_name}] Single-source mode — ensuring one OBS slot…")
        _shared_sources = obs.ensure_shared_sources(
            scene=cfg.scene,
            asset_dir=cfg.asset_dir,
            prefix=cfg.obs_source_prefix,
            monitor=cfg.monitor,
            volume_db=cfg.default_volume_db,
            slots=_shared_source_slots,
        )
        _single_source = _shared_sources[0] if _shared_sources else None
        newly_created: set[str] = set()
    else:
        _shared_sources: list[str] = []
        _single_source = None
        print(f"[{cfg.project_name}] Syncing sources to files…")
        newly_created = obs.sync_assets(
            scene=cfg.scene,
            asset_dir=cfg.asset_dir,
            prefix=cfg.obs_source_prefix,
            monitor=cfg.monitor,
            volume_db=cfg.default_volume_db,
        )

    name_index = SnapshotMap(build_name_index(cfg, single_source_name=_single_source))
    from lib.asset_preparation import preparation
    preparation.register(path for path, _source in name_index.values())
    print(f"[{cfg.project_name}] {len(name_index)} asset(s) loaded.")

    if cfg.audio_tracks:
        if _single_source_mode and _single_source:
            for _shared_source in (_shared_sources or [_single_source]):
                try:
                    obs.set_input_audio_tracks(_shared_source, cfg.audio_tracks)
                except Exception as exc:
                    print(f"[{cfg.project_name}] Could not set audio tracks for '{_shared_source}': {exc}")
        else:
            for _stem, (_path, source_name) in name_index.items():
                try:
                    obs.set_input_audio_tracks(source_name, cfg.audio_tracks)
                except Exception as exc:
                    print(f"[{cfg.project_name}] Could not set audio tracks for '{source_name}': {exc}")

    def sync_shared_source_audio_defaults() -> None:
        if not _single_source_mode or not _shared_sources:
            return
        primary = _shared_sources[0]
        primary_monitor = obs.get_input_audio_monitor_type(primary)
        primary_mute = obs.get_input_mute(primary)
        primary_volume = obs.get_input_volume(primary) or {}
        primary_tracks = cfg.audio_tracks or _read_input_audio_tracks(primary)
        for _shared_source in _shared_sources[1:]:
            try:
                if primary_monitor:
                    obs.set_input_audio_monitor_type(_shared_source, primary_monitor)
                if primary_mute is not None:
                    obs.set_input_mute(_shared_source, bool(primary_mute))
                if primary_volume.get("db") is not None:
                    obs.set_input_volume_db(_shared_source, float(primary_volume["db"]))
                if primary_tracks:
                    obs.set_input_audio_tracks(_shared_source, primary_tracks)
            except Exception as exc:
                print(f"[{cfg.project_name}] Could not mirror audio defaults to '{_shared_source}': {exc}")

    sync_shared_source_audio_defaults()

    if cfg.source_bounds is not None:
        if _single_source_mode and _single_source:
            # Always apply bounds to every shared source so any buffer can be shown.
            for _shared_source in (_shared_sources or [_single_source]):
                set_source_bounds(cfg.scene, _shared_source, **cfg.source_bounds)
        elif newly_created:
            for _stem, (_path, _source_name) in name_index.items():
                if _source_name in newly_created:
                    set_source_bounds(cfg.scene, _source_name, **cfg.source_bounds)

    if not _single_source_mode:
        apply_saved_layout_rules(cfg, name_index)

    source_state_stores: dict[str, SingleSourceStateStore] = {}
    if _single_source_mode and _single_source:
        for _shared_source in (_shared_sources or [_single_source]):
            store = SingleSourceStateStore(
                project_dir=project_dir,
                scene=cfg.scene,
                source_name=_shared_source,
                tag=f"[{cfg.project_name}]",
                include_filters=cfg.project_name in {"tik_tok", "soundboard"},
                include_audio=False,
                include_audio_volume=False,
                include_media_settings=False,
            )
            store.ensure_baseline()
            source_state_stores[_shared_source] = store

    managed_sources = (
        set(_shared_sources)
        if _single_source_mode
        else {source_name for _path, source_name in name_index.values()}
    )
    # Managed media sources should be dormant until this module explicitly
    # plays one. This also repairs old OBS scenes where an SFX source was left
    # visible and played merely because the scene became active.
    for source_name in managed_sources:
        try:
            obs.park_media_source(cfg.scene, source_name)
        except Exception:
            pass
        try:
            obs.hide_source(cfg.scene, source_name)
        except Exception:
            pass

    return PreparedSources(_single_source_mode, _shared_sources, _single_source,
                           name_index, source_state_stores, managed_sources)

from __future__ import annotations

import atexit
import json
import queue
import random
import threading
import time
from pathlib import Path

_HUB_SETTINGS_FILE = Path(__file__).resolve().parents[2] / "hub_settings.json"


def _read_hub_trigger_mode(project_name: str) -> str:
    try:
        data = json.loads(_HUB_SETTINGS_FILE.read_text(encoding="utf-8"))
        modes = data.get("project_trigger_modes") or {}
        mode = modes.get(project_name, "abort")
        return mode if mode in ("abort", "pause", "keep_playing") else "abort"
    except Exception:
        return "abort"

import obs
import events as hub_events
from shared import SequenceTrigger, VoicePTT
from coordinator import coordinator
from lib.global_hotkeys import key_token, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from lib.project_settings import load_project_profile_summaries, load_project_settings

from .media_config import MediaProjectConfig
from .media_phrase_matcher import match_phrase
from .layout_rules import (
    apply_saved_layout_rules,
    layout_rules_file_for_config,
    load_layout_rules,
    obs_transform_from_rule,
    resolve_rule_for_stem,
)
from .source_layout import set_source_bounds
from .controls import (
    action_catalog,
    effective_volume_db,
    normalize_interface_hotkeys,
    parse_sequences,
)
from .single_source_state import SingleSourceStateStore


def _feature_enabled(cfg: MediaProjectConfig, key: str, default: bool) -> bool:
    if key in cfg.features:
        return bool(cfg.features[key])
    return bool(getattr(cfg, key, default))


def _get_obs_input_settings(source_name: str) -> dict:
    client = obs.get_obs()
    try:
        resp = client.send("GetInputSettings", {"inputName": source_name}, raw=True)
    except TypeError:
        resp = client.send("GetInputSettings", {"inputName": source_name})
    except Exception:
        return {}

    if isinstance(resp, dict):
        settings = resp.get("inputSettings") or resp.get("input_settings") or {}
        return settings if isinstance(settings, dict) else {}

    settings = getattr(resp, "input_settings", None) or getattr(resp, "inputSettings", None) or {}
    return settings if isinstance(settings, dict) else {}


def _wait_for_media_source_file(source_name: str, filepath: Path, timeout: float = 1.0) -> bool:
    try:
        expected = str(Path(filepath).resolve()).casefold()
    except Exception:
        expected = str(filepath).casefold()
    deadline = time.time() + timeout
    while time.time() < deadline:
        settings = _get_obs_input_settings(source_name)
        current = str(settings.get("local_file") or "").strip()
        if current:
            try:
                current = str(Path(current).resolve()).casefold()
            except Exception:
                current = current.casefold()
            if current == expected:
                return True
        time.sleep(0.05)
    return False


_MEDIA_STATE_PLAYING = "OBS_MEDIA_STATE_PLAYING"
_MEDIA_STATE_STARTING = {
    "OBS_MEDIA_STATE_OPENING",
    "OBS_MEDIA_STATE_BUFFERING",
    "OBS_MEDIA_STATE_RESTARTING",
}
_MEDIA_STATE_TERMINAL = {
    "OBS_MEDIA_STATE_STOPPED",
    "OBS_MEDIA_STATE_ENDED",
    "OBS_MEDIA_STATE_NONE",
}


def _start_media_source_playback(
    *,
    scene: str,
    source_name: str,
    filepath: Path,
    start_timeout: float,
    swap_settle_ms: int = 0,
) -> bool:
    try:
        obs.stop_media(source_name)
    except Exception:
        pass
    try:
        obs.hide_source(scene, source_name)
    except Exception:
        pass
    time.sleep(0.03)

    obs.set_media_source_file(source_name, filepath)
    file_applied = _wait_for_media_source_file(source_name, filepath, timeout=min(2.0, max(0.5, start_timeout)))
    if not file_applied:
        return False
    # A local_file change can itself start the OBS media input. Cancel that
    # implicit start so this helper has exactly one playback start below.
    try:
        obs.stop_media(source_name)
    except Exception:
        pass
    try:
        obs.show_source(scene, source_name)
    except Exception:
        pass
    if swap_settle_ms > 0:
        time.sleep(max(0.0, float(swap_settle_ms) / 1000.0))
    else:
        time.sleep(0.03)
    try:
        obs.restart_media(source_name)
    except Exception:
        pass

    deadline = time.time() + max(1.0, start_timeout)
    saw_progress = False
    while time.time() < deadline:
        status = obs.get_media_status(source_name) or {}
        state = status.get("state")
        cursor_ms = status.get("cursor_ms")
        if cursor_ms is not None:
            try:
                saw_progress = saw_progress or float(cursor_ms) > 0.0
            except (TypeError, ValueError):
                pass
        if state == _MEDIA_STATE_PLAYING:
            return True
        if saw_progress:
            return True
        if state in _MEDIA_STATE_STARTING:
            time.sleep(0.05)
            continue
        time.sleep(0.08)

    return False


def _project_dir(cfg: MediaProjectConfig):
    return cfg.project_dir or cfg.phrases_file.parent


def _load_runtime_settings(cfg: MediaProjectConfig):
    try:
        return load_project_settings(
            _project_dir(cfg),
            hotkeys_file=Path(_project_dir(cfg)) / "hotkeys.json",
            asset_dir=cfg.asset_dir,
            valid_extensions=cfg.valid_extensions,
        )
    except Exception:
        return None


def _read_input_audio_tracks(source_name: str) -> dict[str, bool]:
    client = obs.get_obs()
    try:
        resp = client.send("GetInputAudioTracks", {"inputName": source_name}, raw=True)
    except TypeError:
        resp = client.send("GetInputAudioTracks", {"inputName": source_name})
    except Exception:
        return {}

    if isinstance(resp, dict):
        tracks = resp.get("inputAudioTracks") or resp.get("input_audio_tracks") or {}
    else:
        tracks = getattr(resp, "input_audio_tracks", None) or getattr(resp, "inputAudioTracks", None) or {}
    if not isinstance(tracks, dict):
        return {}
    return {str(key): bool(value) for key, value in tracks.items() if str(key).strip()}


def _parse_trigger_sequences(raw: str) -> list[list[str]]:
    if not str(raw or "").strip():
        return []
    sequences: list[list[str]] = []
    for part in str(raw).split(";"):
        text = part.strip()
        if not text:
            continue
        seq = [item for item in text.split(" ") if item] if " " in text else list(text)
        if seq:
            sequences.append(seq)
    return sequences


def _match_category_name(query: str, categories: list[str]) -> str | None:
    if not query or not categories:
        return None
    query_folded = query.strip().lower()
    for category in categories:
        if category.lower() == query_folded:
            return category
    scored = [
        (category, _simple_ratio(query_folded, category.lower()))
        for category in categories
    ]
    best = max(scored, key=lambda item: item[1], default=(None, 0.0))
    return best[0] if best[0] and best[1] >= 0.62 else None


def _simple_ratio(left: str, right: str) -> float:
    from difflib import SequenceMatcher

    return SequenceMatcher(None, left, right).ratio()


def _parse_runtime_command(text: str) -> tuple[str, str] | None:
    norm = " ".join(str(text or "").lower().strip().split())
    if not norm:
        return None
    aliases = {
        "random": ("random", "shuffle", "play random", "start random"),
        "next": ("next", "skip", "skip it", "next one", "next clip"),
        "stop": ("stop", "stop it", "abort", "cancel"),
        "reload": ("reload", "refresh", "reload media", "refresh media"),
    }
    for command, values in aliases.items():
        for alias in values:
            if norm == alias:
                return command, ""
            if command == "random" and norm.startswith(alias + " "):
                return command, norm[len(alias):].strip()
    return None


def build_name_index(
    cfg: MediaProjectConfig,
    single_source_name: str | None = None,
) -> dict[str, tuple[Path, str]]:
    """
    Scan asset_dir and return:
        {lower_stem: (filepath, obs_source_name)}

    When ``single_source_name`` is provided (single-source mode), every stem
    maps to that same OBS source instead of one source per file.
    """
    index: dict[str, tuple[Path, str]] = {}

    if not cfg.asset_dir.is_dir():
        print(f"[{cfg.project_name}] Assets dir not found: {cfg.asset_dir}")
        return index

    for p in cfg.asset_dir.iterdir():
        if p.is_file() and p.suffix.lower() in cfg.valid_extensions:
            obs_name = single_source_name or f"{cfg.obs_source_prefix}{p.stem}"
            index[p.stem.lower()] = (p, obs_name)

    return index


def create_project_interface(
    *,
    project_name: str,
    controlled_scenes: list[str],
    live_state: dict,
):
    from shared import ProjectInterface, ProjectStatus, project_registry

    _controlled_scenes = controlled_scenes

    class _GenericMediaInterface(ProjectInterface):
        name = project_name
        controlled_scenes = _controlled_scenes
        produces_audio = True

        def get_status(self) -> ProjectStatus:
            visible = live_state.get("visible_sources") or set()
            is_active = bool(visible)
            activity = f"playing: {', '.join(sorted(visible))}" if visible else None
            return ProjectStatus(
                name=self.name,
                is_active=is_active,
                current_activity=activity,
                controlled_scenes=self.controlled_scenes,
                can_revert=True,
            )

        def revert(self) -> None:
            hide_all = live_state.get("hide_all")
            if hide_all:
                hide_all()

        def pause(self) -> None:
            action = live_state.get("run_action")
            if action:
                action("pause")

        def resume(self) -> None:
            action = live_state.get("run_action")
            if action:
                action("resume")

        def action_catalog(self) -> list[dict]:
            return action_catalog()

        def run_action(self, action: str, **kwargs) -> dict:
            runner = live_state.get("run_action")
            if not runner:
                return {"ok": False, "error": f"{self.name} is not running yet"}
            return runner(action, **kwargs)

        def volume_state(self) -> dict:
            getter = live_state.get("volume_state")
            return getter() if getter else {}

    interface = _GenericMediaInterface()
    project_registry.register(interface)
    return interface


def run_media_project(
    *,
    cfg: MediaProjectConfig,
    input_queue: queue.Queue,
    stop_event: threading.Event,
    live_state: dict,
    startup_event: threading.Event | None = None,
) -> None:
    visible_sources: set[str] = set()
    visible_lock = threading.Lock()
    play_lock = threading.Lock()
    currently_playing: list[str | None] = [None]
    current_source_name: list[str | None] = [None]
    current_play_request_id = [0]
    shared_source_cursor = [-1]
    triggers = [SequenceTrigger(seq, cfg.trigger_max_interval) for seq in cfg.trigger_sequences]
    trigger_mode: list[str] = [_read_hub_trigger_mode(cfg.project_name)]
    _paused_by_trigger: list[str | None] = [None]
    _paused_source_name: list[str | None] = [None]
    active_settings = [_load_runtime_settings(cfg)]
    active_profile_name = [active_settings[0].profile_name if active_settings[0] else "default"]
    profile_triggers: dict[str, list[SequenceTrigger]] = {}
    project_dir = Path(_project_dir(cfg))
    hotkeys_file = project_dir / "hotkeys.json"
    editor_state_file = hotkeys_file.parent / f"{hotkeys_file.stem}_editor.json"
    profile_files_mtime = [-1.0]
    manual_hotkeys_enabled = _feature_enabled(cfg, "manual_hotkeys_enabled", True)
    voice_commands_enabled = _feature_enabled(cfg, "voice_commands_enabled", True)
    random_commands_enabled = _feature_enabled(cfg, "random_commands_enabled", False)
    action_triggers: dict[str, list[SequenceTrigger]] = {}

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

    name_index = build_name_index(cfg, single_source_name=_single_source)
    print(f"[{cfg.project_name}] {len(name_index)} asset(s) loaded.")

    # ── Layout rules cache (used for per-file transforms in single-source mode) ─
    _layout_rules_path = layout_rules_file_for_config(cfg)
    _layout_rules_cache: list[dict] = [{}]
    _layout_rules_mtime: list[float] = [-1.0]

    def _refresh_layout_rules_if_needed() -> None:
        try:
            mtime = _layout_rules_path.stat().st_mtime
        except OSError:
            return
        if mtime == _layout_rules_mtime[0]:
            return
        _layout_rules_mtime[0] = mtime
        _layout_rules_cache[0] = load_layout_rules(_layout_rules_path)

    _refresh_layout_rules_if_needed()

    def profile_files_stamp() -> float:
        stamp = 0.0
        for path in (editor_state_file, hotkeys_file):
            try:
                stamp = max(stamp, path.stat().st_mtime)
            except OSError:
                pass
        return stamp

    def refresh_profile_triggers() -> None:
        profile_triggers.clear()
        for profile in load_project_profile_summaries(
            project_dir,
            hotkeys_file=hotkeys_file,
        ):
            profile_name = str(profile.get("name") or "")
            sequences = _parse_trigger_sequences(str(profile.get("trigger_sequences") or ""))
            if profile_name and sequences:
                profile_triggers[profile_name] = [
                    SequenceTrigger(seq, cfg.trigger_max_interval)
                    for seq in sequences
                ]

    def activate_profile(profile_name: str) -> bool:
        settings = load_project_settings(
            project_dir,
            hotkeys_file=hotkeys_file,
            asset_dir=cfg.asset_dir,
            valid_extensions=cfg.valid_extensions,
            profile=profile_name,
        )
        if settings.profile_name != profile_name:
            return False
        active_settings[0] = settings
        active_profile_name[0] = settings.profile_name
        print(f"[{cfg.project_name}] Profile armed: {settings.profile_name}")
        return True

    def activate_live_profile() -> bool:
        settings = load_project_settings(
            project_dir,
            hotkeys_file=hotkeys_file,
            asset_dir=cfg.asset_dir,
            valid_extensions=cfg.valid_extensions,
        )
        active_settings[0] = settings
        active_profile_name[0] = settings.profile_name
        return True

    def reload_runtime_profiles(force: bool = False) -> None:
        stamp = profile_files_stamp()
        if not force and stamp == profile_files_mtime[0]:
            return
        profile_files_mtime[0] = stamp
        refresh_profile_triggers()
        if not activate_profile(active_profile_name[0]):
            activate_live_profile()
        refresh_action_triggers()
        trigger_mode[0] = _read_hub_trigger_mode(cfg.project_name)
        print(f"[{cfg.project_name}] Profiles reloaded live.")

    def current_manual_map() -> dict[str, str | list[str]]:
        settings = active_settings[0]
        return dict(settings.hotkeys) if settings is not None else cfg.manual_trigger_map

    def current_interface_hotkeys() -> dict[str, str]:
        merged = normalize_interface_hotkeys(cfg.interface_hotkeys)
        settings = active_settings[0]
        if settings is not None:
            for action, value in normalize_interface_hotkeys(settings.interface_hotkeys).items():
                if value:
                    merged[action] = value
        return merged

    def refresh_action_triggers() -> None:
        action_triggers.clear()
        for action, sequence_text in current_interface_hotkeys().items():
            sequences = parse_sequences(sequence_text)
            if sequences:
                action_triggers[action] = [
                    SequenceTrigger(seq, cfg.trigger_max_interval)
                    for seq in sequences
                ]

    reload_runtime_profiles(force=True)

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
                include_filters=True,
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
            obs.stop_media(source_name)
        except Exception:
            pass
        try:
            obs.hide_source(cfg.scene, source_name)
        except Exception:
            pass

    if startup_event is not None:
        startup_event.set()
        print(f"[{cfg.project_name}] Startup initialization complete.")

    def hide_all_sources() -> None:
        with visible_lock:
            to_hide = set(visible_sources) | managed_sources
            visible_sources.clear()

        for name in to_hide:
            try:
                obs.hide_source(cfg.scene, name)
            except Exception:
                pass

    atexit.register(hide_all_sources)
    live_state["visible_sources"] = visible_sources
    live_state["hide_all"] = hide_all_sources

    def _single_source_store_for(source_name: str) -> SingleSourceStateStore | None:
        return source_state_stores.get(source_name)

    def _choose_shared_source(preferred_previous: str | None = None) -> str:
        if not _shared_sources:
            return _single_source or ""
        if len(_shared_sources) == 1:
            return _shared_sources[0]

        for offset in range(1, len(_shared_sources) + 1):
            index = (shared_source_cursor[0] + offset) % len(_shared_sources)
            candidate = _shared_sources[index]
            if candidate != preferred_previous:
                shared_source_cursor[0] = index
                return candidate

        shared_source_cursor[0] = (shared_source_cursor[0] + 1) % len(_shared_sources)
        return _shared_sources[shared_source_cursor[0]]

    def play_asset(name: str) -> None:
        entry = name_index.get(name)
        if entry is None:
            known = list(name_index.keys())
            print(
                f"[{cfg.project_name}] No match for '{name}'. "
                f"Known: {', '.join(known) or '(none)'}"
            )
            return

        filepath, default_source_name = entry

        # Claim the play slot and stop whatever was already playing in this
        # project.  This happens immediately so back-to-back triggers don't
        # queue up; the coordinator handles pausing OTHER projects.
        with play_lock:
            prev_source = current_source_name[0]
            prev = currently_playing[0]
            if prev_source:
                try:
                    obs.stop_media(prev_source)
                except Exception:
                    pass
                try:
                    obs.hide_source(cfg.scene, prev_source)
                except Exception:
                    pass
                with visible_lock:
                    visible_sources.discard(prev_source)
            currently_playing[0] = name
            source_name = _choose_shared_source(prev_source) if _single_source_mode else default_source_name
            current_source_name[0] = source_name
            current_play_request_id[0] += 1
            request_id = current_play_request_id[0]

        # The actual OBS play runs after the coordinator has paused any
        # conflicting projects (per hub_rules.py).  coordinator.request_to_play
        # is non-blocking — it spawns a daemon thread that calls _do_play once
        # all required pauses have been acknowledged.
        def _do_play() -> None:
            with play_lock:
                is_stale = (
                    current_play_request_id[0] != request_id
                    or currently_playing[0] != name
                    or current_source_name[0] != source_name
                )
            if is_stale:
                coordinator.announce_finished(cfg.project_name)
                return

            print(f"[{cfg.project_name}] Playing: '{source_name}'")

            with visible_lock:
                visible_sources.add(source_name)

            source_state_store = _single_source_store_for(source_name)
            try:
                if source_state_store is not None:
                    loaded_file = str(_get_obs_input_settings(source_name).get("local_file") or "").strip()
                    if loaded_file:
                        source_state_store.capture_override_for_stem(Path(loaded_file).stem)
                    source_state_store.apply_for_stem(name)
                apply_runtime_media_settings(source_name)
                apply_runtime_audio_settings(source_name, name)

                # In single-source mode the editor's per-file canvas rule should
                # win at play time, because the shared source baseline/filters are
                # applied through the state store above.
                if _single_source_mode:
                    _refresh_layout_rules_if_needed()
                    settings = active_settings[0]
                    cats = list(settings.sound_categories.get(name, ())) if settings else []
                    rule = resolve_rule_for_stem(
                        _layout_rules_cache[0],
                        stem=name,
                        path=filepath,
                        categories=cats,
                    )
                    if rule:
                        try:
                            obs.set_source_transform(cfg.scene, source_name, obs_transform_from_rule(rule))
                        except Exception as _exc:
                            print(f"[{cfg.project_name}] Could not apply layout rule for '{name}': {_exc}")

                if _single_source_mode:
                    started_ok = _start_media_source_playback(
                        scene=cfg.scene,
                        source_name=source_name,
                        filepath=filepath,
                        start_timeout=cfg.media_start_timeout,
                        swap_settle_ms=max(0, int(getattr(cfg, "media_swap_settle_ms", 0) or 0)),
                    )
                    if started_ok:
                        apply_runtime_audio_settings(source_name, name)
                    if not started_ok:
                        print(f"[{cfg.project_name}] Playback may not have started cleanly for '{filepath.name}'.")
                        raise RuntimeError(f"Shared source '{source_name}' did not start playback cleanly.")
                else:
                    obs.stop_media(source_name)
                    obs.show_source(cfg.scene, source_name)
                    obs.restart_media(source_name)
                obs.wait_for_media_end(
                    source_name,
                    start_timeout=cfg.media_start_timeout,
                    total_timeout=cfg.media_total_timeout,
                )
            except Exception as exc:
                print(f"[{cfg.project_name}] Playback failed for '{source_name}': {exc}")
            finally:
                if source_state_store is not None:
                    try:
                        source_state_store.capture_override_for_stem(name)
                    except Exception as exc:
                        print(f"[{cfg.project_name}] Could not save single-source override for '{name}': {exc}")

                with play_lock:
                    still_current = currently_playing[0] == name

                if still_current:
                    obs.hide_source(cfg.scene, source_name)
                    with visible_lock:
                        visible_sources.discard(source_name)

                with play_lock:
                    if currently_playing[0] == name:
                        currently_playing[0] = None
                    if current_source_name[0] == source_name:
                        current_source_name[0] = None

                # Announce completion so the coordinator can resume any
                # projects it paused on our behalf.
                coordinator.announce_finished(cfg.project_name)

        coordinator.request_to_play(cfg.project_name, on_ready=_do_play)

    def play_asset_concurrent(name: str) -> None:
        entry = name_index.get(name)
        if entry is None:
            print(f"[{cfg.project_name}] Concurrent: no match for '{name}'.")
            return

        filepath, default_source_name = entry
        with play_lock:
            source_name = _choose_shared_source(current_source_name[0]) if _single_source_mode else default_source_name
        print(f"[{cfg.project_name}] Playing (concurrent): '{source_name}'")

        with visible_lock:
            visible_sources.add(source_name)

        source_state_store = _single_source_store_for(source_name)
        try:
            if source_state_store is not None:
                loaded_file = str(_get_obs_input_settings(source_name).get("local_file") or "").strip()
                if loaded_file:
                    source_state_store.capture_override_for_stem(Path(loaded_file).stem)
                source_state_store.apply_for_stem(name)
            apply_runtime_media_settings(source_name)
            apply_runtime_audio_settings(source_name, name)
            if _single_source_mode:
                _refresh_layout_rules_if_needed()
                settings = active_settings[0]
                cats = list(settings.sound_categories.get(name, ())) if settings else []
                rule = resolve_rule_for_stem(
                    _layout_rules_cache[0],
                    stem=name,
                    path=filepath,
                    categories=cats,
                )
                if rule:
                    try:
                        obs.set_source_transform(cfg.scene, source_name, obs_transform_from_rule(rule))
                    except Exception as _exc:
                        print(f"[{cfg.project_name}] Could not apply layout rule for '{name}': {_exc}")
            if _single_source_mode:
                started_ok = _start_media_source_playback(
                    scene=cfg.scene,
                    source_name=source_name,
                    filepath=filepath,
                    start_timeout=cfg.media_start_timeout,
                    swap_settle_ms=max(0, int(getattr(cfg, "media_swap_settle_ms", 0) or 0)),
                )
                if started_ok:
                    apply_runtime_audio_settings(source_name, name)
                if not started_ok:
                    print(f"[{cfg.project_name}] Concurrent playback may not have started cleanly for '{filepath.name}'.")
                    raise RuntimeError(f"Shared source '{source_name}' did not start playback cleanly.")
            else:
                obs.stop_media(source_name)
                obs.show_source(cfg.scene, source_name)
                obs.restart_media(source_name)
            obs.wait_for_media_end(
                source_name,
                start_timeout=cfg.media_start_timeout,
                total_timeout=cfg.media_total_timeout,
            )
        except Exception as exc:
            print(f"[{cfg.project_name}] Concurrent playback failed for '{source_name}': {exc}")
        finally:
            if source_state_store is not None:
                try:
                    source_state_store.capture_override_for_stem(name)
                except Exception as exc:
                    print(f"[{cfg.project_name}] Could not save single-source override for '{name}': {exc}")
            obs.hide_source(cfg.scene, source_name)
            with visible_lock:
                visible_sources.discard(source_name)

    random_lock = threading.Lock()
    random_active = [False]
    random_stop_event = threading.Event()
    random_thread: list[threading.Thread | None] = [None]
    random_played: set[str] = set()

    def source_volume_for(stem: str) -> float:
        settings = active_settings[0]
        settings_project_db = settings.project_volume_db if settings is not None else 0.0
        settings_profile_db = settings.profile_volume_db if settings is not None else 0.0
        settings_file_db = (
            settings.file_volume_offsets.get(stem, 0.0)
            if settings is not None else 0.0
        )
        cfg_file_db = cfg.file_volume_offsets.get(stem, 0.0)
        # Category offset: use the primary (first) category of this stem.
        category_db = 0.0
        if settings is not None:
            cats = list(settings.sound_categories.get(stem, ()))
            if cats:
                category_db = settings.category_volume_db.get(cats[0], 0.0)
        return effective_volume_db(
            project_volume_db=cfg.project_volume_db + settings_project_db,
            profile_volume_db=cfg.profile_volume_db + settings_profile_db,
            category_offset_db=category_db,
            file_offset_db=cfg_file_db + settings_file_db,
        )

    def apply_runtime_media_settings(source_name: str) -> None:
        try:
            obs.configure_media_source_properties(
                source_name,
                restart_on_activate=False,
                close_when_inactive=True,
                looping=False,
                hw_decode=True,
                clear_on_media_end=False,
            )
        except Exception as exc:
            print(f"[{cfg.project_name}] Could not set media properties for '{source_name}': {exc}")

    def apply_runtime_audio_settings(source_name: str, stem: str) -> None:
        try:
            obs.set_input_mute(source_name, False)
        except Exception as exc:
            print(f"[{cfg.project_name}] Could not unmute '{source_name}': {exc}")
        try:
            obs.set_input_audio_monitor_type(source_name, cfg.monitor)
        except Exception as exc:
            print(f"[{cfg.project_name}] Could not set monitor mode for '{source_name}': {exc}")
        if cfg.audio_tracks:
            try:
                obs.set_input_audio_tracks(source_name, cfg.audio_tracks)
            except Exception as exc:
                print(f"[{cfg.project_name}] Could not set audio tracks for '{source_name}': {exc}")
        obs.set_input_volume_db(source_name, source_volume_for(stem))

    def volume_state() -> dict:
        settings = active_settings[0]
        with play_lock:
            current_stem = currently_playing[0]
            source_name = current_source_name[0]
        return {
            "project_volume_db": cfg.project_volume_db + (settings.project_volume_db if settings else 0.0),
            "profile_volume_db": cfg.profile_volume_db + (settings.profile_volume_db if settings else 0.0),
            "profile": active_profile_name[0],
            "current_stem": current_stem,
            "source_name": source_name,
        }

    def stop_current_playback() -> None:
        with play_lock:
            current = currently_playing[0]
            source_name = current_source_name[0]
            currently_playing[0] = None
            current_source_name[0] = None
        if current and source_name:
            print(f"[{cfg.project_name}] Stopping '{source_name}'.")
            try:
                obs.stop_media(source_name)
                obs.hide_source(cfg.scene, source_name)
            except Exception:
                pass
            with visible_lock:
                visible_sources.discard(source_name)

    def stop_random_mode() -> None:
        with random_lock:
            if not random_active[0]:
                return
            random_active[0] = False
        random_stop_event.set()
        stop_current_playback()
        thread = random_thread[0]
        if thread and thread.is_alive():
            thread.join(timeout=2)
        random_stop_event.clear()
        print(f"[{cfg.project_name}] Random mode stopped.")

    def eligible_random_stems(category_query: str = "") -> list[str]:
        stems = sorted(name_index.keys())
        if not category_query:
            return stems
        settings = active_settings[0] or _load_runtime_settings(cfg)
        if settings is None:
            return stems
        category = _match_category_name(category_query, list(settings.categories))
        if not category:
            print(f"[{cfg.project_name}] Unknown category '{category_query}'.")
            return []
        allowed = {stem.lower() for stem in settings.stems_in_category(category)}
        return [stem for stem in stems if stem in allowed]

    def pick_random_stem(stems: list[str]) -> str | None:
        if not stems:
            return None
        remaining = [stem for stem in stems if stem not in random_played]
        if not remaining:
            random_played.clear()
            remaining = stems
        choice = random.choice(remaining)
        random_played.add(choice)
        return choice

    def random_loop(category_query: str = "") -> None:
        with random_lock:
            random_active[0] = True
        random_played.clear()
        try:
            stems = eligible_random_stems(category_query)
            if not stems:
                print(f"[{cfg.project_name}] Random mode has no eligible media.")
                return
            print(f"[{cfg.project_name}] Random mode started ({len(stems)} asset(s)).")
            while not stop_event.is_set() and not random_stop_event.is_set():
                choice = pick_random_stem(stems)
                if not choice:
                    return
                play_asset(choice)
                while not stop_event.is_set() and not random_stop_event.is_set():
                    with play_lock:
                        active = currently_playing[0]
                    if active is None:
                        break
                    time.sleep(0.2)
        finally:
            with random_lock:
                random_active[0] = False
            print(f"[{cfg.project_name}] Random loop exited.")

    def start_random_mode(category_query: str = "") -> None:
        stop_random_mode()
        thread = threading.Thread(
            target=random_loop,
            args=(category_query,),
            daemon=True,
            name=f"{cfg.project_name}:random",
        )
        random_thread[0] = thread
        thread.start()

    def on_event(data: dict) -> None:
        source = str(data.get("source", "")).lower().strip()
        if not source:
            return

        target = play_asset_concurrent if data.get("concurrent", False) else play_asset

        threading.Thread(
            target=target,
            args=(source,),
            daemon=True,
            name=f"{cfg.project_name}:{source}",
        ).start()

    if cfg.event_name:
        hub_events.subscribe(cfg.event_name, on_event)

    def on_transcript(text: str) -> None:
        if _voice_suppressed[0]:
            _voice_suppressed[0] = False
            print(f"[{cfg.project_name}] Voice transcript suppressed (manual hotkey was used).")
            return
        if not text or not text.strip():
            print(f"[{cfg.project_name}] Empty transcription.")
            return

        command = _parse_runtime_command(text)
        if command and random_commands_enabled:
            action, qualifier = command
            if action == "random":
                start_random_mode(qualifier)
                return
            if action == "next":
                with random_lock:
                    in_random = random_active[0]
                if in_random:
                    stop_current_playback()
                else:
                    print(f"[{cfg.project_name}] 'next' only applies while random mode is running.")
                return
            if action == "stop":
                stop_random_mode()
                stop_current_playback()
                return
            if action == "reload":
                name_index.clear()
                name_index.update(build_name_index(cfg, single_source_name=_single_source if _single_source_mode else None))
                if not _single_source_mode:
                    apply_saved_layout_rules(cfg, name_index)
                print(f"[{cfg.project_name}] Reloaded {len(name_index)} asset(s).")
                return

        matched = match_phrase(
            text,
            list(name_index.keys()),
            phrases_file=cfg.phrases_file,
            fuzzy_threshold=cfg.fuzzy_threshold,
            semantic_gap=cfg.semantic_gap,
            matching_strategy=cfg.matching_strategy,
            fuzzy_scorer=cfg.fuzzy_scorer,
            fuzzy_weight=cfg.fuzzy_weight,
            token_weight=cfg.token_weight,
            embedding_weight=cfg.embedding_weight,
            embedding_model=cfg.embedding_model,
            verbose=cfg.verbose_matcher,
        )
        if matched is None:
            paused_stem = _paused_by_trigger[0]
            paused_source = _paused_source_name[0]
            _paused_by_trigger[0] = None
            _paused_source_name[0] = None
            if paused_stem is not None and paused_source:
                try:
                    obs.play_media(paused_source)
                    print(f"[{cfg.project_name}] No match — resuming '{paused_source}'.")
                except Exception as exc:
                    print(f"[{cfg.project_name}] Could not resume '{paused_stem}': {exc}")
            return

        _paused_by_trigger[0] = None  # play_asset's play_lock handles stopping old source
        _paused_source_name[0] = None
        play_asset(matched)

    ptt = (
        VoicePTT(
            timeout=cfg.auto_record_timeout,
            on_transcript=on_transcript,
            tag=cfg.project_name,
        )
        if voice_commands_enabled
        else None
    )

    manual_lock = threading.Lock()
    in_manual_window = [False]
    pending_voice_timer: list[threading.Timer | None] = [None]
    _voice_suppressed = [False]  # set synchronously when a manual hotkey wins the window

    def end_manual_window() -> None:
        with manual_lock:
            in_manual_window[0] = False
            pending_voice_timer[0] = None

    def begin_trigger_window() -> None:
        _voice_suppressed[0] = False  # clear stale suppression before opening new window
        if manual_hotkeys_enabled:
            with manual_lock:
                in_manual_window[0] = True
                if pending_voice_timer[0] is not None:
                    pending_voice_timer[0].cancel()
                timer = threading.Timer(cfg.manual_trigger_window, end_manual_window)
                pending_voice_timer[0] = timer
                timer.start()
        if ptt is not None:
            ptt.on_trigger()
        elif not manual_hotkeys_enabled:
            print(f"[{cfg.project_name}] Trigger detected, but no trigger action is enabled.")

    def run_interface_action(action: str, **_kwargs) -> dict:
        reload_runtime_profiles()
        if action == "start_listen":
            if ptt is not None and ptt.is_recording:
                return {"ok": True, "action": action, "message": "Already listening."}
            begin_trigger_window()
        elif action == "stop_listen":
            if ptt is not None and ptt.is_recording:
                ptt.on_trigger()
        elif action == "abort_listen":
            if ptt is not None:
                ptt.cancel(f"{cfg.project_name} abort listen")
            end_manual_window()
        elif action == "pause":
            with play_lock:
                source_name = current_source_name[0]
            if source_name:
                obs.pause_media(source_name)
        elif action == "resume":
            with play_lock:
                source_name = current_source_name[0]
            if source_name:
                obs.play_media(source_name)
        elif action == "stop":
            stop_random_mode()
            stop_current_playback()
        elif action == "random":
            start_random_mode("")
        elif action == "next":
            with random_lock:
                in_random = random_active[0]
            if in_random:
                stop_current_playback()
        elif action == "reload":
            name_index.clear()
            name_index.update(build_name_index(cfg, single_source_name=_single_source if _single_source_mode else None))
            reload_runtime_profiles(force=True)
            if not _single_source_mode:
                apply_saved_layout_rules(cfg, name_index)
        else:
            return {"ok": False, "error": f"Unsupported media action: {action}"}
        return {"ok": True, "action": action, "message": f"{cfg.project_name}: {action} ran."}

    live_state["run_action"] = run_interface_action
    live_state["volume_state"] = volume_state

    def run_hotkey_action(fn, *args) -> None:
        threading.Thread(target=fn, args=args, daemon=True).start()

    def handle_manual_trigger(char: str, clip_value) -> None:
        if ptt is not None:
            ptt.cancel(f"{cfg.project_name} manual key pressed")

        if clip_value:
            if isinstance(clip_value, list):
                clip_name = random.choice(clip_value).lower()
            else:
                clip_name = clip_value.lower()
            play_asset(clip_name)
        else:
            print(f"[{cfg.project_name}] trigger+{char} is not configured — set it in config.py.")

    def stop_current_playing_source(current: str, stop_src: str) -> None:
        with play_lock:
            if currently_playing[0] != current:
                # A newer trigger already replaced this playback slot.
                # In shared-source mode, stopping here would kill the new clip.
                return
            currently_playing[0] = None
            if current_source_name[0] == stop_src:
                current_source_name[0] = None
        print(f"[{cfg.project_name}] Trigger while playing — stopping '{stop_src}'.")
        obs.stop_media(stop_src)
        obs.hide_source(cfg.scene, stop_src)
        with visible_lock:
            visible_sources.discard(stop_src)

    def on_press(key) -> None:
        char = key_token(key)

        if not char:
            return

        reload_runtime_profiles()

        for action, triggers_for_action in action_triggers.items():
            if any(t.register_key(char) for t in triggers_for_action):
                run_hotkey_action(run_interface_action, action)
                return

        with manual_lock:
            manual_map = current_manual_map()
            if manual_hotkeys_enabled and in_manual_window[0] and char in manual_map:
                in_manual_window[0] = False

                if pending_voice_timer[0] is not None:
                    pending_voice_timer[0].cancel()
                    pending_voice_timer[0] = None

                _voice_suppressed[0] = True  # suppress any racing voice transcript
                clip_value = manual_map[char]
                # Handle the winner synchronously so the same key press cannot
                # also be consumed by VoicePTT's shared stop-key listener.
                handle_manual_trigger(char, clip_value)
                return

        for profile_name, profile_seq_triggers in profile_triggers.items():
            if any(t.register_key(char) for t in profile_seq_triggers):
                if activate_profile(profile_name):
                    if manual_hotkeys_enabled:
                        begin_trigger_window()
                    elif ptt is not None:
                        ptt.on_trigger()
                return

        if any(t.register_key(char) for t in triggers):
            activate_live_profile()
            if ptt is not None and ptt.is_recording:
                ptt.on_trigger()
                return

            with play_lock:
                current = currently_playing[0]

            _paused_by_trigger[0] = None  # clear any stale pause from a previous window
            _paused_source_name[0] = None
            mode = trigger_mode[0]

            if current is not None and current in name_index:
                with play_lock:
                    stop_src = current_source_name[0] or name_index[current][1]
                if mode == "abort":
                    run_hotkey_action(stop_current_playing_source, current, stop_src)
                    if not _feature_enabled(cfg, "trigger_restarts_listen", False):
                        return
                elif mode == "pause":
                    try:
                        obs.pause_media(stop_src)
                        _paused_by_trigger[0] = current
                        _paused_source_name[0] = stop_src
                        print(f"[{cfg.project_name}] Trigger while playing — paused '{stop_src}'. Speak to swap or stay silent to resume.")
                    except Exception as exc:
                        print(f"[{cfg.project_name}] Could not pause '{stop_src}': {exc}")
                elif mode == "keep_playing":
                    print(f"[{cfg.project_name}] Trigger while playing — keeping '{stop_src}' running. Speak to swap.")

            begin_trigger_window()

    kb_token = subscribe_global_hotkeys(on_press)

    manual_keys = "".join(cfg.manual_trigger_map.keys())
    trigger_labels = " / ".join("".join(seq) for seq in cfg.trigger_sequences)
    print(
        f"[{cfg.project_name}] Armed — press {trigger_labels} quickly, "
        f"then speak or press [{manual_keys}] for a direct asset."
    )

    try:
        while not stop_event.is_set():
            try:
                input_queue.get(timeout=0.5)
            except queue.Empty:
                continue
    finally:
        with manual_lock:
            if pending_voice_timer[0] is not None:
                pending_voice_timer[0].cancel()
                pending_voice_timer[0] = None

        if cfg.event_name:
            hub_events.unsubscribe(cfg.event_name, on_event)
        if ptt is not None:
            ptt.cancel("shutdown")
        stop_random_mode()
        unsubscribe_global_hotkeys(kb_token)
        print(f"[{cfg.project_name}] Stopped.")

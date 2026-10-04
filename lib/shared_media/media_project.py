from __future__ import annotations

import atexit
import queue
import random
import threading
from pathlib import Path

from .commands import _parse_trigger_sequences, _parse_runtime_command
from .source_playback import _start_media_source_playback
from .runtime_settings import _read_hub_trigger_mode, _feature_enabled, _project_dir, _load_runtime_settings
from .inventory import build_name_index
from .source_setup import prepare_sources
from .asset_layout import AssetLayout
from .interface import create_project_interface


import obs
import events as hub_events
from shared import SequenceTrigger, VoicePTT
from lib.global_hotkeys import key_token, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from lib.runtime_cleanup import run_cleanup
from lib.shared_media.trigger_window import ManualTriggerWindow
from lib.shared_media.random_mode import RandomMode
from lib.shared_media.random_playlist import RandomPlaylist
from lib.shared_media.source_audio import SourceAudio
from lib.shared_media.playback_controller import MediaPlayback
from lib.shared_media.asset_playback import AssetPlayback
from lib.shared_media.runtime_profiles import RuntimeProfiles

from .media_config import MediaProjectConfig
from .media_phrase_matcher import match_phrase
from .layout_rules import apply_saved_layout_rules
from .single_source_state import SingleSourceStateStore


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
    triggers = [SequenceTrigger(seq, cfg.trigger_max_interval) for seq in cfg.trigger_sequences]
    trigger_mode: list[str] = [_read_hub_trigger_mode(cfg.project_name)]
    _paused_by_trigger: list[str | None] = [None]
    _paused_source_name: list[str | None] = [None]
    project_dir = Path(_project_dir(cfg))
    profiles = RuntimeProfiles(cfg, project_dir, profile_parser=_parse_trigger_sequences)
    active_settings = profiles.active_settings
    active_profile_name = profiles.active_profile_name
    profile_triggers = profiles.profile_triggers
    manual_hotkeys_enabled = _feature_enabled(cfg, "manual_hotkeys_enabled", True)
    voice_commands_enabled = _feature_enabled(cfg, "voice_commands_enabled", True)
    random_commands_enabled = _feature_enabled(cfg, "random_commands_enabled", False)
    action_triggers = profiles.action_triggers

    prepared = prepare_sources(cfg, project_dir, obs_api=obs)
    _single_source_mode = prepared.single_source_mode
    _shared_sources = prepared.shared_sources
    _single_source = prepared.primary
    name_index = prepared.name_index
    source_state_stores = prepared.state_stores
    managed_sources = prepared.managed_sources

    layout = AssetLayout(cfg, profiles.active_settings)
    layout_for_asset = layout.resolve

    activate_profile = profiles.activate
    activate_live_profile = profiles.activate_live
    current_manual_map = profiles.manual_map

    def reload_runtime_profiles(force: bool = False) -> None:
        if profiles.reload(force=force):
            trigger_mode[0] = _read_hub_trigger_mode(cfg.project_name)
            print(f"[{cfg.project_name}] Profiles reloaded live.")

    reload_runtime_profiles(force=True)

    if startup_event is not None:
        startup_event.set()
        print(f"[{cfg.project_name}] Startup initialization complete.")

    def hide_all_sources() -> None:
        with visible_lock:
            to_hide = set(visible_sources) | managed_sources
            visible_sources.clear()

        for name in to_hide:
            try:
                obs.park_media_source(cfg.scene, name)
            except Exception:
                pass

    atexit.register(hide_all_sources)
    live_state["visible_sources"] = visible_sources
    live_state["visible_lock"] = visible_lock
    live_state["hide_all"] = hide_all_sources

    def _single_source_store_for(source_name: str) -> SingleSourceStateStore | None:
        return source_state_stores.get(source_name)


    random_lock = threading.Lock()
    random_active = [False]

    source_audio = SourceAudio(cfg, active_settings, obs)
    source_volume_for = source_audio.volume_for
    apply_runtime_media_settings = source_audio.configure_media
    apply_runtime_audio_settings = source_audio.configure_audio

    asset_player = AssetPlayback(cfg, obs_api=obs, start_source=_start_media_source_playback,
        state_for=_single_source_store_for, apply_media=apply_runtime_media_settings,
        apply_audio=apply_runtime_audio_settings, layout_for=layout_for_asset)
    playback = MediaPlayback(cfg, stop_event, name_index, asset_player,
        visible_sources=visible_sources, visible_lock=visible_lock,
        shared_sources=_shared_sources, primary=_single_source)
    play_lock = playback.play_lock
    currently_playing = playback.currently_playing
    current_source_name = playback.current_source_name
    current_play_request_id = playback.current_play_request_id
    play_asset = playback.play_asset
    play_asset_concurrent = playback.play_asset_concurrent
    stop_current_playback = playback.stop_current_playback
    stop_current_playing_source = playback.stop_current_playing_source
    cancel_all_playback = playback.cancel_all_playback


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


    random_mode = RandomMode(cfg.project_name, stop_event, stop_current_playback, active=random_active)
    stop_random_mode = random_mode.stop

    playlist = RandomPlaylist(cfg.project_name, stop_event, name_index,
        lambda: active_settings[0] or _load_runtime_settings(cfg), play_asset)
    random_loop = playlist.run

    def start_random_mode(category_query: str = "") -> None:
        random_mode.start(random_loop, category_query)

    def on_event(data: dict) -> None:
        if stop_event.is_set():
            return
        source = str(data.get("source", "")).lower().strip()
        if not source:
            return

        target = play_asset_concurrent if data.get("concurrent", False) else play_asset

        target(source)

    if cfg.event_name:
        hub_events.subscribe(cfg.event_name, on_event)

    def on_transcript(text: str) -> None:
        if manual_window.consume_suppression():
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
                name_index.replace(build_name_index(cfg, single_source_name=_single_source if _single_source_mode else None))
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

    def voice_complete(text):
        if text:
            return
        source = _paused_source_name[0]
        _paused_by_trigger[0] = None
        _paused_source_name[0] = None
        if source:
            obs.play_media(source)

    ptt = (
        VoicePTT(
            timeout=cfg.auto_record_timeout,
            on_transcript=on_transcript,
            on_complete=voice_complete,
            tag=cfg.project_name,
        )
        if voice_commands_enabled
        else None
    )

    manual_window = ManualTriggerWindow(stop_event)
    end_manual_window = manual_window.close

    def begin_trigger_window() -> None:
        if manual_hotkeys_enabled:
            manual_window.open(cfg.manual_trigger_window)
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
            name_index.replace(build_name_index(cfg, single_source_name=_single_source if _single_source_mode else None))
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


    def on_press(key) -> None:
        if stop_event.is_set():
            return
        char = key_token(key)

        if not char:
            return

        reload_runtime_profiles()

        for action, triggers_for_action in action_triggers.items():
            if any(t.register_key(char) for t in triggers_for_action):
                run_hotkey_action(run_interface_action, action)
                return

        manual_map = current_manual_map()
        if manual_hotkeys_enabled and manual_window.claim(char, manual_map):
            # Cancel voice and select the manual winner before the shared
            # keyboard dispatcher handles its next consumer.
            handle_manual_trigger(char, manual_map[char])
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
                request_id = current_play_request_id[0]

            _paused_by_trigger[0] = None  # clear any stale pause from a previous window
            _paused_source_name[0] = None
            mode = trigger_mode[0]

            if current is not None and current in name_index:
                with play_lock:
                    stop_src = current_source_name[0] or name_index[current][1]
                if mode == "abort":
                    run_hotkey_action(stop_current_playing_source, current, stop_src, request_id)
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
        run_cleanup(cfg.project_name, manual_window.close,
                    lambda: hub_events.unsubscribe(cfg.event_name, on_event) if cfg.event_name else None,
                    lambda: ptt.cancel("shutdown") if ptt is not None else None,
                    stop_random_mode, stop_current_playback, cancel_all_playback, hide_all_sources,
                    lambda: atexit.unregister(hide_all_sources),
                    lambda: unsubscribe_global_hotkeys(kb_token))
        print(f"[{cfg.project_name}] Stopped.")

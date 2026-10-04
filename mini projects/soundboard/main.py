from __future__ import annotations

import json
import queue
import random
import threading
import time
from pathlib import Path

import events as hub_events
from coordinator import coordinator
from lib.snapshots import SnapshotMap
from lib.shared_media.commands import _parse_runtime_command, _parse_trigger_sequences
from lib.global_hotkeys import key_token, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from lib.runtime_cleanup import run_cleanup
from lib.shared_media.trigger_window import ManualTriggerWindow
from lib.shared_media.random_mode import RandomMode
from lib.shared_media.random_playlist import RandomPlaylist
from lib.project_settings import load_project_settings
from lib.shared_media.runtime_profiles import RuntimeProfiles
from lib.shared_media.controls import action_catalog, asset_volume_db
from lib.shared_media.media_phrase_matcher import match_phrase
from shared import SequenceTrigger, VoicePTT

from .config import CONFIG
from .player import SINGLE_SOURCE_NAME, SoundboardPlayer

_TAG = f"[{CONFIG.project_name}]"
_HERE = Path(__file__).resolve().parent
_HUB_SETTINGS_FILE = _HERE.parent.parent / "hub_settings.json"
_live: dict = {}


def _read_hub_trigger_mode() -> str:
    try:
        data = json.loads(_HUB_SETTINGS_FILE.read_text(encoding="utf-8"))
        modes = data.get("project_trigger_modes") or {}
        mode = modes.get(CONFIG.project_name, "abort")
        return mode if mode in ("abort", "pause", "keep_playing") else "abort"
    except Exception:
        return "abort"


def _load_runtime_settings(profile: str | None = None):
    try:
        return load_project_settings(
            _HERE,
            hotkeys_file=_HERE / "hotkeys.json",
            asset_dir=CONFIG.asset_dir,
            valid_extensions=CONFIG.valid_extensions,
            profile=profile,
        )
    except Exception:
        return None


def _build_name_index() -> dict[str, Path]:
    index: dict[str, Path] = {}
    if not CONFIG.asset_dir.is_dir():
        print(f"{_TAG} Assets dir not found: {CONFIG.asset_dir}")
        return index
    for path in CONFIG.asset_dir.iterdir():
        if path.is_file() and path.suffix.lower() in CONFIG.valid_extensions:
            index[path.stem.lower()] = path
    return index


def _match_category_name(query: str, categories: list[str]) -> str | None:
    if not query or not categories:
        return None
    lowered = query.strip().lower()
    for category in categories:
        if category.lower() == lowered:
            return category
    return None




def run(
    input_queue: queue.Queue,
    stop_event: threading.Event,
    *,
    startup_event: threading.Event | None = None,
) -> None:
    player = SoundboardPlayer()

    triggers = [SequenceTrigger(seq, CONFIG.trigger_max_interval) for seq in CONFIG.trigger_sequences]
    trigger_mode = [_read_hub_trigger_mode()]
    profiles = RuntimeProfiles(CONFIG, _HERE, loader=_load_runtime_settings)
    active_settings = profiles.active_settings
    active_profile_name = profiles.active_profile_name
    profile_triggers = profiles.profile_triggers
    action_triggers = profiles.action_triggers
    name_index = SnapshotMap(_build_name_index())
    from lib.asset_preparation import preparation
    preparation.register(name_index.values())
    play_request_id = [0]
    intent_lock = threading.RLock()
    paused_for_trigger = [False]

    random_lock = threading.Lock()
    random_active = [False]

    manual_window = ManualTriggerWindow(stop_event)

    _live["player"] = player
    _live["rand_active"] = random_active

    activate_profile = profiles.activate
    activate_live_profile = profiles.activate_live
    current_manual_map = profiles.manual_map

    def reload_runtime_profiles(force: bool = False) -> None:
        if profiles.reload(force=force):
            trigger_mode[0] = _read_hub_trigger_mode()
            print(f"{_TAG} Profiles reloaded live.")

    reload_runtime_profiles(force=True)

    def source_volume_for(stem: str) -> float:
        return asset_volume_db(CONFIG, active_settings[0], stem)


    def volume_state() -> dict:
        settings = active_settings[0]
        current_stem = player.current_stem or player.loaded_browser_stem
        return {
            "project_volume_db": CONFIG.project_volume_db + (settings.project_volume_db if settings else 0.0),
            "profile_volume_db": CONFIG.profile_volume_db + (settings.profile_volume_db if settings else 0.0),
            "profile": active_profile_name[0],
            "current_stem": current_stem,
            "source_name": player.current_source or (player.browser_source if player.loaded_browser_stem else None),
        }

    end_manual_window = manual_window.close

    def begin_trigger_window() -> None:
        manual_window.open(CONFIG.manual_trigger_window)
        if ptt is not None:
            ptt.on_trigger()

    def invalidate_play_requests() -> None:
        with intent_lock:
            play_request_id[0] += 1

    def stop_current_playback() -> None:
        with intent_lock:
            invalidate_play_requests()
            if player.is_busy:
                print(f"{_TAG} Stopping '{SINGLE_SOURCE_NAME}'.")
                player.abort()
            coordinator.cancel(CONFIG.project_name)

    playlist = RandomPlaylist(CONFIG.project_name, stop_event, name_index,
        lambda: active_settings[0] or _load_runtime_settings(), lambda stem: play_asset(stem),
        match_category=_match_category_name)
    random_loop = playlist.run

    random_mode = RandomMode(CONFIG.project_name, stop_event, stop_current_playback, active=random_active)
    stop_random_mode = random_mode.stop

    def start_random_mode(category_query: str = "") -> None:
        random_mode.start(random_loop, category_query)

    _live["stop_random"] = stop_random_mode

    def play_asset(name: str) -> None:
        with intent_lock:
            stem = str(name or "").strip().lower()
            filepath = name_index.get(stem)
            if filepath is None:
                known = ", ".join(sorted(name_index)) or "(none)"
                print(f"{_TAG} No match for '{stem}'. Known: {known}")
                return

            invalidate_play_requests()
            request_id = play_request_id[0]

            def _do_play(ticket) -> None:
                with intent_lock:
                    if play_request_id[0] != request_id or ticket.cancelled.is_set() or stop_event.is_set():
                        return False

                    settings = active_settings[0]
                    categories = list(settings.sound_categories.get(stem, ())) if settings else []
                    volume_db = source_volume_for(stem)

                    player.play_async(
                        stem=stem,
                        filepath=filepath,
                        volume_db=volume_db,
                        categories=categories,
                        on_finish=ticket.finish,
                        allowed=ticket.allowed.is_set,
                        wait_for_turn=lambda cancel: ticket.wait_until_allowed(
                            cancelled=lambda: cancel.is_set() or stop_event.is_set()),
                    )

            return coordinator.request(CONFIG.project_name, on_ready=_do_play).done

    def on_event(data: dict) -> None:
        source = str(data.get("source", "")).strip().lower()
        if source:
            play_asset(source)

    if CONFIG.event_name:
        hub_events.subscribe(CONFIG.event_name, on_event)

    def on_transcript(text: str) -> None:
        if manual_window.consume_suppression():
            print(f"{_TAG} Voice transcript suppressed (manual hotkey was used).")
            return
        if not text or not text.strip():
            print(f"{_TAG} Empty transcription.")
            if paused_for_trigger[0]:
                paused_for_trigger[0] = False
                player.resume()
            return

        command = _parse_runtime_command(text)
        if command and CONFIG.random_commands_enabled:
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
                    print(f"{_TAG} 'next' only applies while random mode is running.")
                return
            if action == "stop":
                stop_random_mode()
                stop_current_playback()
                return
            if action == "reload":
                name_index.replace(_build_name_index())
                reload_runtime_profiles(force=True)
                print(f"{_TAG} Reloaded {len(name_index)} asset(s).")
                return

        matched = match_phrase(
            text,
            list(name_index.keys()),
            phrases_file=CONFIG.phrases_file,
            fuzzy_threshold=CONFIG.fuzzy_threshold,
            semantic_gap=CONFIG.semantic_gap,
            matching_strategy=CONFIG.matching_strategy,
            fuzzy_scorer=CONFIG.fuzzy_scorer,
            fuzzy_weight=CONFIG.fuzzy_weight,
            token_weight=CONFIG.token_weight,
            embedding_weight=CONFIG.embedding_weight,
            embedding_model=CONFIG.embedding_model,
            verbose=CONFIG.verbose_matcher,
        )
        if matched is None:
            if paused_for_trigger[0]:
                paused_for_trigger[0] = False
                player.resume()
                print(f"{_TAG} No match - resuming paused playback.")
            return

        paused_for_trigger[0] = False
        play_asset(matched)

    ptt = VoicePTT(
        timeout=CONFIG.auto_record_timeout,
        on_transcript=on_transcript,
        on_complete=lambda text: on_transcript("") if not text else None,
        tag=CONFIG.project_name,
    ) if CONFIG.voice_commands_enabled else None

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
                ptt.cancel(f"{CONFIG.project_name} abort listen")
            end_manual_window()
        elif action == "pause":
            player.pause()
        elif action == "resume":
            player.resume()
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
            name_index.replace(_build_name_index())
            reload_runtime_profiles(force=True)
        elif action == "test_muffins":
            threading.Thread(target=play_asset, args=('die die die',), daemon=True,
                             name='soundboard-muffin-test').start()
        else:
            return {"ok": False, "error": f"Unsupported media action: {action}"}
        return {"ok": True, "action": action, "message": f"{CONFIG.project_name}: {action} ran."}

    _live["run_action"] = run_interface_action
    _live["volume_state"] = volume_state
    _live["action_catalog"] = lambda: action_catalog() + [
        {'key':'test_muffins', 'label':'Test Muffin Dance',
         'description':'Play Ctrl+6’s muffin song with animated screen borders.'}]

    from .desk import AssetControls
    desk_controls = AssetControls(name_index, stop_event,
        cancel_voice=lambda: ptt.cancel('soundboard desk selection') if ptt else None,
        close_window=end_manual_window, stop_random=stop_random_mode, play=play_asset)

    def handle_manual_trigger(char: str, clip_value) -> None:
        if ptt is not None:
            ptt.cancel(f"{CONFIG.project_name} manual key pressed")
        if isinstance(clip_value, list):
            stem = random.choice(clip_value).lower() if clip_value else ""
        else:
            stem = str(clip_value or "").lower()
        if not stem:
            print(f"{_TAG} trigger+{char} is not configured.")
            return
        # Keep OBS/coordinator waits off the shared hotkey dispatch thread.
        threading.Thread(target=play_asset, args=(stem,), daemon=True,
                         name="soundboard-manual-play").start()

    def on_press(key) -> None:
        char = key_token(key)
        if not char:
            return

        reload_runtime_profiles()

        for action, triggers_for_action in action_triggers.items():
            if any(trigger.register_key(char) for trigger in triggers_for_action):
                threading.Thread(
                    target=run_interface_action,
                    args=(action,),
                    daemon=True,
                ).start()
                return

        manual_map = current_manual_map()
        if manual_window.claim(char, manual_map):
            # Cancel voice and select the manual winner before the shared
            # keyboard dispatcher handles its next consumer.
            handle_manual_trigger(char, manual_map[char])
            return

        for profile_name, profile_seq_triggers in profile_triggers.items():
            if any(trigger.register_key(char) for trigger in profile_seq_triggers):
                if activate_profile(profile_name):
                    begin_trigger_window()
                return

        if any(trigger.register_key(char) for trigger in triggers):
            activate_live_profile()
            if ptt is not None and ptt.is_recording:
                ptt.on_trigger()
                return

            paused_for_trigger[0] = False
            mode = trigger_mode[0]
            current = player.current_stem

            if current is not None:
                if mode == "abort":
                    player.abort()
                    if not bool(CONFIG.features.get("trigger_restarts_listen", False)):
                        return
                elif mode == "pause":
                    player.pause()
                    paused_for_trigger[0] = True
                    print(f"{_TAG} Trigger while playing - paused '{SINGLE_SOURCE_NAME}'. Speak to swap or stay silent to resume.")
                elif mode == "keep_playing":
                    print(f"{_TAG} Trigger while playing - keeping '{SINGLE_SOURCE_NAME}' running. Speak to swap.")

            begin_trigger_window()

    kb_token = subscribe_global_hotkeys(on_press)

    manual_keys = "".join(current_manual_map().keys())
    trigger_labels = " / ".join("".join(seq) for seq in CONFIG.trigger_sequences)
    print(
        f"{_TAG} Armed - press {trigger_labels} quickly, "
        f"then speak or press [{manual_keys}] for a direct asset."
    )

    try:
        _live['asset_catalog'] = desk_controls.catalog
        _live['play_asset'] = desk_controls.select
        if startup_event is not None:
            startup_event.set()
        while not stop_event.is_set():
            try:
                input_queue.get(timeout=0.5)
            except queue.Empty:
                continue
    finally:
        _live.pop('asset_catalog', None)
        _live.pop('play_asset', None)
        run_cleanup(CONFIG.project_name, manual_window.close,
                    lambda: hub_events.unsubscribe(CONFIG.event_name, on_event) if CONFIG.event_name else None,
                    lambda: ptt.cancel("shutdown") if ptt is not None else None,
                    stop_random_mode, stop_current_playback,
                    lambda: unsubscribe_global_hotkeys(kb_token))
        print(f"{_TAG} Stopped.")

from __future__ import annotations

import json
import queue
import random
import threading
from pathlib import Path

import events as hub_events
from coordinator import coordinator
from lib.global_hotkeys import key_token, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from lib.project_settings import load_project_profile_summaries, load_project_settings
from lib.shared_media.controls import action_catalog, effective_volume_db, normalize_interface_hotkeys, parse_sequences
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


def _parse_runtime_command(text: str) -> tuple[str, str] | None:
    normalized = " ".join(str(text or "").lower().strip().split())
    if not normalized:
        return None
    aliases = {
        "random": ("random", "shuffle", "play random", "start random"),
        "next": ("next", "skip", "skip it", "next one", "next clip"),
        "stop": ("stop", "stop it", "abort", "cancel"),
        "reload": ("reload", "refresh", "reload media", "refresh media"),
    }
    for command, values in aliases.items():
        for alias in values:
            if normalized == alias:
                return command, ""
            if command == "random" and normalized.startswith(alias + " "):
                return command, normalized[len(alias):].strip()
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
    active_settings = [_load_runtime_settings()]
    active_profile_name = [active_settings[0].profile_name if active_settings[0] else "default"]
    profile_triggers: dict[str, list[SequenceTrigger]] = {}
    action_triggers: dict[str, list[SequenceTrigger]] = {}
    name_index = _build_name_index()
    profiles_stamp = [-1.0]
    play_request_id = [0]
    voice_suppressed = [False]
    paused_for_trigger = [False]

    random_lock = threading.Lock()
    random_active = [False]
    random_stop_event = threading.Event()
    random_thread: list[threading.Thread | None] = [None]
    random_played: set[str] = set()

    manual_lock = threading.Lock()
    in_manual_window = [False]
    pending_voice_timer: list[threading.Timer | None] = [None]

    _live["player"] = player
    _live["rand_active"] = random_active

    def profile_files_stamp() -> float:
        stamp = 0.0
        for path in (_HERE / "hotkeys.json", _HERE / "hotkeys_editor.json"):
            try:
                stamp = max(stamp, path.stat().st_mtime)
            except OSError:
                pass
        return stamp

    def refresh_profile_triggers() -> None:
        profile_triggers.clear()
        for profile in load_project_profile_summaries(_HERE, hotkeys_file=_HERE / "hotkeys.json"):
            profile_name = str(profile.get("name") or "")
            sequences = parse_sequences(str(profile.get("trigger_sequences") or ""))
            if profile_name and sequences:
                profile_triggers[profile_name] = [
                    SequenceTrigger(seq, CONFIG.trigger_max_interval)
                    for seq in sequences
                ]

    def activate_profile(profile_name: str) -> bool:
        settings = _load_runtime_settings(profile_name)
        if settings is None or settings.profile_name != profile_name:
            return False
        active_settings[0] = settings
        active_profile_name[0] = settings.profile_name
        print(f"{_TAG} Profile armed: {settings.profile_name}")
        return True

    def activate_live_profile() -> bool:
        settings = _load_runtime_settings()
        active_settings[0] = settings
        active_profile_name[0] = settings.profile_name if settings else "default"
        return True

    def current_manual_map() -> dict[str, str | list[str]]:
        settings = active_settings[0]
        return dict(settings.hotkeys) if settings is not None else dict(CONFIG.manual_trigger_map)

    def current_interface_hotkeys() -> dict[str, str]:
        merged = normalize_interface_hotkeys(CONFIG.interface_hotkeys)
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
                    SequenceTrigger(seq, CONFIG.trigger_max_interval)
                    for seq in sequences
                ]

    def reload_runtime_profiles(force: bool = False) -> None:
        stamp = profile_files_stamp()
        if not force and stamp == profiles_stamp[0]:
            return
        profiles_stamp[0] = stamp
        refresh_profile_triggers()
        if not activate_profile(active_profile_name[0]):
            activate_live_profile()
        refresh_action_triggers()
        trigger_mode[0] = _read_hub_trigger_mode()
        print(f"{_TAG} Profiles reloaded live.")

    reload_runtime_profiles(force=True)

    def source_volume_for(stem: str) -> float:
        settings = active_settings[0]
        settings_project_db = settings.project_volume_db if settings else 0.0
        settings_profile_db = settings.profile_volume_db if settings else 0.0
        settings_file_db = settings.file_volume_offsets.get(stem, 0.0) if settings else 0.0
        cfg_file_db = CONFIG.file_volume_offsets.get(stem, 0.0)
        category_db = 0.0
        if settings is not None:
            categories = list(settings.sound_categories.get(stem, ()))
            if categories:
                category_db = settings.category_volume_db.get(categories[0], 0.0)
        return effective_volume_db(
            project_volume_db=CONFIG.project_volume_db + settings_project_db,
            profile_volume_db=CONFIG.profile_volume_db + settings_profile_db,
            category_offset_db=category_db,
            file_offset_db=cfg_file_db + settings_file_db,
        )

    def volume_state() -> dict:
        settings = active_settings[0]
        current_stem = player.current_stem
        return {
            "project_volume_db": CONFIG.project_volume_db + (settings.project_volume_db if settings else 0.0),
            "profile_volume_db": CONFIG.profile_volume_db + (settings.profile_volume_db if settings else 0.0),
            "profile": active_profile_name[0],
            "current_stem": current_stem,
            "source_name": SINGLE_SOURCE_NAME if current_stem else None,
        }

    def end_manual_window() -> None:
        with manual_lock:
            in_manual_window[0] = False
            pending_voice_timer[0] = None

    def begin_trigger_window() -> None:
        voice_suppressed[0] = False
        with manual_lock:
            in_manual_window[0] = True
            if pending_voice_timer[0] is not None:
                pending_voice_timer[0].cancel()
            timer = threading.Timer(CONFIG.manual_trigger_window, end_manual_window)
            pending_voice_timer[0] = timer
            timer.start()
        if ptt is not None:
            ptt.on_trigger()

    def invalidate_play_requests() -> None:
        play_request_id[0] += 1

    def stop_current_playback() -> None:
        invalidate_play_requests()
        if player.is_busy:
            print(f"{_TAG} Stopping '{SINGLE_SOURCE_NAME}'.")
            player.abort()

    def eligible_random_stems(category_query: str = "") -> list[str]:
        stems = sorted(name_index.keys())
        if not category_query:
            return stems
        settings = active_settings[0] or _load_runtime_settings()
        if settings is None:
            return stems
        category = _match_category_name(category_query, list(settings.categories))
        if not category:
            print(f"{_TAG} Unknown category '{category_query}'.")
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
                print(f"{_TAG} Random mode has no eligible media.")
                return
            print(f"{_TAG} Random mode started ({len(stems)} asset(s)).")
            while not stop_event.is_set() and not random_stop_event.is_set():
                choice = pick_random_stem(stems)
                if not choice:
                    return
                play_asset(choice)
                while not stop_event.is_set() and not random_stop_event.is_set():
                    if not player.is_busy:
                        break
                    threading.Event().wait(0.2)
        finally:
            with random_lock:
                random_active[0] = False
            print(f"{_TAG} Random loop exited.")

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
        print(f"{_TAG} Random mode stopped.")

    def start_random_mode(category_query: str = "") -> None:
        stop_random_mode()
        thread = threading.Thread(
            target=random_loop,
            args=(category_query,),
            daemon=True,
            name=f"{CONFIG.project_name}:random",
        )
        random_thread[0] = thread
        thread.start()

    _live["stop_random"] = stop_random_mode

    def play_asset(name: str) -> None:
        stem = str(name or "").strip().lower()
        filepath = name_index.get(stem)
        if filepath is None:
            known = ", ".join(sorted(name_index)) or "(none)"
            print(f"{_TAG} No match for '{stem}'. Known: {known}")
            return

        invalidate_play_requests()
        request_id = play_request_id[0]

        if player.is_busy:
            print(f"{_TAG} Trigger while playing - stopping '{SINGLE_SOURCE_NAME}'.")
            player.abort()

        def _do_play() -> None:
            if play_request_id[0] != request_id:
                coordinator.announce_finished(CONFIG.project_name)
                return

            settings = active_settings[0]
            categories = list(settings.sound_categories.get(stem, ())) if settings else []
            volume_db = source_volume_for(stem)

            def _on_finish() -> None:
                coordinator.announce_finished(CONFIG.project_name)

            player.play_async(
                stem=stem,
                filepath=filepath,
                volume_db=volume_db,
                categories=categories,
                on_finish=_on_finish,
            )

        coordinator.request_to_play(CONFIG.project_name, on_ready=_do_play)

    def on_event(data: dict) -> None:
        source = str(data.get("source", "")).strip().lower()
        if source:
            play_asset(source)

    if CONFIG.event_name:
        hub_events.subscribe(CONFIG.event_name, on_event)

    def on_transcript(text: str) -> None:
        if voice_suppressed[0]:
            voice_suppressed[0] = False
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
                name_index.clear()
                name_index.update(_build_name_index())
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
            name_index.clear()
            name_index.update(_build_name_index())
            reload_runtime_profiles(force=True)
        else:
            return {"ok": False, "error": f"Unsupported media action: {action}"}
        return {"ok": True, "action": action, "message": f"{CONFIG.project_name}: {action} ran."}

    _live["run_action"] = run_interface_action
    _live["volume_state"] = volume_state
    _live["action_catalog"] = action_catalog

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
        play_asset(stem)

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

        with manual_lock:
            manual_map = current_manual_map()
            if in_manual_window[0] and char in manual_map:
                in_manual_window[0] = False
                if pending_voice_timer[0] is not None:
                    pending_voice_timer[0].cancel()
                    pending_voice_timer[0] = None
                voice_suppressed[0] = True
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

    if startup_event is not None:
        startup_event.set()

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
        if CONFIG.event_name:
            hub_events.unsubscribe(CONFIG.event_name, on_event)
        if ptt is not None:
            ptt.cancel("shutdown")
        stop_random_mode()
        stop_current_playback()
        unsubscribe_global_hotkeys(kb_token)
        print(f"{_TAG} Stopped.")

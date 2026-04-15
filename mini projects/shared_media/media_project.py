from __future__ import annotations

import atexit
import queue
import threading

from pynput import keyboard

import obs
import events as hub_events
from shared import SequenceTrigger, VoicePTT
from coordinator import coordinator

from .media_config import MediaProjectConfig
from .media_phrase_matcher import match_phrase


def build_name_index(cfg: MediaProjectConfig) -> dict[str, tuple[Path, str]]:
    """
    Scan asset_dir and return:
        {lower_stem: (filepath, obs_source_name)}
    OBS source names are built without the file extension.
    """
    index: dict[str, tuple[Path, str]] = {}

    if not cfg.asset_dir.is_dir():
        print(f"[{cfg.project_name}] Assets dir not found: {cfg.asset_dir}")
        return index

    for p in cfg.asset_dir.iterdir():
        if p.is_file() and p.suffix.lower() in cfg.valid_extensions:
            index[p.stem.lower()] = (p, f"{cfg.obs_source_prefix}{p.stem}")

    return index


def create_project_interface(
    *,
    project_name: str,
    controlled_scenes: list[str],
    live_state: dict,
):
    from shared import ProjectInterface, ProjectStatus, project_registry

    class _GenericMediaInterface(ProjectInterface):
        name = project_name
        controlled_scenes = controlled_scenes

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

    interface = _GenericMediaInterface()
    project_registry.register(interface)
    return interface


def run_media_project(
    *,
    cfg: MediaProjectConfig,
    input_queue: queue.Queue,
    stop_event: threading.Event,
    live_state: dict,
) -> None:
    visible_sources: set[str] = set()
    visible_lock = threading.Lock()
    play_lock = threading.Lock()
    currently_playing: list[str | None] = [None]
    triggers = [SequenceTrigger(seq, cfg.trigger_max_interval) for seq in cfg.trigger_sequences]

    print(f"[{cfg.project_name}] Syncing sources to files…")
    obs.sync_assets(
        scene=cfg.scene,
        asset_dir=cfg.asset_dir,
        prefix=cfg.obs_source_prefix,
        monitor=obs.MONITOR_ONLY,
    )

    name_index = build_name_index(cfg)
    print(f"[{cfg.project_name}] {len(name_index)} asset(s) loaded.")

    def hide_all_sources() -> None:
        with visible_lock:
            to_hide = set(visible_sources)
            visible_sources.clear()

        for name in to_hide:
            try:
                obs.hide_source(cfg.scene, name)
            except Exception:
                pass

    atexit.register(hide_all_sources)
    live_state["visible_sources"] = visible_sources
    live_state["hide_all"] = hide_all_sources

    def play_asset(name: str) -> None:
        entry = name_index.get(name)
        if entry is None:
            known = list(name_index.keys())
            print(
                f"[{cfg.project_name}] No match for '{name}'. "
                f"Known: {', '.join(known) or '(none)'}"
            )
            return

        filepath, source_name = entry

        # Claim the play slot and stop whatever was already playing in this
        # project.  This happens immediately so back-to-back triggers don't
        # queue up; the coordinator handles pausing OTHER projects.
        with play_lock:
            prev = currently_playing[0]
            if prev and prev in name_index:
                old_src = name_index[prev][1]
                obs.stop_media(old_src)
            currently_playing[0] = name

        # The actual OBS play runs after the coordinator has paused any
        # conflicting projects (per hub_rules.py).  coordinator.request_to_play
        # is non-blocking — it spawns a daemon thread that calls _do_play once
        # all required pauses have been acknowledged.
        def _do_play() -> None:
            print(f"[{cfg.project_name}] Playing: '{source_name}'")

            with visible_lock:
                visible_sources.add(source_name)

            try:
                obs.set_media_source_file(source_name, filepath)
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
                with play_lock:
                    still_current = currently_playing[0] == name

                if still_current:
                    obs.hide_source(cfg.scene, source_name)
                    with visible_lock:
                        visible_sources.discard(source_name)

                with play_lock:
                    if currently_playing[0] == name:
                        currently_playing[0] = None

                # Announce completion so the coordinator can resume any
                # projects it paused on our behalf.
                coordinator.announce_finished(cfg.project_name)

        coordinator.request_to_play(cfg.project_name, on_ready=_do_play)

    def play_asset_concurrent(name: str) -> None:
        entry = name_index.get(name)
        if entry is None:
            print(f"[{cfg.project_name}] Concurrent: no match for '{name}'.")
            return

        filepath, source_name = entry
        print(f"[{cfg.project_name}] Playing (concurrent): '{source_name}'")

        with visible_lock:
            visible_sources.add(source_name)

        try:
            obs.set_media_source_file(source_name, filepath)
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
            obs.hide_source(cfg.scene, source_name)
            with visible_lock:
                visible_sources.discard(source_name)

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

    hub_events.subscribe(cfg.event_name, on_event)

    def on_transcript(text: str) -> None:
        if not text or not text.strip():
            print(f"[{cfg.project_name}] Empty transcription.")
            return

        matched = match_phrase(
            text,
            list(name_index.keys()),
            phrases_file=cfg.phrases_file,
            fuzzy_threshold=cfg.fuzzy_threshold,
            semantic_gap=cfg.semantic_gap,
            verbose=cfg.verbose_matcher,
        )
        if matched is None:
            return

        play_asset(matched)

    ptt = VoicePTT(
        timeout=cfg.auto_record_timeout,
        on_transcript=on_transcript,
        tag=cfg.project_name,
    )

    manual_lock = threading.Lock()
    in_manual_window = [False]
    pending_voice_timer: list[threading.Timer | None] = [None]

    def end_manual_window() -> None:
        with manual_lock:
            in_manual_window[0] = False
            pending_voice_timer[0] = None

    def on_press(key) -> None:
        try:
            char = key.char
        except AttributeError:
            return

        if not char:
            return

        with manual_lock:
            if in_manual_window[0] and char in cfg.manual_trigger_map:
                in_manual_window[0] = False

                if pending_voice_timer[0] is not None:
                    pending_voice_timer[0].cancel()
                    pending_voice_timer[0] = None

                clip_name = cfg.manual_trigger_map[char]
                ptt.cancel(f"{cfg.project_name} manual key pressed")

                if clip_name:
                    threading.Thread(
                        target=play_asset,
                        args=(clip_name.lower(),),
                        daemon=True,
                    ).start()
                else:
                    print(f"[{cfg.project_name}] trigger+{char} is not configured — set it in config.py.")
                return

        if any(t.register_key(char) for t in triggers):
            if ptt.is_recording:
                ptt.on_trigger()
                return

            with play_lock:
                current = currently_playing[0]

            if current is not None and current in name_index:
                stop_src = name_index[current][1]
                print(f"[{cfg.project_name}] Trigger while playing — stopping '{stop_src}'.")
                obs.stop_media(stop_src)
                obs.hide_source(cfg.scene, stop_src)

                with play_lock:
                    if currently_playing[0] == current:
                        currently_playing[0] = None

                with visible_lock:
                    visible_sources.discard(stop_src)
                return

            with manual_lock:
                in_manual_window[0] = True
                if pending_voice_timer[0] is not None:
                    pending_voice_timer[0].cancel()
                timer = threading.Timer(cfg.manual_trigger_window, end_manual_window)
                pending_voice_timer[0] = timer
                timer.start()

            ptt.on_trigger()

    kb = keyboard.Listener(on_press=on_press)
    kb.start()

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

        hub_events.unsubscribe(cfg.event_name, on_event)
        ptt.cancel("shutdown")
        kb.stop()
        print(f"[{cfg.project_name}] Stopped.")
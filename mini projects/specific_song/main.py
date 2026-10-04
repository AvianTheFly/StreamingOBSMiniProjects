"""
specific_song/main.py
=====================
On-demand specific-song player. Triggered by the "ili" key sequence.
Plugs into the hub — no hub-level routing needed.

Hotkey behaviour
----------------
  i → l → i   (all within TRIGGER_MAX_INTERVAL seconds)

  When idle:
    Press "ili" → open mic, start recording

  When a song is playing:
    Press "ili" → stop song, hide source, open mic, start recording

  While listening:
    Press "ili" again → stop recording and send transcript immediately

  Recording also auto-sends after 2 seconds of silence.
  Pressing 'C' also force-sends immediately.

  Song finishes naturally → source hidden automatically, player goes idle.
"""

from __future__ import annotations

import json
import queue
import sys
import threading
import time
import random
from pathlib import Path

from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from lib.runtime_cleanup import run_cleanup
from lib.shared_media.trigger_window import ManualTriggerWindow
from lib.shared_media.random_mode import RandomMode
from .config import (
    TRIGGER_SEQUENCE,
    TRIGGER_MAX_INTERVAL,
    RECORD_TIMEOUT_SECONDS,
    MATCH_THRESHOLD,
    ASSETS_DIR,
    OBS_SOURCE_PREFIX,
    SONGS_JSON,
    MANUAL_TRIGGER_SONGS,
    MANUAL_TRIGGER_WINDOW,
)
from .trigger import SequenceTrigger
from .matcher import find_best_match, rank_matches
from .player import SongPlayer
from .commands import parse_command as _parse_command, match_category as _match_category
from .library import load_library, load_categories, load_manual_triggers
from .full_sync import apply as apply_full_sync

from shared import music_service

_HERE = Path(__file__).resolve().parent
_TAG = "[specific_song]"
_HUB_SETTINGS_FILE = _HERE.parent.parent / "hub_settings.json"


def _get_trigger_mode() -> str:
    try:
        data = json.loads(_HUB_SETTINGS_FILE.read_text(encoding="utf-8"))
        modes = data.get("project_trigger_modes") or {}
        mode = modes.get("specific_song", "abort")
        return mode if mode in ("abort", "pause", "keep_playing") else "abort"
    except Exception:
        return "abort"
_SYNC_MEDIA_EXTS = (".mp4", ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".webm")

def _sync_assets_to_library() -> None:
    """Startup sync: assets dir is the source of truth for songs.json + OBS."""
    if not ASSETS_DIR.exists():
        print(f"{_TAG} ⚠  Songs asset dir not found — skipping startup sync: {ASSETS_DIR}")
        return

    media_files = sorted(
        p for p in ASSETS_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in _SYNC_MEDIA_EXTS
    )
    from lib.asset_preparation import preparation
    preparation.register(media_files)
    print(f"{_TAG} 🔄  Startup sync from assets dir ({len(media_files)} media files)...")
    try:
        apply_full_sync(media_files)
    except Exception as exc:
        print(f"{_TAG} ❌  Startup sync failed: {exc}")


def run(
    input_queue: queue.Queue,
    stop_event: threading.Event,
    *,
    startup_event: threading.Event | None = None,
) -> None:
    """Called by the hub in a dedicated daemon thread."""

    trigger = SequenceTrigger(TRIGGER_SEQUENCE, TRIGGER_MAX_INTERVAL)

    _sync_assets_to_library()

    player = SongPlayer()
    music_service.register(player)

    # One cancellation event per random session; stopped events stay stopped.
    _rand_lock = threading.Lock()
    random_mode = RandomMode("specific_song", stop_event, player.abort)
    _rand_active = random_mode.active
    _played_indices: list[set] = [set()]
    _stop_random_mode = random_mode.stop

    def _pick_next_random(lib: list[dict]) -> dict:
        with _rand_lock:
            played = _played_indices[0]
            remaining = [i for i in range(len(lib)) if i not in played]
            if not remaining:
                played.clear()
                remaining = list(range(len(lib)))
            idx = random.choice(remaining)
            played.add(idx)
            return lib[idx]

    def _run_random_loop(lib: list[dict], *, cancelled: threading.Event) -> None:
        with _rand_lock:
            _played_indices[0].clear()
        print(f"{_TAG} Random mode started ({len(lib)} songs).")
        while not cancelled.is_set() and not stop_event.is_set():
            started = time.monotonic()
            song = _pick_next_random(lib)
            source = OBS_SOURCE_PREFIX + song["source"]
            print(f"{_TAG} Random pick: '{song['name']}'")
            done = player.play_async(source)
            while not cancelled.is_set() and not stop_event.is_set():
                if done.wait(.2):
                    break
            # Failed/missing media can complete immediately. Bound retries
            # while allowing long songs to advance without an added delay.
            cancelled.wait(max(0, .1 - (time.monotonic() - started)))
        print(f"{_TAG} Random loop exited.")

    def _start_random_mode(category: str | None = None) -> None:
        if stop_event.is_set():
            return
        if not library:
            print(f"{_TAG} Library empty — cannot start random mode.")
            return
        lib = library
        if category:
            cat_name = _match_category(category, categories)
            if cat_name is None:
                available = ", ".join(sorted(categories)) or "(none)"
                print(f"{_TAG} Unknown category '{category}'. Available: {available}")
                return
            cat_ids = set(categories[cat_name])
            lib = [song for song in library if song["id"] in cat_ids]
            if not lib:
                print(f"{_TAG} Category '{cat_name}' has no songs in the current library.")
                return
        lib = [song for song in lib if song.get("source")]
        if not lib:
            print(f"{_TAG} No playable songs in this selection.")
            return
        _stop_random_mode()
        player.abort()
        random_mode.start(_run_random_loop, lib)

    from .interface import _live
    _live["player"] = player
    _live["rand_active"] = _rand_active
    _live["stop_random"] = _stop_random_mode

    seq_str = "".join(TRIGGER_SEQUENCE)

    def _load_library():
        return load_library(SONGS_JSON, _HERE)

    library = _load_library()

    def _load_categories():
        return load_categories(_HERE)

    categories: dict[str, list[str]] = _load_categories()

    def _load_manual_triggers():
        return load_manual_triggers(_HERE, MANUAL_TRIGGER_SONGS)

    # Mutable container so _trigger_reload and _on_kb_press share one reference
    _manual_triggers_ref: list[dict[str, str]] = [_load_manual_triggers()]

    def _trigger_reload() -> None:
        nonlocal library
        library = _load_library()
        categories.clear()
        categories.update(_load_categories())
        _manual_triggers_ref[0] = _load_manual_triggers()

    _live["start_random"] = _start_random_mode
    _live["reload"]       = _trigger_reload

    from voice.ptt import VoicePTT
    _paused_for_trigger = [False]

    def _send_to_queue(text):
        if text and text.strip():
            input_queue.put(text.strip())

    def _voice_complete(text):
        if not text and _paused_for_trigger[0]:
            _paused_for_trigger[0] = False
            player.resume()

    ptt = VoicePTT(min(2.0, RECORD_TIMEOUT_SECONDS), _send_to_queue,
                   tag="specific_song", on_complete=_voice_complete)
    _do_send = ptt.stop

    def _start_listening() -> None:
        with _rand_lock:
            in_random = _rand_active[0]
        _paused_for_trigger[0] = False
        mode = _get_trigger_mode()
        if not in_random and player.is_busy:
            if mode == "abort":
                player.abort()
                print(f"{_TAG} ⏹  Song stopped — opening mic.")
            elif mode == "pause":
                player.pause()
                _paused_for_trigger[0] = True
                print(f"{_TAG} ⏸  Song paused — opening mic. Speak to swap, stay silent to resume.")
            elif mode == "keep_playing":
                print(f"{_TAG} 🎤  Song still playing — opening mic. Speak to swap.")

        if not ptt.begin():
            if _paused_for_trigger[0]:
                _paused_for_trigger[0] = False
                player.resume()
            return

        print(f"{_TAG} 🎤  Listening… (auto-sends after 2s, or press trigger again / 'C' to send)")

    # ── Manual trigger window state ───────────────────────────────────────────
    manual_window = ManualTriggerWindow(stop_event)

    def _on_trigger() -> None:
        if ptt.is_recording:
            _do_send()
            manual_window.close()
            return
        _start_listening()
        manual_window.open(MANUAL_TRIGGER_WINDOW)

    def _stop_and_send():
        ptt.stop()

    def _discard_recording():
        ptt.cancel("direct command")

    def _release_recording_if_active(*, send):
        if send:
            ptt.stop()
        else:
            ptt.cancel("command or shutdown")

    def _run_hotkey_action(fn, *args) -> None:
        threading.Thread(target=fn, args=args, daemon=True).start()

    def _handle_manual_trigger(char: str, stem: str) -> None:
        if stem:
            _discard_recording()
            source = OBS_SOURCE_PREFIX + stem
            print(f"{_TAG} ⚡  Manual trigger '{seq_str}{char}' → '{source}'")
            _stop_random_mode()
            if player.is_busy:
                player.abort()
            player.play_async(source)
        else:
            _discard_recording()
            print(f"{_TAG} ⚠  '{seq_str}{char}' is not configured — set it in config.py.")

    def _on_kb_press(key):
        if stop_event.is_set():
            return
        char = key_char(key)
        if not char:
            return

        manual_map = _manual_triggers_ref[0]
        if manual_window.claim(char, manual_map):
            _run_hotkey_action(_handle_manual_trigger, char, manual_map[char])
            return

        if char.lower() == "c" and not manual_window.is_open:
            _run_hotkey_action(_stop_and_send)
            return

        if trigger.register_key(char):
            _run_hotkey_action(_on_trigger)

    kb_token = subscribe_global_hotkeys(_on_kb_press)
    manual_keys = "".join(_manual_triggers_ref[0].keys())
    print(
        f"{_TAG} ⌨️   Hotkey '{seq_str}' armed (within {int(TRIGGER_MAX_INTERVAL * 1000)} ms) — "
        f"then speak or press [{manual_keys}] for a direct song."
    )
    if startup_event is not None:
        startup_event.set()

    try:
        while not stop_event.is_set():
            try:
                raw = input_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            if not isinstance(raw, str) or not raw.strip():
                continue

            raw = raw.strip()

            cmd_result = _parse_command(raw)
            if cmd_result is not None:
                cmd, qualifier = cmd_result

                if cmd == "abort":
                    _release_recording_if_active(send=False)
                    _stop_random_mode()
                    player.abort()
                    print(f"{_TAG} ⚡  Aborted.")
                    continue

                if cmd == "random":
                    _release_recording_if_active(send=False)
                    _start_random_mode(qualifier.strip() or None)
                    continue

                if cmd == "next":
                    with _rand_lock:
                        in_random = _rand_active[0]
                    if in_random:
                        player.abort()
                        print(f"{_TAG} ⏭  Skipping to next random song.")
                    else:
                        print(f"{_TAG} ⚠  'next' has no effect outside random mode.")
                    continue

                if cmd == "stop":
                    _release_recording_if_active(send=False)
                    _stop_random_mode()
                    player.abort()
                    print(f"{_TAG} ⏹  Stopped.")
                    continue

                if cmd == "reload":
                    _trigger_reload()
                    continue

            if not library:
                print(f"{_TAG} ❌  Library is empty — run full_sync.py --apply first.")
                continue

            result = find_best_match(raw, library, threshold=MATCH_THRESHOLD)

            if result is None:
                print(f"{_TAG} ❌  No match for: \"{raw}\"")
                top = rank_matches(raw, library, top_n=3)
                if top:
                    print(f"{_TAG}    Closest (all below threshold {MATCH_THRESHOLD:.0%}):")
                    for song, score in top:
                        print(f"         {score * 100:5.1f}%  {song['name']}")
                if _paused_for_trigger[0]:
                    _paused_for_trigger[0] = False
                    player.resume()
                    print(f"{_TAG} ▶  No match — resuming paused song.")
                continue

            _paused_for_trigger[0] = False

            song, score = result
            file_stem = song.get("source", "")
            obs_source_name = OBS_SOURCE_PREFIX + file_stem

            print(f"{_TAG} 🎯  Matched: \"{song['name']}\"  ({score * 100:.0f}%)")

            if not file_stem:
                print(f"{_TAG} ❌  Song '{song['name']}' has no 'source' key — check songs.json.")
                continue

            if player.is_busy:
                print(f"{_TAG} ⏹  Stopping current song to play new one.")
                player.abort()

            print(f"{_TAG} ▶  Starting: '{obs_source_name}'")
            player.play_async(obs_source_name)
    finally:
        run_cleanup("specific_song", lambda: unsubscribe_global_hotkeys(kb_token),
                    manual_window.close, lambda: _release_recording_if_active(send=False),
                    _stop_random_mode, player.stop, lambda: music_service.unregister(player))
        print(f"{_TAG} Stopped.")

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

import difflib
import json
import queue
import re
import sys
import threading
import random
from pathlib import Path

from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
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

# ── Voice command aliases ──────────────────────────────────────────────────────
_CMD_ALIASES: dict[str, list[str]] = {
    "abort": [
        "abort", "aborted", "a board", "a bore", "a port", "aborting",
        "cancel", "cancel it",
    ],
    "random": [
        "random", "randomly", "randomize", "random mode",
        "ran dumb", "ran dom", "ran dum",
        "shuffle", "shuffled", "shuffling", "shovel",
        "play random", "start random", "go random",
    ],
    "next": [
        "next", "necks", "next one", "next song",
        "skip", "skipped", "skit", "skip it", "skip song",
        "text",
    ],
    "stop": [
        "stop", "stopped", "stop it", "stop music", "stop song",
        "store", "top",
    ],
    "reload": [
        "reload", "reloaded", "reload songs", "re-load",
        "refresh", "refreshed",
    ],
}

_CMD_FUZZY_THRESHOLD = 0.72
_CAT_FUZZY_THRESHOLD = 0.60

_CAT_STOP_WORDS = re.compile(
    r"\b(from|in|of|the|a|an|some|just|mode|category)\b"
)


def _norm_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _fuzzy_ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a, b).ratio()


def _match_category(query: str, cats: dict[str, list[str]]) -> str | None:
    if not cats:
        return None
    q_raw = _norm_text(query)
    q_clean = _CAT_STOP_WORDS.sub("", q_raw).strip()

    for attempt in ([q_clean, q_raw] if q_clean != q_raw else [q_raw]):
        if not attempt:
            continue
        for name in cats:
            if name.lower() == attempt:
                return name
        best_name, best_score = None, 0.0
        for name in cats:
            score = _fuzzy_ratio(attempt, name.lower())
            if score > best_score:
                best_score = score
                best_name = name
        if best_score >= _CAT_FUZZY_THRESHOLD:
            return best_name
    return None


def _parse_command(text: str) -> tuple[str, str] | None:
    norm = _norm_text(text)
    words = norm.split()
    if not words:
        return None

    for cmd, aliases in _CMD_ALIASES.items():
        for alias in aliases:
            alias_n = _norm_text(alias)
            if norm == alias_n:
                return cmd, ""
            if _fuzzy_ratio(norm, alias_n) >= _CMD_FUZZY_THRESHOLD:
                return cmd, ""

    for prefix_len in (1, 2):
        if len(words) <= prefix_len:
            break
        prefix = " ".join(words[:prefix_len])
        remainder = " ".join(words[prefix_len:])
        for alias in _CMD_ALIASES["random"]:
            alias_n = _norm_text(alias)
            if not alias_n:
                continue
            if prefix == alias_n or _fuzzy_ratio(prefix, alias_n) >= _CMD_FUZZY_THRESHOLD:
                return "random", remainder

    return None


def _sync_assets_to_library() -> None:
    """Startup sync: assets dir is the source of truth for songs.json + OBS."""
    if not ASSETS_DIR.exists():
        print(f"{_TAG} ⚠  Songs asset dir not found — skipping startup sync: {ASSETS_DIR}")
        return

    media_files = sorted(
        p for p in ASSETS_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in _SYNC_MEDIA_EXTS
    )
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

    # ── Random-mode state ─────────────────────────────────────────────────────
    _rand_lock = threading.Lock()
    _rand_active = [False]
    _rand_stop_event = threading.Event()
    _rand_thread: list[threading.Thread | None] = [None]
    _played_indices: list[set] = [set()]

    def _stop_random_mode() -> None:
        with _rand_lock:
            if not _rand_active[0]:
                return
            _rand_active[0] = False
        _rand_stop_event.set()
        t = _rand_thread[0]
        if t and t.is_alive():
            t.join(timeout=5)
        _rand_stop_event.clear()
        print(f"{_TAG} 🔀  Random mode stopped.")

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

    def _run_random_loop(lib: list[dict]) -> None:
        with _rand_lock:
            _rand_active[0] = True
            _played_indices[0].clear()

        print(f"{_TAG} 🔀  Random mode started ({len(lib)} songs).")
        try:
            while not _rand_stop_event.is_set():
                song = _pick_next_random(lib)
                file_stem = song.get("source", "")
                if not file_stem:
                    continue
                source = OBS_SOURCE_PREFIX + file_stem
                print(f"{_TAG} 🎲  Random pick: '{song['name']}'")
                player.play_async(source)

                import time as _time
                _time.sleep(0.3)
                while player.is_busy and not _rand_stop_event.is_set():
                    _time.sleep(0.2)

        finally:
            with _rand_lock:
                _rand_active[0] = False
            print(f"{_TAG} 🔀  Random loop exited.")

    def _start_random_mode(category: str | None = None) -> None:
        if not library:
            print(f"{_TAG} ❌  Library empty — cannot start random mode.")
            return

        lib = library
        if category:
            cat_name = _match_category(category, categories)
            if cat_name is None:
                available = ", ".join(sorted(categories)) or "(none)"
                print(f"{_TAG} ⚠  Unknown category '{category}'. Available: {available}")
                return
            cat_ids = set(categories[cat_name])
            lib = [s for s in library if s["id"] in cat_ids]
            if not lib:
                print(f"{_TAG} ⚠  Category '{cat_name}' has no songs in the current library.")
                return
            print(f"{_TAG} 🏷  Random mode: category '{cat_name}' ({len(lib)} songs)")

        _stop_random_mode()
        player.abort()
        t = threading.Thread(
            target=_run_random_loop,
            args=(lib,),
            daemon=True,
            name="specific_song:random",
        )
        with _rand_lock:
            _rand_thread[0] = t
        t.start()

    from .interface import _live
    _live["player"] = player
    _live["rand_active"] = _rand_active
    _live["stop_random"] = _stop_random_mode

    seq_str = "".join(TRIGGER_SEQUENCE)

    def _load_library() -> list[dict]:
        if not SONGS_JSON.exists():
            print(f"{_TAG} ⚠  songs.json not found at {SONGS_JSON}")
            print(f"{_TAG}    Run  full_sync.py --apply  to generate it.")
            return []
        with open(SONGS_JSON, encoding="utf-8") as f:
            data = json.load(f)

        # Merge aliases from phrases.json (managed by the hotkey editor)
        phrases_path = _HERE / "phrases.json"
        if phrases_path.exists():
            try:
                raw = json.loads(phrases_path.read_text(encoding="utf-8"))
                ext_phrases = {
                    k: v for k, v in raw.items()
                    if not k.startswith("_") and isinstance(v, list)
                }
                for song in data:
                    source = song.get("source", "")
                    if source and source in ext_phrases:
                        existing = set(song.get("aliases", []))
                        extra    = {str(a).strip() for a in ext_phrases[source] if str(a).strip()}
                        song["aliases"] = sorted(existing | extra)
            except Exception as e:
                print(f"{_TAG} ⚠  Could not merge phrases.json: {e}")
        else:
            # Bootstrap phrases.json from existing aliases on first run
            try:
                bootstrap = {}
                for song in data:
                    if song.get("aliases") and song.get("source"):
                        bootstrap[song["source"]] = song["aliases"]
                if bootstrap:
                    payload = {
                        "_comment": "Keys are song source stems. Values are alternate voice phrases.",
                        **bootstrap,
                    }
                    phrases_path.write_text(
                        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
                    )
                    print(f"{_TAG} 📝  Bootstrapped phrases.json from {len(bootstrap)} song alias(es).")
            except Exception:
                pass

        print(f"{_TAG} 📚  {len(data)} song(s) loaded from songs.json")
        for s in data:
            aliases = s.get("aliases", [])
            alias_str = f"  +{len(aliases)} alias(es)" if aliases else ""
            print(f"     • {s['name']}{alias_str}")
        return data

    library = _load_library()

    def _load_categories() -> dict[str, list[str]]:
        # Prefer the hotkey editor's state file (categories + sound_categories)
        editor_state_path = _HERE / "hotkeys_editor.json"
        if editor_state_path.exists():
            try:
                state     = json.loads(editor_state_path.read_text(encoding="utf-8"))
                profiles  = state.get("profiles", {})
                live_prof = state.get("live_profile", "default")
                profile   = profiles.get(live_prof) or profiles.get("default") or {}
                cat_names = [str(c) for c in profile.get("categories", []) if str(c).strip()]
                if cat_names:
                    result: dict[str, list[str]] = {cat: [] for cat in cat_names}
                    for stem, cats in profile.get("sound_categories", {}).items():
                        for cat in (cats if isinstance(cats, list) else [cats]):
                            if cat in result:
                                result[cat].append(str(stem))
                    print(f"{_TAG} 🏷  {len(result)} category(ies) from editor: "
                          f"{', '.join(sorted(result)) or '(none)'}")
                    return result
            except Exception as e:
                print(f"{_TAG} ⚠  Could not read editor categories: {e}")

        # Fallback: categories.json (hub UI or manual)
        cats_path = _HERE / "categories.json"
        if not cats_path.exists():
            return {}
        try:
            with open(cats_path, encoding="utf-8") as f:
                data = json.load(f)
            print(f"{_TAG} 🏷  {len(data)} category(ies) loaded: {', '.join(sorted(data)) or '(none)'}")
            return data
        except Exception as e:
            print(f"{_TAG} ⚠  Could not load categories.json: {e}")
            return {}

    categories: dict[str, list[str]] = _load_categories()

    def _load_manual_triggers() -> dict[str, str]:
        """Load manual trigger hotkeys from hotkeys.json (written by the hotkey editor)."""
        hotkeys_path = _HERE / "hotkeys.json"
        if hotkeys_path.exists():
            try:
                raw = json.loads(hotkeys_path.read_text(encoding="utf-8"))
                loaded = {k: v for k, v in raw.items()
                          if isinstance(k, str) and isinstance(v, str)}
                if loaded:
                    return loaded
            except Exception:
                pass
        return dict(MANUAL_TRIGGER_SONGS)  # fallback to config.py constants

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

    def _voice_mod():
        return sys.modules.get("voice.listener")

    # ── Recording state machine ───────────────────────────────────────────────
    _rec_lock = threading.Lock()
    _recording: list[bool] = [False]
    _paused_for_trigger: list[bool] = [False]  # True when song was paused (not aborted) for this trigger window
    _auto_timer: list[threading.Timer | None] = [None]
    _hard_timer: list[threading.Timer | None] = [None]

    _AUTO_SEND_SECONDS = 2.0
    _HARD_TIMEOUT_SECS = RECORD_TIMEOUT_SECONDS

    def _send_to_queue(text: str) -> None:
        if text and text.strip():
            input_queue.put(text.strip())

    def _cancel_timers() -> None:
        auto_t = _auto_timer[0]
        hard_t = _hard_timer[0]
        _auto_timer[0] = None
        _hard_timer[0] = None
        if auto_t:
            auto_t.cancel()
        if hard_t:
            hard_t.cancel()

    def _do_send() -> None:
        with _rec_lock:
            if not _recording[0]:
                return
            _recording[0] = False
        _cancel_timers()
        vm = _voice_mod()
        if vm:
            vm.stop_and_transcribe(_send_to_queue, "specific_song")
        print(f"{_TAG} 🔄  Sending to Whisper…")

    def _open_mic() -> bool:
        vm = _voice_mod()
        if vm is None:
            print(f"{_TAG} ⚠  No voice module — cannot record.")
            return False
        started = vm.start_recording("specific_song")
        if not started:
            if hasattr(vm, "is_ready") and not vm.is_ready():
                print(f"{_TAG} ⚠  Could not start recording — Whisper/mic is still starting.")
            else:
                print(f"{_TAG} ⚠  Could not start recording — mic is busy.")
            return False
        return True

    def _arm_timers() -> None:
        _cancel_timers()
        auto_t = threading.Timer(_AUTO_SEND_SECONDS, _do_send)
        hard_t = threading.Timer(_HARD_TIMEOUT_SECS, _do_send)
        _auto_timer[0] = auto_t
        _hard_timer[0] = hard_t
        auto_t.start()
        hard_t.start()

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

        if not _open_mic():
            if _paused_for_trigger[0]:
                _paused_for_trigger[0] = False
                player.resume()
            return

        with _rec_lock:
            _recording[0] = True
        _arm_timers()
        print(f"{_TAG} 🎤  Listening… (auto-sends after 2s, or press trigger again / 'C' to send)")

    # ── Manual trigger window state ───────────────────────────────────────────
    _manual_lock = threading.Lock()
    _in_manual_window = [False]
    _pending_rec_timer: list[threading.Timer | None] = [None]

    def _on_manual_window_expired() -> None:
        with _manual_lock:
            _in_manual_window[0] = False
            _pending_rec_timer[0] = None

    def _on_trigger() -> None:
        with _rec_lock:
            already_recording = _recording[0]

        if already_recording:
            _do_send()
            with _manual_lock:
                _in_manual_window[0] = False
                if _pending_rec_timer[0] is not None:
                    _pending_rec_timer[0].cancel()
                    _pending_rec_timer[0] = None
            return

        _start_listening()

        with _manual_lock:
            _in_manual_window[0] = True
            if _pending_rec_timer[0] is not None:
                _pending_rec_timer[0].cancel()
            t = threading.Timer(MANUAL_TRIGGER_WINDOW, _on_manual_window_expired)
            _pending_rec_timer[0] = t
            t.start()

    def _stop_and_send() -> None:
        with _rec_lock:
            if not _recording[0]:
                return
        _do_send()
        print(f"{_TAG} ✋  Forced send.")

    def _discard_recording() -> None:
        with _rec_lock:
            _recording[0] = False
        _cancel_timers()
        vm = _voice_mod()
        if vm:
            vm.stop_and_transcribe(lambda _: None, "specific_song")

    def _release_recording_if_active(*, send: bool) -> None:
        """Keep local state and voice.listener ownership in sync on all exits."""
        with _rec_lock:
            was_recording = _recording[0]
        if not was_recording:
            return
        if send:
            _do_send()
        else:
            _discard_recording()

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
        char = key_char(key)
        if not char:
            return

        with _manual_lock:
            if _in_manual_window[0] and char in _manual_triggers_ref[0]:
                _in_manual_window[0] = False
                if _pending_rec_timer[0] is not None:
                    _pending_rec_timer[0].cancel()
                    _pending_rec_timer[0] = None

                stem = _manual_triggers_ref[0][char]
                _run_hotkey_action(_handle_manual_trigger, char, stem)
                return

        if char.lower() == "c" and not _in_manual_window[0]:
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
                library = _load_library()
                categories.clear()
                categories.update(_load_categories())
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

    unsubscribe_global_hotkeys(kb_token)
    with _manual_lock:
        if _pending_rec_timer[0] is not None:
            _pending_rec_timer[0].cancel()
            _pending_rec_timer[0] = None
    _release_recording_if_active(send=False)
    _stop_random_mode()
    player.abort()
    player.stop()
    print(f"{_TAG} Stopped.")

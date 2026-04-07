"""
specific_song/main.py
=====================
On-demand specific-song player.  Triggered by the "ili" key sequence.
Plugs into the hub — no hub-level routing needed.

Hotkey behaviour
----------------
  i → l → i   (all within TRIGGER_MAX_INTERVAL seconds)

  While idle (nothing playing):
    First  "ili"  →  open mic, start recording
    Second "ili"  →  stop recording → transcribe → match → play song in OBS

  While a song is playing:
    First  "ili"  →  pause song (hide source) + open mic simultaneously
    Second "ili"  →  stop recording → transcribe → match
                      if match found  → abort paused song, play new song
                      if no match     → resume paused song

  Recording auto-cancels after RECORD_TIMEOUT_SECONDS if the second "ili"
  isn't pressed.  If a song was paused it is resumed on auto-cancel.

  Song finishes naturally → source hidden automatically, player goes idle.
"""

from __future__ import annotations

import json
import queue
import sys
import threading
import random
import time
from pathlib import Path

from pynput import keyboard

from .config import (
    TRIGGER_SEQUENCE,
    TRIGGER_MAX_INTERVAL,
    STOP_SEQUENCE,
    STOP_MAX_INTERVAL,
    RECORD_TIMEOUT_SECONDS,
    MATCH_THRESHOLD,
    OBS_SOURCE_PREFIX,
    SONGS_JSON,
)
from .trigger import SequenceTrigger
from .matcher import find_best_match, rank_matches
from .player  import SongPlayer

_HERE = Path(__file__).resolve().parent
_TAG  = "[specific_song]"


def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    """Called by the hub in a dedicated daemon thread."""

    trigger      = SequenceTrigger(TRIGGER_SEQUENCE, TRIGGER_MAX_INTERVAL)
    stop_trigger = SequenceTrigger(STOP_SEQUENCE,    STOP_MAX_INTERVAL)

    player  = SongPlayer()

    # ── Random-mode state ─────────────────────────────────────────────────────
    # When random mode is active a background thread continuously picks a song,
    # waits for it to finish, then picks another.  "next" skips the current one;
    # "stop" / "abort" exit the loop entirely.

    _rand_lock        = threading.Lock()
    _rand_active      = [False]          # True while loop is running
    _rand_stop_event  = threading.Event()  # set to break the loop
    _rand_thread: list[threading.Thread | None] = [None]
    _played_indices:  list[set] = [set()]   # tracks played songs for shuffle

    def _stop_random_mode() -> None:
        """Cancel the random loop without touching the player directly."""
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
        """Pick a song not recently played; resets shuffle when all exhausted."""
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
                song      = _pick_next_random(lib)
                file_stem = song.get("source", "")
                if not file_stem:
                    continue
                source = OBS_SOURCE_PREFIX + file_stem
                print(f"{_TAG} 🎲  Random pick: '{song['name']}'")
                player.play_async(source)

                # Wait for this song to finish (or for the stop signal).
                # Poll player.is_busy — play_async sets it; it clears when done.
                # Give play_async a moment to actually set is_busy before polling.
                import time as _time
                _time.sleep(0.3)
                while player.is_busy and not _rand_stop_event.is_set():
                    _time.sleep(0.2)

        finally:
            with _rand_lock:
                _rand_active[0] = False
            print(f"{_TAG} 🔀  Random loop exited.")

    def _start_random_mode() -> None:
        if not library:
            print(f"{_TAG} ❌  Library empty — cannot start random mode.")
            return
        _stop_random_mode()    # cancel any existing loop first
        player.abort()         # stop whatever is playing
        t = threading.Thread(
            target=_run_random_loop, args=(library,),
            daemon=True, name="specific_song:random"
        )
        with _rand_lock:
            _rand_thread[0] = t
        t.start()

    seq_str  = "".join(TRIGGER_SEQUENCE)
    stop_str = "".join(STOP_SEQUENCE)

    def _load_library() -> list[dict]:
        if not SONGS_JSON.exists():
            print(f"{_TAG} ⚠  songs.json not found at {SONGS_JSON}")
            print(f"{_TAG}    Run  full_sync.py --apply  to generate it.")
            return []
        with open(SONGS_JSON, encoding="utf-8") as f:
            data = json.load(f)
        print(f"{_TAG} 📚  {len(data)} song(s) loaded from songs.json")
        for s in data:
            aliases = s.get("aliases", [])
            alias_str = f"  +{len(aliases)} alias(es)" if aliases else ""
            print(f"     • {s['name']}{alias_str}")
        return data

    library = _load_library()

    voice_mod = sys.modules.get("voice.listener")
    if voice_mod is None:
        print(f"{_TAG} ⚠  voice.listener not in sys.modules — mic will be unavailable.")

    _recording:     list[bool]                    = [False]
    _was_paused:    list[bool]                    = [False]
    _timeout_timer: list[threading.Timer | None]  = [None]
    _auto_timer:    list[threading.Timer | None]  = [None]   # 2s auto-send
    _rec_lock = threading.Lock()

    def _send_to_queue(text: str) -> None:
        if text and text.strip():
            input_queue.put(text.strip())

    def _cancel_recording(reason: str, *, resume_if_paused: bool = True) -> None:
        with _rec_lock:
            if not _recording[0]:
                return
            _recording[0]     = False
            timer             = _timeout_timer[0]
            _timeout_timer[0] = None
            was_paused        = _was_paused[0]
            _was_paused[0]    = False

        auto_t         = _auto_timer[0]
        _auto_timer[0] = None
        if auto_t is not None:
            auto_t.cancel()
        if timer is not None:
            timer.cancel()
        if voice_mod is not None:
            voice_mod.stop_and_transcribe(lambda _: None)

        print(f"{_TAG} 🚫  Recording cancelled ({reason}).")

        if resume_if_paused and was_paused and player.is_busy:
            player.resume()

    def _on_timeout() -> None:
        _cancel_recording(f"no send within {RECORD_TIMEOUT_SECONDS:.0f}s", resume_if_paused=True)

    def _on_trigger() -> None:
        if voice_mod is None:
            print(f"{_TAG} ⚠  No voice module — cannot record.")
            return

        with _rec_lock:
            currently_recording = _recording[0]

        if not currently_recording:
            with _rec_lock:
                _recording[0]  = True
                _was_paused[0] = player.is_busy

            if player.is_busy:
                player.pause()
                print(f"{_TAG} ⏸  Song paused while you speak.")

            # 2-second auto-send: fires _send_after_pause which transcribes
            # and queues the result automatically, no second "ili" needed.
            # The 20s hard-cancel still runs as a safety net.
            def _send_after_pause() -> None:
                with _rec_lock:
                    if not _recording[0]:
                        return   # already sent or cancelled
                    _recording[0]     = False
                    hard_t            = _timeout_timer[0]
                    _timeout_timer[0] = None
                if hard_t is not None:
                    hard_t.cancel()
                print(f"{_TAG} ⏱  Auto-sending after silence…")
                voice_mod.stop_and_transcribe(_send_to_queue)

            auto_timer = threading.Timer(2.0, _send_after_pause)
            hard_timer = threading.Timer(RECORD_TIMEOUT_SECONDS, _on_timeout)
            with _rec_lock:
                # Store both; _timeout_timer holds the hard-cancel for _cancel_recording.
                _timeout_timer[0] = hard_timer
                _auto_timer[0]    = auto_timer
            auto_timer.start()
            hard_timer.start()

            voice_mod.start_recording()
            print(
                f"{_TAG} 🎤  Listening… "
                f"(auto-sends in 2s, or press '{seq_str}' to send now)"
            )

        else:
            with _rec_lock:
                _recording[0]  = False
                timer          = _timeout_timer[0]
                _timeout_timer[0] = None

            if timer is not None:
                timer.cancel()
            with _rec_lock:
                auto_t         = _auto_timer[0]
                _auto_timer[0] = None
            if auto_t is not None:
                auto_t.cancel()

            voice_mod.stop_and_transcribe(_send_to_queue)
            print(f"{_TAG} 🔄  Transcribing…")

    def _on_kb_press(key):
        try:
            char = key.char
        except AttributeError:
            return
        if char and trigger.register_key(char):
            _on_trigger()
        if char and stop_trigger.register_key(char):
            _cancel_recording("stop hotkey", resume_if_paused=False)
            _stop_random_mode()
            player.abort()
            print(f"{_TAG} ⏹  Stop hotkey '{stop_str}' fired.")

    kb_listener = keyboard.Listener(on_press=_on_kb_press)
    kb_listener.start()
    print(f"{_TAG} ⌨️   Hotkey '{seq_str}' armed (within {int(TRIGGER_MAX_INTERVAL * 1000)} ms).")
    print(f"{_TAG} ⌨️   Stop hotkey '{stop_str}' armed (within {int(STOP_MAX_INTERVAL * 1000)} ms).")

    while not stop_event.is_set():
        try:
            raw = input_queue.get(timeout=0.5)
        except queue.Empty:
            continue

        if not isinstance(raw, str) or not raw.strip():
            continue

        raw     = raw.strip()
        lowered = raw.lower()
        # Strip trailing punctuation so transcriptions like "Random." or "Next!"
        # match command strings cleanly.  Song names still use `lowered` (unstripped).
        lowered_cmd = lowered.strip(".,!?… ")

        if lowered_cmd == "abort":
            _cancel_recording("abort command", resume_if_paused=False)
            _stop_random_mode()
            player.abort()
            print(f"{_TAG} ⚡  Aborted.")
            continue

        if lowered_cmd in ("random", "shuffle"):
            _cancel_recording("random command", resume_if_paused=False)
            _start_random_mode()
            continue

        if lowered_cmd in ("next", "skip"):
            with _rand_lock:
                in_random = _rand_active[0]
            if in_random:
                # Abort current song — the loop will immediately pick the next one.
                player.abort()
                print(f"{_TAG} ⏭  Skipping to next random song.")
            else:
                print(f"{_TAG} ⚠  'next' has no effect outside random mode.")
            continue

        if lowered_cmd in ("stop",):
            _cancel_recording("stop command", resume_if_paused=False)
            _stop_random_mode()
            player.abort()
            print(f"{_TAG} ⏹  Stopped.")
            continue

        if lowered_cmd in ("reload", "refresh"):
            library = _load_library()
            continue

        if not library:
            print(f"{_TAG} ❌  Library is empty — run full_sync.py --apply first.")
            with _rec_lock:
                was_paused     = _was_paused[0]
                _was_paused[0] = False
            if was_paused and player.is_busy:
                player.resume()
            continue

        result = find_best_match(raw, library, threshold=MATCH_THRESHOLD)

        # Snapshot BOTH the paused flag AND the current source name in one step,
        # before touching the player at all.  Reading player.current_source later
        # (after abort()) would race with the play thread clearing it to None.
        with _rec_lock:
            was_paused     = _was_paused[0]
            _was_paused[0] = False
        paused_source = player.current_source if was_paused else None

        if result is None:
            print(f"{_TAG} ❌  No match for: \"{raw}\"")
            top = rank_matches(raw, library, top_n=3)
            if top:
                print(f"{_TAG}    Closest (all below threshold {MATCH_THRESHOLD:.0%}):")
                for song, score in top:
                    print(f"         {score * 100:5.1f}%  {song['name']}")
            if was_paused and player.is_busy:
                print(f"{_TAG} ▶  Resuming paused song (no match found).")
                player.resume()
            continue

        song, score     = result
        file_stem       = song.get("source", "")
        obs_source_name = OBS_SOURCE_PREFIX + file_stem

        print(f"{_TAG} 🎯  Matched: \"{song['name']}\"  ({score * 100:.0f}%)")

        if not file_stem:
            print(f"{_TAG} ❌  Song '{song['name']}' has no 'source' key — check songs.json.")
            if was_paused and player.is_busy:
                player.resume()
            continue

        # Same song that was paused → just resume it, don't restart.
        # Compare against paused_source (snapshotted above), not player.current_source,
        # which may already be None if the play thread cleared it.
        if was_paused and paused_source == obs_source_name:
            print(f"{_TAG} ▶  Same song — resuming.")
            player.resume()
            continue

        # Different song (or idle): stop whatever is playing and start the new one.
        if player.is_busy:
            print(f"{_TAG} ⏹  Stopping current song to play new one.")
            player.abort()

        print(f"{_TAG} ▶  Starting: '{obs_source_name}'")
        player.play_async(obs_source_name)

    kb_listener.stop()
    _cancel_recording("shutdown", resume_if_paused=False)
    _stop_random_mode()
    player.abort()
    player.stop()
    print(f"{_TAG} Stopped.")
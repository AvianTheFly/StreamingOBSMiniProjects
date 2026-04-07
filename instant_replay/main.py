# instant_replay/main.py
"""
Instant Replay mini-project.

Voice Commands  (press "|" to start recording, press "|" again to transcribe)
------------------------------------------------------------------------------
  "mark"   — Plant a manual clip start-point at this exact moment.
             Overrides the kill-tracker anchor for the next save.

  "save" / "save <tag>" — Save & trim the OBS replay buffer.
             Optional tags: win, escape, fail, objective (or just "save"
             for no tag).  Tags let you select clips later with "play <tag>".
             Clip start is determined by (in priority order):
               1. Manual mark         (set via "mark" command)
               2. Kill-tracker anchor  (first kill in streak − PRE_ROLL_SECONDS)
               3. No trim             (save the full replay buffer as-is)
             The manual mark is consumed after each save.

  "play" / "play last" — Play the most recently saved clip.
  "play all"           — Play all clips from the current game in order.
  "play <tag>"         — Play the most recent clip with that tag
                         (e.g. "play win").
  "play <tag> N"       — Play the Nth clip with that tag
                         (e.g. "play win 1", "play win 2").
             If called within PLAY_AFTER_SAVE_WINDOW seconds of a save
             command, waits for the save/trim to finish then plays immediately.

Hotkey behaviour during playback
---------------------------------
  Pressing "|" while a replay is playing cancels the replay immediately and
  returns to RETURN_SCENE (instead of starting a new voice recording).

Kill detection
--------------
  KillTracker polls the League Live Client Data API independently.
  Records wall-clock time the moment a ChampionKill is detected where
  KillerName == activePlayer.riotIdGameName.  first_kill_wall_time tracks
  the start of the current kill streak (resets after 20 s of no kills).

Voice pipeline
--------------
  Uses the hub's shared voice.listener (faster-whisper, already loaded).
  Press "|" once → starts buffering mic audio.
  Press "|" again → stops recording, transcribes, dispatches the command.
  A RECORD_TIMEOUT_SECONDS safety timer auto-cancels if the second press
  never arrives.

Audio side-chain
----------------
  While the replay is playing, the OBS Desktop Audio mixer slider is ducked to
  REPLAY_MONITOR_VOLUME_DB (-40 dB).  It is restored to NORMAL_MONITOR_VOLUME_DB
  (0 dB) when the replay ends — whether by natural finish, early cancel,
  or unexpected crash (atexit + signal handlers cover crash scenarios).
  Restore is idempotent: it only runs if audio was actually ducked, so the
  crash handler won't accidentally change volume when nothing was ducked.

Game-end reset
--------------
  When the League client disconnects (game ends), the in-memory clip registry
  is cleared.  The trimmed files remain on disk for cleanup to merge into
  a session overview video.

Integration
-----------
  Follows Pattern B from OBS_HUB_CLAUDE_REFERENCE.md.
  Exposes run(input_queue, stop_event) — the hub calls this in a daemon thread.
"""

from __future__ import annotations

import atexit
import os
import queue
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

from pynput import keyboard

import obs
from obs import (
    save_replay_buffer_and_wait,
    set_media_source_file,
    restart_media,
    switch_scene,
    wait_for_media_end,
    set_input_volume_db,
)

from .config import (
    HOTKEY_LISTEN,
    INSTANT_REPLAY_LOGO_SCENE,
    INSTANT_REPLAY_LOGO_SOURCE,
    KILL_PRE_ROLL_SECONDS,
    RECORD_TIMEOUT_SECONDS,
    REPLAY_SAVE_TIMEOUT,
    RETURN_SCENE,
    SAVE_TAG_ALIASES,
    SCENE,
    SOURCE_NAME,
    TRIMMED_SUFFIX,
)
from .kill_tracker import KillTracker
from .cleanup import start_deferred


# ─────────────────────────────────────────────────────────────────────────────
#  Audio volume constants
# ─────────────────────────────────────────────────────────────────────────────

# Desktop audio volume in dB for the OBS Audio Mixer slider.
# OBS: 0 dB = 100%, -40 dB ≈ very quiet.
DESKTOP_AUDIO_INPUT: str = "Desktop Audio"
NORMAL_MONITOR_VOLUME_DB: float = 0.0
REPLAY_MONITOR_VOLUME_DB: float = -40.0

# ─────────────────────────────────────────────────────────────────────────────
#  Play-after-save race-condition window
# ─────────────────────────────────────────────────────────────────────────────

# If "play" is spoken within this many seconds of a "save" command, the play
# will block until the save+trim finishes and then auto-trigger.
PLAY_AFTER_SAVE_WINDOW: float = 8.0


# ─────────────────────────────────────────────────────────────────────────────
#  Audio helpers
# ─────────────────────────────────────────────────────────────────────────────

_set_ducked: bool = False


def _set_monitor_db(db: float) -> None:
    """
    Set the Desktop Audio volume in dB on the OBS Audio Mixer.
    Silently logs on failure so audio issues never crash playback.
    """
    global _set_ducked
    try:
        set_input_volume_db(DESKTOP_AUDIO_INPUT, db)
        print(f"[instant_replay] 🔊 Desktop audio → {db:.0f} dB")
        _set_ducked = (db != NORMAL_MONITOR_VOLUME_DB)
    except Exception as exc:
        print(f"[instant_replay] ⚠  Could not set monitor volume: {exc}")


def _restore_monitor_volume() -> None:
    """Restore desktop audio to 0 dB.  Idempotent — only runs if we actually ducked."""
    if _set_ducked:
        _set_monitor_db(NORMAL_MONITOR_VOLUME_DB)


# ─────────────────────────────────────────────────────────────────────────────
#  Crash-safe audio restore
# ─────────────────────────────────────────────────────────────────────────────
# Register restore hooks at import time so they fire even if the process is
# killed via Ctrl-C, an unhandled exception, or a SIGTERM from the hub.

atexit.register(_restore_monitor_volume)

def _signal_handler(signum, frame) -> None:  # noqa: ANN001
    _restore_monitor_volume()
    # Re-raise as KeyboardInterrupt / default so the process still exits.
    signal.signal(signum, signal.SIG_DFL)
    signal.raise_signal(signum)

for _sig in (signal.SIGINT, signal.SIGTERM):
    try:
        signal.signal(_sig, _signal_handler)
    except (OSError, ValueError):
        pass  # Can't override signals in all environments (e.g. non-main thread)


# ─────────────────────────────────────────────────────────────────────────────
#  ffmpeg helper
# ─────────────────────────────────────────────────────────────────────────────

def _trim_from_end(input_path: str, keep_seconds: float) -> str | None:
    """
    Extract the last `keep_seconds` of `input_path` using ffmpeg.
    Uses output seeking (-to) with stream copy to avoid keyframe sync issues.
    """
    base, _ = os.path.splitext(input_path)
    output_path = base + TRIMMED_SUFFIX

    # Get the total duration of the input first
    probe_cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        input_path,
    ]
    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
    if probe_result.returncode != 0:
        print(f"[instant_replay] ffprobe error:\n{probe_result.stderr[-400:]}")
        return None

    try:
        total_duration = float(probe_result.stdout.strip())
    except ValueError:
        print(f"[instant_replay] Could not parse duration from: {probe_result.stdout.strip()}")
        return None

    start_time = max(0, total_duration - keep_seconds)

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start_time:.3f}",
        "-i", input_path,
        "-avoid_negative_ts", "make_zero",
        "-c", "copy",
        output_path,
    ]

    print(f"[instant_replay] ✂  Trimming last {keep_seconds:.1f}s (start={start_time:.3f}s of {total_duration:.1f}s)…")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"[instant_replay] ffmpeg error:\n{result.stderr[-800:]}")
        return None

    size_mb = Path(output_path).stat().st_size / 1_048_576
    print(f"[instant_replay] ✅ Clip written: {output_path}  ({size_mb:.1f} MB)")
    return output_path


# ─────────────────────────────────────────────────────────────────────────────
#  Command parsing
# ─────────────────────────────────────────────────────────────────────────────

_SAVE_ALIASES: list[str] = [
    "save", "saved", "safe", "say", "dave", "wave",
    "shave", "cave", "face", "base", "slave", "gave",
]
_MARK_ALIASES: list[str] = [
    "mark", "marked", "marks", "marc", "march", "dark",
    "park", "bark", "arc", "spark", "heart",
]
_PLAY_ALIASES: list[str] = [
    "play", "playing", "played", "player", "clay",
    "blade", "place", "plane", "plain", "please", "plague",
]


def _parse_command(text: str) -> tuple[str | None, str, float]:
    """
    Return (command, play_spec, extra_preroll) or (None, "", 0).

    Commands: 'save', 'mark', 'play'.
    For 'save': the second element is the matched tag ('win', 'escape', …) or "".
                A numeric token like "10" or "15" sets extra_preroll seconds.
    For 'play': the second element is the play spec ('all', 'highlights', …) or "".
    """
    lowered = text.lower()
    tokens = lowered.split()

    # Detect command
    cmd: str | None = None
    if any(a in lowered for a in _SAVE_ALIASES):
        cmd = "save"
    elif any(a in lowered for a in _MARK_ALIASES):
        cmd = "mark"
    elif any(a in lowered for a in _PLAY_ALIASES):
        cmd = "play"

    if cmd == "save":
        # Find the index of the save word
        save_idx = 0
        for i, tok in enumerate(tokens):
            if any(a in tok for a in _SAVE_ALIASES):
                save_idx = i
                break
        # Look at tokens after "save" for either a tag or a number
        extra_preroll: float = 0
        tag = ""
        full_save = False
        for tok in tokens[save_idx + 1:]:
            stripped = tok.rstrip(".,!?")
            if stripped == "full":
                full_save = True
                continue
            # Try numeric for extra pre-roll
            try:
                extra_preroll = float(stripped)
                continue
            except ValueError:
                pass
            # Check for tag
            if not tag:
                for t, aliases in SAVE_TAG_ALIASES.items():
                    if any(a in tok for a in aliases):
                        tag = t
                        break
        return ("save", tag, extra_preroll, full_save)

    if cmd == "play":
        play_idx = 0
        for i, tok in enumerate(tokens):
            if any(a in tok for a in _PLAY_ALIASES):
                play_idx = i
                break
        rest = " ".join(tokens[play_idx + 1:]).strip()
        return ("play", rest, 0, False)

    return (cmd, "", 0, False)


# ─────────────────────────────────────────────────────────────────────────────
#  Hub entry point
# ─────────────────────────────────────────────────────────────────────────────

def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    """Called by the hub in a daemon thread."""

    # voice_mod is looked up lazily inside _on_listen_key() so that the hub
    # has time to start voice.listener after launching project threads.

    # ── Kill tracker ──────────────────────────────────────────────────────────
    tracker = KillTracker(stop_event)
    tracker.start()

    # ── Auto-cleanup old replay clips (60 s delay so we don't clash with OBS)
    start_deferred(stop_event)

    # ── Shared state ──────────────────────────────────────────────────────────
    _lock = threading.Lock()

    # Wall-clock time of the most recent "mark" voice command (or None).
    _manual_mark_wall: list[float | None] = [None]

    # Registry of all clips saved in the current game session.
    # Each entry: {"tag": str, "path": str, "index_for_tag": int, "saved_at": float}
    # "tag" is the denotation ("win", "escape", "fail", "objective", "").
    # "index_for_tag" is the Nth clip of that tag (1-based).
    _clip_registry: list[dict] = []

    # Per-tag counters for assigning index_for_tag.
    _tag_counters: dict[str, int] = {}

    # Prevents two simultaneous save operations.
    _save_in_progress = [False]

    # Wall-clock time when the most recent save command was issued (or None).
    # Used to detect the play-after-save race window.
    _last_save_cmd_time: list[float | None] = [None]

    # Event that is set when a save+trim worker finishes successfully.
    # Re-created fresh each save so waiting play() calls don't get stale signals.
    _save_done_event: list[threading.Event] = [threading.Event()]

    # Push-to-talk state.
    _recording = [False]
    _timeout_timer: list[threading.Timer | None] = [None]

    # Whether the replay scene is currently active.
    _replay_active = [False]

    # Watcher thread that auto-returns to RETURN_SCENE after playback.
    _watcher_thread: list[threading.Thread | None] = [None]
    _cancel_watcher = threading.Event()

    # Track previous game state to detect game-end resets.
    _was_in_game: list[bool] = [False]

    # ── Scene / audio return helper ───────────────────────────────────────────

    def _end_replay(*, cancelled: bool = False) -> None:
        """
        Tear down an active replay: cancel the watcher, restore audio, switch scene.
        Safe to call from any thread; idempotent if replay is already inactive.
        """
        with _lock:
            if not _replay_active[0]:
                return
            _replay_active[0] = False

        _cancel_watcher.set()

        # Restore audio FIRST so there's no gap even if the scene switch lags.
        _restore_monitor_volume()

        reason = "cancelled" if cancelled else "ended"
        try:
            switch_scene(RETURN_SCENE)
            print(f"[instant_replay] ↩  Replay {reason} — switched back to '{RETURN_SCENE}'.")
        except Exception as exc:
            print(f"[instant_replay] ❌ Could not switch to '{RETURN_SCENE}': {exc}")

        _hide_replay_logo()

    # ── Logo animation helpers ────────────────────────────────────────────────

    def _animate_replay_logo() -> None:
        try:
            obs.show_logo_animated(
                INSTANT_REPLAY_LOGO_SCENE,
                INSTANT_REPLAY_LOGO_SOURCE,
                jump_duration=4.0,
            )
        except Exception as e:
            print(f"[instant_replay] ⚠  Logo animation failed: {e}")

    def _hide_replay_logo() -> None:
        try:
            obs.hide_source(INSTANT_REPLAY_LOGO_SCENE, INSTANT_REPLAY_LOGO_SOURCE)
        except Exception:
            pass
        # Reset the filter so the logo is flat/next time
        try:
            _client = obs.get_obs()
            _client.set_source_filter_settings(
                INSTANT_REPLAY_LOGO_SOURCE, "3D Block",
                {"tilt_x_deg": 0, "tilt_y_deg": 0, "tilt_z_deg": 0,
                 "pos_x_percent": 0, "pos_y_percent": 0, "scale": 110, "wiggle": 0},
                overlay=True,
            )
        except Exception:
            pass
        try:
            obs.hide_source(INSTANT_REPLAY_LOGO_SCENE, INSTANT_REPLAY_LOGO_SOURCE)
        except Exception:
            pass

    # ── Voice command handlers ────────────────────────────────────────────────

    def _on_mark() -> None:
        now = time.time()
        with _lock:
            _manual_mark_wall[0] = now
        print("[instant_replay] 📍 Mark set — clip will start from this moment.")

    def _on_save(tag: str = "", extra_preroll: float = 0, full_save: bool = False) -> None:
        with _lock:
            if _save_in_progress[0]:
                print("[instant_replay] ⚠  Save already in progress — ignoring.")
                return
            manual_mark     = _manual_mark_wall[0]
            first_kill_time = tracker.first_kill_wall_time

        now = time.time()

        if full_save:
            keep_seconds = None
            anchor_label = "full replay buffer"
        elif manual_mark is not None:
            keep_seconds = now - manual_mark
            anchor_label = f"manual mark ({keep_seconds:.1f}s ago)"
        elif first_kill_time is not None:
            preroll = KILL_PRE_ROLL_SECONDS + extra_preroll
            keep_seconds = (now - first_kill_time) + preroll
            extra_label = f" +{extra_preroll:.0f}s extra" if extra_preroll else ""
            anchor_label = (
                f"kill anchor + {preroll:.0f}s pre-roll{extra_label} "
                f"({keep_seconds:.1f}s total)"
            )
        else:
            keep_seconds = None
            anchor_label = "full buffer (no mark or kill detected)"

        tag_label = f" [{tag}]" if tag else ""
        print(f"[instant_replay] 💾 Save{tag_label} triggered — anchor: {anchor_label}")

        with _lock:
            _save_in_progress[0] = True
            _last_save_cmd_time[0] = now
            # Fresh event so any waiting play() picks up THIS save's completion.
            new_event = threading.Event()
            _save_done_event[0] = new_event

        def _worker() -> None:
            clip: str | None = None
            try:
                replay_file = save_replay_buffer_and_wait(timeout=REPLAY_SAVE_TIMEOUT)
                if not replay_file:
                    print(
                        "[instant_replay] ❌ Timed out waiting for replay save. "
                        "Is the replay buffer running in OBS?"
                    )
                    return

                if keep_seconds is not None:
                    clip = _trim_from_end(replay_file, keep_seconds)
                    if not clip:
                        print("[instant_replay] ❌ Trim failed — check ffmpeg is on PATH.")
                        return
                else:
                    clip = replay_file
                    print(f"[instant_replay] ✅ Using full replay: {clip}")

                with _lock:
                    _manual_mark_wall[0] = None  # consume mark after save

                    # Assign index_for_tag
                    idx = _tag_counters.get(tag or "untagged", 0) + 1
                    _tag_counters[tag or "untagged"] = idx
                    _clip_registry.append({
                        "tag": tag or "untagged",
                        "path": clip,
                        "index_for_tag": idx,
                        "saved_at": time.time(),
                    })

                print(
                    f"[instant_replay] Clip ready ({tag or 'untagged'} #{idx}) — "
                    f"press '|' and say 'play'."
                )

            finally:
                with _lock:
                    _save_in_progress[0] = False
                # Signal any waiting play() — even on failure so it doesn't hang.
                new_event.set()

        threading.Thread(target=_worker, daemon=True, name="ir-save-worker").start()

    def _on_play(spec: str = "") -> None:
        """
        Route based on the play spec:
          "" / "last"   → most recent clip (or deferred save-then-play)
          "all"         → queue all clips sequentially
          "<tag>"       → most recent clip of that tag
          "<tag> <N>"   → Nth clip of that tag
        """
        spec_lower = spec.strip().lower()

        # ── "play all" ────────────────────────────────────────────────────────
        if spec_lower == "all":
            clips = _get_all_clips_in_order()
            if not clips:
                print(
                    "[instant_replay] ⚠  No clips saved yet. "
                    "Press '|' and say 'save' first."
                )
                return
            print(f"[instant_replay] ▶  Queueing {len(clips)} clips for sequential play.")
            _play_all_clips_sequential(clips)
            return

        # ── "<tag> [<N>]" e.g. "win", "win 2", "escape" ───────────────────────
        if spec_lower and spec_lower not in ("", "last"):
            clips = _resolve_play_spec(spec_lower)
            if not clips:
                print(
                    f"[instant_replay] ⚠  No clips match {spec!r}. "
                    f"Available tags: {_format_tag_summary()}"
                )
                return
            _play_all_clips_sequential(clips)
            return

        # ── "" / "last" — most recent clip, with deferred-save fallback ───────
        with _lock:
            save_time = _last_save_cmd_time[0]
            in_progress = _save_in_progress[0]
            done_event = _save_done_event[0]

        now = time.time()
        within_window = (
            save_time is not None
            and (now - save_time) <= PLAY_AFTER_SAVE_WINDOW
        )

        if in_progress and within_window:
            print(
                f"[instant_replay] ⏳ Save in progress — play will fire automatically "
                f"once the clip is ready (within {PLAY_AFTER_SAVE_WINDOW:.0f}s window)."
            )

            def _deferred_play() -> None:
                done_event.wait(timeout=REPLAY_SAVE_TIMEOUT + 5)
                clips_list = _get_most_recent_clip()
                if clips_list:
                    _play_all_clips_sequential(clips_list)
                else:
                    print("[instant_replay] ❌ Deferred play: save did not produce a clip.")

            threading.Thread(
                target=_deferred_play, daemon=True, name="ir-deferred-play"
            ).start()
            return

        clips = _get_most_recent_clip()
        if not clips:
            print(
                "[instant_replay] ⚠  No clip ready. "
                "Press '|' and say 'save' first."
            )
            return
        print(f"[instant_replay] ▶ Playing most recent clip: {clips[0]}")
        _play_all_clips_sequential(clips)

    def _get_most_recent_clip() -> list[str]:
        """Return [path] or [] if no clips."""
        with _lock:
            if not _clip_registry:
                return []
            return [_clip_registry[-1]["path"]]

    def _get_all_clips_in_order() -> list[str]:
        with _lock:
            return [e["path"] for e in _clip_registry]

    def _resolve_play_spec(spec: str) -> list[str]:
        """
        Resolve a play spec like "win", "win 2", "escape" to a list of clip paths.
        Returns [] if nothing matches.
        """
        parts = spec.lower().split()
        tag = parts[0].rstrip(".,!?;:'\"")
        _WORD_TO_NUM = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        }

        number: int | None = None
        if len(parts) >= 2:
            raw_num = parts[1].rstrip(".,!?;:'\"")
            try:
                number = int(raw_num)
            except ValueError:
                number = _WORD_TO_NUM.get(raw_num)

        with _lock:
            matches = [e for e in _clip_registry if e["tag"].lower() == tag]

        if not matches:
            return []

        # Sort by saved_at ascending so index 0 = first clip of this tag
        matches.sort(key=lambda e: e["saved_at"])

        if number is not None:
            # 1-based index → pick the Nth
            idx = number - 1
            if 0 <= idx < len(matches):
                return [matches[idx]["path"]]
            return []

        # No number → most recent
        return [matches[-1]["path"]]

    def _format_tag_summary() -> str:
        with _lock:
            counts: dict[str, int] = {}
            for entry in _clip_registry:
                t = entry["tag"]
                counts[t] = counts.get(t, 0) + 1
            if not counts:
                return "(none)"
            return ", ".join(f"{t}: {c}" for t, c in counts.items())

    def _play_all_clips_sequential(clips: list[str]) -> None:
        """
        Play a list of clips one after another.
        For a single clip, behaves identical to the old _do_play.
        """
        for i, clip in enumerate(clips):
            label = f"Clip {i + 1}/{len(clips)}" if len(clips) > 1 else ""
            print(f"[instant_replay] ▶  Playing: {clip}{' — ' + label if label else ''}")

            # Cancel any ongoing replay/watcher before starting a new one.
            _end_replay(cancelled=True)

            old_watcher: threading.Thread | None
            with _lock:
                old_watcher = _watcher_thread[0]
            if old_watcher and old_watcher.is_alive():
                old_watcher.join(timeout=2)

            _cancel_watcher.clear()

            try:
                switch_scene(SCENE)
                print(f"[instant_replay] 🎬 Switched to '{SCENE}'.")
            except Exception as exc:
                print(f"[instant_replay] ❌ Could not switch to '{SCENE}': {exc}")
                return

            # Small delay so OBS has time to settle on the scene switch
            time.sleep(0.15)

            # Animate the logo: flip up from bottom with a 3D circular spin
            threading.Thread(
                target=_animate_replay_logo, daemon=True
            ).start()

            _set_monitor_db(REPLAY_MONITOR_VOLUME_DB)

            with _lock:
                _replay_active[0] = True

            try:
                set_media_source_file(SOURCE_NAME, clip)
                restart_media(SOURCE_NAME)
            except Exception as exc:
                print(f"[instant_replay] ❌ OBS playback error: {exc}")
                _end_replay(cancelled=True)
                return

            # Wait for media to finish (blocking).
            ended = wait_for_media_end(SOURCE_NAME)
            if _cancel_watcher.is_set():
                _cancel_watcher.clear()  # consume cancel, return early
                return
            if not ended:
                print(
                    f"[instant_replay] ⚠  Media watcher timed out — "
                    f"switched back to '{RETURN_SCENE}' anyway."
                )
                _end_replay(cancelled=True)
                return

            if i < len(clips) - 1:
                # More clips coming — end current replay (restore volume, scene)
                # then loop will restart for next clip.
                _end_replay(cancelled=False)
            else:
                # Last clip finished
                _end_replay(cancelled=False)

    _commands: dict[str, callable] = {
        "mark": _on_mark,
    }

    # ── Voice dispatch (called from background thread by voice.listener) ──────

    def _dispatch(text: str) -> None:
        """Receive a transcribed string and run the matching command."""
        if not text or not text.strip():
            print("[instant_replay] ⚠  Transcription was empty.")
            return
        cmd, spec, extra_preroll, full_save = _parse_command(text)
        if cmd == "save":
            _on_save(tag=spec, extra_preroll=extra_preroll, full_save=full_save)
        elif cmd == "play":
            _on_play(spec)
        elif cmd in _commands:
            _commands[cmd]()
        else:
            print(
                f"[instant_replay] ⚠  Didn't recognise a command in {text!r}. "
                "Expected 'save <tag>', 'mark', or 'play <spec>'."
            )

    # ── Timeout cancel (fires if second "|" press never arrives) ─────────────

    def _cancel_recording(reason: str) -> None:
        with _lock:
            if not _recording[0]:
                return
            _recording[0] = False
            t = _timeout_timer[0]
            _timeout_timer[0] = None
        if t:
            t.cancel()
        vm = sys.modules.get("voice.listener")
        if vm:
            vm.stop_and_transcribe(lambda _: None)   # discard audio
        print(f"[instant_replay] 🚫 Recording cancelled ({reason}).")

    # ── Push-to-talk toggle on "|" ────────────────────────────────────────────

    def _on_listen_key() -> None:
        # ── Early-cancel: pressing "|" during playback cancels the replay ─────
        with _lock:
            replay_running = _replay_active[0]

        if replay_running:
            print("[instant_replay] ⏹  Hotkey pressed during replay — cancelling early.")
            _end_replay(cancelled=True)
            return

        # ── Normal push-to-talk behaviour ─────────────────────────────────────
        vm = sys.modules.get("voice.listener")
        if vm is None:
            print("[instant_replay] ⚠  Voice listener unavailable — is the hub running?")
            return

        with _lock:
            currently_recording = _recording[0]

        if not currently_recording:
            # First press: start recording
            with _lock:
                _recording[0] = True
                t = threading.Timer(
                    RECORD_TIMEOUT_SECONDS,
                    lambda: _cancel_recording("timeout"),
                )
                _timeout_timer[0] = t
            t.start()
            vm.start_recording()
            print(
                f"[instant_replay] 🎙  Recording… "
                f"(press '{HOTKEY_LISTEN}' again to transcribe)"
            )
        else:
            # Second press: stop and transcribe
            with _lock:
                _recording[0] = False
                t = _timeout_timer[0]
                _timeout_timer[0] = None
            if t:
                t.cancel()
            vm.stop_and_transcribe(_dispatch)

    # ── Keyboard listener ─────────────────────────────────────────────────────

    def on_press(key) -> None:
        try:
            char = key.char
        except AttributeError:
            return
        if char == HOTKEY_LISTEN:
            _on_listen_key()

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print(
        f"[instant_replay] ⌨  Armed — press '{HOTKEY_LISTEN}' to start recording, "
        f"press '{HOTKEY_LISTEN}' again to transcribe. "
        "Say 'save [tag]', 'mark', or 'play [spec]'."
    )

    # ── Main loop — processes nothing directly but keeps the thread alive ─────
    # (commands are dispatched inline from _dispatch via the voice callback)
    while not stop_event.is_set():
        try:
            input_queue.get(timeout=0.5)
        except queue.Empty:
            pass

        # Detect game-end: was in-game but now disconnected → reset registry.
        now_in_game = tracker.game_connected
        if _was_in_game[0] and not now_in_game:
            with _lock:
                n = len(_clip_registry)
                _clip_registry.clear()
                _tag_counters.clear()
            print(
                f"[instant_replay] 🔄 Game ended — clip registry cleared "
                f"({n} clip(s) flushed, files remain for cleanup)."
            )
        _was_in_game[0] = now_in_game

    # ── Cleanup ───────────────────────────────────────────────────────────────
    _cancel_recording("shutdown")
    # Ensure audio is restored if the hub kills us cleanly.
    _end_replay(cancelled=True)
    kb.stop()
    print("[instant_replay] Stopped.")
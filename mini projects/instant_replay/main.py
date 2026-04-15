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
               3. Death anchor         (most recent death − DEATH_PRE_ROLL_SECONDS)
               4. No trim             (save the full replay buffer as-is)
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
  Press "|" → starts buffering mic audio.
  Press "!" → stops recording, transcribes, dispatches the command.
  Auto-transcribes after RECORD_TIMEOUT_SECONDS if "!" is not pressed.

Audio muting
------------
  While the replay is playing, Desktop Audio is fully muted so the viewer only
  hears the replay clip.  It is unmuted when the replay ends — whether by
  natural finish, early cancel, or unexpected crash (atexit + signal handlers
  cover crash scenarios).  The unmute is idempotent: it only runs if audio was
  actually muted, so the crash handler never accidentally mutes/unmutes when
  nothing is playing.

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
import difflib
import os
import queue
import re
import signal
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path

from pynput import keyboard

import obs
from shared import VoicePTT, music_service
from obs import (
    save_replay_buffer_and_wait,
    set_media_source_file,
    restart_media,
    switch_scene,
    wait_for_media_end,
    set_input_mute,
    stop_media,
    get_media_state,
)

from .config import (
    DEATH_PRE_ROLL_SECONDS,
    DESKTOP_AUDIO_INPUT,
    EDITED_DIR,
    HOTKEY_LISTEN,
    INSTANT_REPLAY_LOGO_SCENE,
    INSTANT_REPLAY_LOGO_SOURCE,
    KILL_PRE_ROLL_SECONDS,
    PLAY_AFTER_SAVE_WINDOW,
    RECORD_TIMEOUT_SECONDS,
    REPLAY_DIR,
    REPLAY_SAVE_TIMEOUT,
    RETURN_SCENE,
    SAVE_TAG_ALIASES,
    SCENE,
    SOURCE_NAME,
    TRIMMED_SUFFIX,
)
from .kill_tracker import KillTracker
from .cleanup import (
    start_deferred, run_for_game,
    list_edited_reels, wipe_raw_clips_on_startup,
    _read_next_game_num, _write_next_game_num,
)


# ─────────────────────────────────────────────────────────────────────────────
#  Audio mute helpers
# ─────────────────────────────────────────────────────────────────────────────
# Desktop Audio is fully muted while a replay plays, then unmuted when done.
# The module-level flag means atexit / signal handlers can safely unmute even
# if the process is killed mid-replay.

_is_muted: bool = False


def _mute_desktop() -> None:
    """Mute Desktop Audio for replay playback."""
    global _is_muted
    try:
        set_input_mute(DESKTOP_AUDIO_INPUT, True)
        print("[instant_replay] 🔇 Desktop audio muted.")
        _is_muted = True
    except Exception as exc:
        print(f"[instant_replay] ⚠  Could not mute desktop audio: {exc}")


def _unmute_desktop() -> None:
    """Unmute Desktop Audio.  Idempotent — only runs if we actually muted."""
    global _is_muted
    if not _is_muted:
        return
    try:
        set_input_mute(DESKTOP_AUDIO_INPUT, False)
        print("[instant_replay] 🔊 Desktop audio unmuted.")
        _is_muted = False
    except Exception as exc:
        print(f"[instant_replay] ⚠  Could not unmute desktop audio: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
#  Crash-safe unmute
# ─────────────────────────────────────────────────────────────────────────────
# Hooks registered at import time so audio is never left muted on crash,
# Ctrl-C, unhandled exception, or SIGTERM from the hub.

atexit.register(_unmute_desktop)

def _signal_handler(signum, frame) -> None:  # noqa: ANN001
    _unmute_desktop()
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


def _match_tag(token: str) -> str:
    """
    Return the best matching save tag for a single token, or "" if nothing
    is confident enough.

    Strategy (first match wins):
      1. Exact alias substring check (token contains an alias, or alias contains
         the token) — catches the common cases and known Whisper mishears.
      2. difflib fuzzy match against all alias strings — catches novel mishears
         that aren't in the explicit list.  Requires a similarity ratio ≥ 0.72
         to avoid false positives on short tokens like "a" or "the".
    """
    t = token.lower().rstrip(".,!?;:\"'")
    if not t:
        return ""

    # 1. Explicit alias check (bidirectional substring)
    for tag, aliases in SAVE_TAG_ALIASES.items():
        if any(a in t or t in a for a in aliases):
            return tag

    # 2. Fuzzy fallback — build flat alias list with tag labels
    all_aliases: list[str] = [a for aliases in SAVE_TAG_ALIASES.values() for a in aliases]
    close = difflib.get_close_matches(t, all_aliases, n=1, cutoff=0.72)
    if close:
        best_alias = close[0]
        for tag, aliases in SAVE_TAG_ALIASES.items():
            if best_alias in aliases:
                print(f"[instant_replay] 🔍 Fuzzy tag match: {t!r} → {best_alias!r} → [{tag}]")
                return tag

    return ""


_WORD_TO_SECONDS: dict[str, float] = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    "hundred": 100, "a hundred": 100, "one hundred": 100,
    "two hundred": 200,
}


def _parse_command(text: str) -> tuple[str | None, str, float, bool]:
    """
    Return (command, spec, clip_seconds, full_save).

    Commands: 'save', 'mark', 'play'.

    For 'save':
      spec        — matched tag ('win', 'escape', 'fail') or "".
      clip_seconds — explicit clip duration in seconds (0 = not specified).
                    A numeric token ("30") or word-number ("thirty") sets this.
                    When non-zero, it overrides kill/mark anchors and saves
                    exactly that many seconds from the end of the buffer.
      full_save   — True when the user says "save full" (entire buffer).

    Priority in _on_save (highest first):
      full_save > clip_seconds > manual mark > kill anchor > full buffer

    For 'play':
      spec — the play spec string ('all', 'highlights', 'win', …) or "".
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

        clip_seconds: float = 0
        tag = ""
        full_save = False

        for tok in tokens[save_idx + 1:]:
            stripped = tok.rstrip(".,!?;:\"'")

            if stripped in ("full", "whole", "entire", "all", "everything"):
                full_save = True
                continue

            # Numeric literal — e.g. "30", "45.5"
            try:
                clip_seconds = float(stripped)
                continue
            except ValueError:
                pass

            # Word number — e.g. "thirty", "sixty"
            if stripped in _WORD_TO_SECONDS and not tag:
                # Only treat as a number if it doesn't also resolve to a tag,
                # so "save five" means 5 seconds, not a failed tag match.
                clip_seconds = _WORD_TO_SECONDS[stripped]
                continue

            # Tag match (exact aliases + fuzzy)
            if not tag:
                tag = _match_tag(stripped)

        return ("save", tag, clip_seconds, full_save)

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

    # ── Startup wipe — clear raw clips from last session ─────────────────────
    wipe_raw_clips_on_startup()

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

    # Whether the replay scene is currently active.
    _replay_active = [False]

    # True while _play_all_clips_sequential is running with 2+ clips.
    # Used by the hotkey handler to decide skip-to-next vs cancel-all.
    _is_multi_clip_active = [False]

    # Set by the hotkey when pressed during multi-clip playback — signals
    # the player to skip to the next clip rather than cancelling everything.
    _skip_clip = threading.Event()

    # Clips from the previous completed game (preserved after _clip_registry is cleared).
    # Allows "play all" / "play highlights" to work post-game.
    _previous_game_clips: list[dict] = []

    # Label assigned to the current game (e.g. "Game 4 2026-04-11").
    # Set when the game starts; used to label the compiled reel at game-end.
    _current_game_label: list[str | None] = [None]

    # Watcher thread that auto-returns to RETURN_SCENE after playback.
    _watcher_thread: list[threading.Thread | None] = [None]
    _cancel_watcher = threading.Event()

    # Track previous game state to detect game-end resets.
    _was_in_game: list[bool] = [False]

    # ── Scene / audio return helper ───────────────────────────────────────────

    def _end_replay(*, cancelled: bool = False) -> None:
        """
        Tear down an active replay: cancel the watcher, unmute audio, switch scene.
        Safe to call from any thread; idempotent if replay is already inactive.
        """
        with _lock:
            if not _replay_active[0]:
                return
            _replay_active[0] = False

        _cancel_watcher.set()

        # Unmute FIRST so there's no gap even if the scene switch lags.
        _unmute_desktop()
        music_service.resume()  # un-pause specific_song if we paused it

        reason = "cancelled" if cancelled else "ended"
        try:
            switch_scene(RETURN_SCENE)
            print(f"[instant_replay] ↩  Replay {reason} — switched back to '{RETURN_SCENE}'.")
        except Exception as exc:
            print(f"[instant_replay] ❌ Could not switch to '{RETURN_SCENE}': {exc}")

        _hide_replay_logo()

    from .interface import _live
    _live["replay_active"] = _replay_active
    _live["end_replay"]    = _end_replay

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

    def _on_save(tag: str = "", clip_seconds: float = 0, full_save: bool = False) -> None:
        with _lock:
            if _save_in_progress[0]:
                print("[instant_replay] ⚠  Save already in progress — ignoring.")
                return
            manual_mark     = _manual_mark_wall[0]
            first_kill_time = tracker.first_kill_wall_time
            last_death_time = tracker.last_death_wall_time

        now = time.time()

        # Priority (highest first):
        #   1. "save full"       → keep_seconds = None  (entire buffer)
        #   2. explicit seconds  → keep_seconds = clip_seconds
        #   3. manual mark       → keep_seconds = now - mark_time
        #   4. kill anchor       → keep_seconds = time_since_first_kill + PRE_ROLL
        #   5. death anchor      → keep_seconds = time_since_death + PRE_ROLL
        #   6. fallback          → keep_seconds = None  (entire buffer)
        if full_save:
            keep_seconds = None
            anchor_label = "full replay buffer"
        elif clip_seconds > 0:
            keep_seconds = clip_seconds
            anchor_label = f"explicit duration ({clip_seconds:.0f}s)"
        elif manual_mark is not None:
            keep_seconds = now - manual_mark
            anchor_label = f"manual mark ({keep_seconds:.1f}s ago)"
        elif first_kill_time is not None:
            keep_seconds = (now - first_kill_time) + KILL_PRE_ROLL_SECONDS
            anchor_label = (
                f"kill anchor + {KILL_PRE_ROLL_SECONDS:.0f}s pre-roll "
                f"({keep_seconds:.1f}s total)"
            )
        elif last_death_time is not None:
            keep_seconds = (now - last_death_time) + DEATH_PRE_ROLL_SECONDS
            anchor_label = (
                f"death anchor + {DEATH_PRE_ROLL_SECONDS:.0f}s pre-roll "
                f"({keep_seconds:.1f}s total)"
            )
        else:
            keep_seconds = None
            anchor_label = "full buffer (no mark, kill, or death detected)"

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

    # Keywords in the play spec that mean "play all clips from the current/last game"
    _HIGHLIGHTS_KEYWORDS = frozenset([
        "highlight", "highlights", "reel", "highlight reel",
        "last game", "game", "recap", "montage", "all",
    ])

    def _on_play(spec: str = "") -> None:
        """
        Route based on the play spec:
          "" / "last"          -> most recent clip (or deferred save-then-play)
          "all" / "highlights" -> all clips from current game; if none, previous game
          "game N"             -> play the highlight reel for Game N from edited/
          "game last"          -> play the most recent highlight reel from edited/
          "<tag>"              -> most recent clip of that tag
          "<tag> <N>"          -> Nth clip of that tag

        During multi-clip playback, pressing '|' skips to the next clip.
        """
        spec_lower = spec.strip().lower()

        # ── "play game N" / "play game last" → edited reel ───────────────────
        # Matches: "game 2", "game two", "game last", "game latest"
        game_match = re.match(
            r"game\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|last|latest)$",
            spec_lower,
        )
        if game_match:
            token = game_match.group(1)
            _WORD_NUMS = {
                "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
                "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            }
            reels = list_edited_reels()
            if not reels:
                print("[instant_replay] No compiled reels yet. Reels are created after each game.")
                return
            if token in ("last", "latest"):
                _, reel_path = reels[-1]
            else:
                try:
                    target_num = int(token)
                except ValueError:
                    target_num = _WORD_NUMS.get(token, -1)
                matches = [(n, p) for n, p in reels if n == target_num]
                if not matches:
                    available = ", ".join(f"Game {n}" for n, _ in reels)
                    print(f"[instant_replay] No reel for Game {target_num}. Available: {available}")
                    return
                _, reel_path = matches[0]
            print(f"[instant_replay] Playing reel: {reel_path.name}")
            _play_all_clips_sequential([str(reel_path)])
            return

        # ── "play all" / "play highlights" / "play last game" / … ────────────
        # Uses the current game's live clips.  If the game just ended (registry
        # cleared), falls back to the previous game's clips.  If those are also
        # gone, tries the most recent edited reel.
        # NOTE: bare "play" (empty spec) intentionally skips this branch so it
        # falls through to the single-clip / deferred-save logic below.
        if spec_lower and any(kw in spec_lower for kw in _HIGHLIGHTS_KEYWORDS):
            with _lock:
                current_clips = [e["path"] for e in _clip_registry]
                prev_clips    = [e["path"] for e in _previous_game_clips]

            if current_clips:
                clips = current_clips
                label = f"current game ({len(clips)} clip(s))"
            elif prev_clips:
                clips = prev_clips
                label = f"previous game ({len(clips)} clip(s))"
            else:
                # Fall back to the most recent edited reel
                reels = list_edited_reels()
                if reels:
                    _, reel_path = reels[-1]
                    print(f"[instant_replay] No live clips — playing latest reel: {reel_path.name}")
                    _play_all_clips_sequential([str(reel_path)])
                    return
                else:
                    print(
                        "[instant_replay] No game clips yet. "
                        "Save some with '|' + 'save' during a game."
                    )
                    return

            if clips:
                print(f"[instant_replay] Playing {label}. Press '|' to skip to next clip.")
                _play_all_clips_sequential(clips)
                return

        # ── "<tag> [<N>]" e.g. "win", "win 2", "escape" ─────────────────────
        if spec_lower and spec_lower not in ("last",):
            # Don't re-match keywords already handled above
            if not any(kw in spec_lower for kw in _HIGHLIGHTS_KEYWORDS):
                clips = _resolve_play_spec(spec_lower)
                if not clips:
                    print(
                        f"[instant_replay] ⚠  No clips match {spec!r}. "
                        f"Available tags: {_format_tag_summary()}"
                    )
                    return
                _play_all_clips_sequential(clips)
                return

        # ── "" / "last" — most recent clip, with deferred-save fallback ──────
        with _lock:
            save_time   = _last_save_cmd_time[0]
            in_progress = _save_in_progress[0]
            done_event  = _save_done_event[0]

        now = time.time()
        within_window = (
            save_time is not None
            and (now - save_time) <= PLAY_AFTER_SAVE_WINDOW
        )

        if in_progress and within_window:
            print(
                f"[instant_replay] ⏳ Save in progress — will play automatically "
                f"once the clip is ready."
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
        print(f"[instant_replay] ▶ Playing most recent clip: {Path(clips[0]).name}")
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
        Returns [] if nothing matches.  Uses the same fuzzy tag matcher as save.
        """
        parts = spec.lower().split()
        raw_tag = parts[0].rstrip(".,!?;:'\"")
        # Resolve via fuzzy matcher so "play fell" still finds "fail" clips etc.
        tag = _match_tag(raw_tag) or raw_tag
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

        During multi-clip playback, pressing '|' skips to the next clip
        (first press = skip; second consecutive press = cancel all).
        """
        is_multi = len(clips) > 1

        with _lock:
            _is_multi_clip_active[0] = is_multi
        _skip_clip.clear()

        try:
            for i, clip in enumerate(clips):
                label = f"Clip {i + 1}/{len(clips)}" if is_multi else ""
                print(f"[instant_replay] ▶  Playing: {clip}{' — ' + label if label else ''}")

                # Cancel any ongoing replay/watcher before starting a new one.
                _end_replay(cancelled=True)

                old_watcher: threading.Thread | None
                with _lock:
                    old_watcher = _watcher_thread[0]
                if old_watcher and old_watcher.is_alive():
                    old_watcher.join(timeout=2)

                _cancel_watcher.clear()
                _skip_clip.clear()

                music_service.pause()  # pause specific_song music during replay

                try:
                    switch_scene(SCENE)
                    # Give OBS a moment to settle on the scene before starting playback.
                    time.sleep(0.2)
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

                _mute_desktop()

                with _lock:
                    _replay_active[0] = True

                try:
                    set_media_source_file(SOURCE_NAME, clip)
                    restart_media(SOURCE_NAME)
                    # Give OBS a moment to load the media source before we start polling.
                    time.sleep(0.2)
                except Exception as exc:
                    print(f"[instant_replay] ❌ OBS playback error: {exc}")
                    _end_replay(cancelled=True)
                    return

                # Wait for media to finish OR a skip/cancel signal.
                # Poll in short intervals so we can react to _skip_clip quickly.
                ended = False
                cancelled_early = False
                while True:
                    # Check for hard cancel (hotkey during single-clip or double-press)
                    if _cancel_watcher.is_set():
                        cancelled_early = True
                        break

                    # Check for skip-to-next-clip signal
                    if is_multi and _skip_clip.is_set():
                        _skip_clip.clear()
                        print(f"[instant_replay] ⏭  Skipping to next clip ({i + 2}/{len(clips)})…")
                        try:
                            stop_media(SOURCE_NAME)
                        except Exception:
                            pass
                        break  # inner break → next iteration of for-loop

                    # Check if media naturally ended
                    state = get_media_state(SOURCE_NAME)
                    if state in ("OBS_MEDIA_STATE_ENDED", "OBS_MEDIA_STATE_STOPPED",
                                 "OBS_MEDIA_STATE_NONE", "OBS_MEDIA_STATE_ERROR"):
                        ended = True
                        break

                    time.sleep(0.10)

                if cancelled_early:
                    _cancel_watcher.clear()
                    _end_replay(cancelled=True)
                    return

                is_last_clip = (i == len(clips) - 1)

                if is_last_clip:
                    # Full teardown: unmute, switch back to RETURN_SCENE.
                    _end_replay(cancelled=False)
                else:
                    # Between clips: unmute and reset state, but stay on the
                    # replay scene so there's no flicker before the next clip loads.
                    with _lock:
                        _replay_active[0] = False
                    _unmute_desktop()
                    music_service.resume()
                    time.sleep(0.25)  # brief gap between clips

        finally:
            with _lock:
                _is_multi_clip_active[0] = False
            _skip_clip.clear()

    # ── Voice dispatch (called from background thread by voice.listener) ──────

    def _dispatch(text: str) -> None:
        """Receive a transcribed string and run the matching command."""
        if not text or not text.strip():
            print("[instant_replay] ⚠  Transcription was empty.")
            return
        print(f"[instant_replay] 💬 Heard: {text!r}")
        cmd, spec, clip_seconds, full_save = _parse_command(text)
        if cmd == "save":
            _on_save(tag=spec, clip_seconds=clip_seconds, full_save=full_save)
        elif cmd == "play":
            _on_play(spec)
        elif cmd == "mark":
            _on_mark()
        else:
            print(
                f"[instant_replay] ⚠  Didn't recognise a command in {text!r}. "
                "Expected 'save <tag>', 'mark', or 'play <spec>'."
            )

    ptt = VoicePTT(
        timeout=RECORD_TIMEOUT_SECONDS,
        on_transcript=_dispatch,
        tag="instant_replay",
    )

    # ── Push-to-talk toggle on "|" ────────────────────────────────────────────

    def _on_listen_key() -> None:
        # Pressing "|" during replay:
        #   • Single-clip playback  → cancel immediately (existing behaviour)
        #   • Multi-clip playback   → first press skips to next clip;
        #                             second press (while still in multi) cancels all
        with _lock:
            replay_running = _replay_active[0]
            is_multi = _is_multi_clip_active[0]

        if replay_running:
            if is_multi and not _skip_clip.is_set():
                print("[instant_replay] ⏭  Hotkey pressed — skipping to next clip.")
                _skip_clip.set()
            else:
                print("[instant_replay] ⏹  Hotkey pressed during replay — cancelling.")
                _cancel_watcher.set()
                _end_replay(cancelled=True)
            return

        ptt.on_trigger()

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
        "then press 'C' or trigger again to transcribe (auto-transcribes in 2s). "
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
                # Preserve clips for post-game "play highlights" before clearing.
                _previous_game_clips.clear()
                _previous_game_clips.extend(_clip_registry)
                _clip_registry.clear()
                _tag_counters.clear()

                # Assign a persistent game label for the reel that will be compiled.
                game_num  = _read_next_game_num()
                date_str  = datetime.now().strftime("%Y-%m-%d")
                game_label = f"Game {game_num} {date_str}"
                _write_next_game_num(game_num + 1)
                _current_game_label[0] = game_label

            print(
                f"[instant_replay] Game ended — clip registry cleared "
                f"({n} clip(s) flushed, files remain on disk)."
            )
            print(f"[instant_replay] This game will be labelled: {game_label}")

            def _game_end_merge(_label: str = game_label) -> None:
                time.sleep(30)
                run_for_game(_label)

            threading.Thread(
                target=_game_end_merge, daemon=True, name="ir-game-end-merge"
            ).start()

        _was_in_game[0] = now_in_game

    # ── Cleanup ───────────────────────────────────────────────────────────────
    ptt.cancel("shutdown")
    _end_replay(cancelled=True)
    kb.stop()
    print("[instant_replay] Stopped.")
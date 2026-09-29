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
             Plain save uses a manual mark, kill/death anchor, or full buffer.
             "save N seconds" sets an explicit duration before the button press.
             "save full" keeps the original OBS file without a second cut.
             The manual mark is consumed after each save.

  "play" / "play last" — Play the most recently saved clip.
  "play all"           — Play all clips from the current game in order.
  "play <tag>"         — Play the most recent clip with that tag
                         (e.g. "play win").
  "play <tag> N"       — Play the Nth clip with that tag
                         (e.g. "play win 1", "play win 2").
  "play random"        — Keep playing saved clips at random until stopped.
  "stop replay"        — Leave replay immediately and return to normal.
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
import random
import re
import signal
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path

import obs
from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from shared import VoicePTT, project_registry
from coordinator import coordinator
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
    CLIPS_DIR,
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
    list_edited_reels,
    _read_next_game_num, _write_next_game_num,
)


_REPLAY_MEDIA_EXTENSIONS = {".mkv", ".mp4", ".mov", ".webm"}


def wait_for_replay_start(source, cancelled, timeout=8.0):
    """Require advancing PLAYING samples; stale ENDED cursors are not starts."""
    if cancelled.wait(0.2):
        return False
    restart_media(source)
    deadline = time.monotonic() + timeout
    retry_at = time.monotonic() + 1.0
    last_cursor = None
    while time.monotonic() < deadline and not cancelled.is_set():
        status = obs.get_media_status(source) or {}
        state, cursor = status.get('state'), status.get('cursor_ms')
        if state == 'OBS_MEDIA_STATE_PLAYING' and isinstance(cursor, (int, float)):
            if last_cursor is not None and cursor > last_cursor:
                return True
            last_cursor = cursor
        else:
            last_cursor = None
        if retry_at is not None and time.monotonic() >= retry_at and state in (
                'OBS_MEDIA_STATE_STOPPED', 'OBS_MEDIA_STATE_ENDED', 'OBS_MEDIA_STATE_NONE'):
            restart_media(source)
            retry_at = None
        cancelled.wait(0.1)
    return False


def _replay_files_on_disk() -> list[Path]:
    """Return replay media only; never treat full-stream recordings as clips."""
    root = Path(REPLAY_DIR)
    if not root.is_dir():
        return []
    files = [path for path in root.iterdir()
             if path.is_file() and path.suffix.lower() in _REPLAY_MEDIA_EXTENSIONS]
    for folder in (Path(CLIPS_DIR), Path(EDITED_DIR)):
        if folder.is_dir():
            files.extend(path for path in folder.rglob("*")
                         if path.is_file() and path.suffix.lower() in _REPLAY_MEDIA_EXTENSIONS)
    # Prefer the command-free cut over its retained OBS original.
    files = [path for path in files
             if path.name.endswith(TRIMMED_SUFFIX)
             or not path.with_name(path.stem + TRIMMED_SUFFIX).is_file()]
    return sorted(files, key=lambda path: path.stat().st_mtime, reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
#  Audio mute helpers
# ─────────────────────────────────────────────────────────────────────────────
# Desktop Audio is fully muted while a replay plays, then unmuted when done.
# The module-level flag means atexit / signal handlers can safely unmute even
# if the process is killed mid-replay.

_is_muted: bool = False
_desktop_was_muted = False


def _mute_desktop() -> None:
    """Mute Desktop Audio for replay playback."""
    global _is_muted, _desktop_was_muted
    if _is_muted:
        return
    try:
        _desktop_was_muted = bool(obs.get_input_mute(DESKTOP_AUDIO_INPUT))
        # Mark ownership before the request.  The shared OBS helper deliberately
        # suppresses transient connection errors, so cleanup must still attempt
        # an unmute even when this call's outcome cannot be confirmed.
        _is_muted = True
        set_input_mute(DESKTOP_AUDIO_INPUT, True)
        print("[instant_replay] 🔇 Desktop audio muted.")
    except Exception as exc:
        print(f"[instant_replay] ⚠  Could not mute desktop audio: {exc}")


def _unmute_desktop(*, force: bool = False, attempts: int = 4) -> bool:
    """Force Desktop Audio on and verify OBS accepted it.

    ``force`` is used by every replay-finish path, including duplicate/racing
    cleanup calls.  This intentionally restores audio to unmuted rather than
    trusting the pre-replay state: the desired post-replay invariant is that
    global Desktop Audio is on.
    """
    global _is_muted
    if not force and not _is_muted:
        return True
    attempts = max(1, attempts)
    for attempt in range(attempts):
        try:
            set_input_mute(DESKTOP_AUDIO_INPUT, False)
            actual = obs.get_input_mute(DESKTOP_AUDIO_INPUT)
            if actual is False:
                _is_muted = False
                print("[instant_replay] 🔊 Desktop audio verified unmuted.")
                return True
        except Exception as exc:
            print(f"[instant_replay] Audio restore attempt failed: {exc}")
        if attempt + 1 < attempts:
            time.sleep(0.25)
    # Keep ownership marked so a later duplicate cleanup or shutdown hook tries
    # again instead of incorrectly assuming audio was restored.
    _is_muted = True
    print("[instant_replay] ⚠  Desktop audio unmute could not be verified.")
    return False


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

def _saved_clip(replay_file: str, keep_seconds: float | None, *,
                full_save: bool, tail_seconds: float) -> str | None:
    """Full means the original OBS file; automatic saves retain their cutoff."""
    if full_save:
        return replay_file
    return _trim_from_end(replay_file, keep_seconds, tail_seconds=tail_seconds)


def _trim_from_end(input_path: str, keep_seconds: float | None,
                   tail_seconds: float = 0) -> str | None:
    """Cut at the command's button press, with bounded CPU-only encoding."""
    import math
    base, _ = os.path.splitext(input_path)
    output_path = base + TRIMMED_SUFFIX
    temporary = output_path + ".partial"
    flags = (getattr(subprocess, "CREATE_NO_WINDOW", 0)
             | getattr(subprocess, "BELOW_NORMAL_PRIORITY_CLASS", 0))
    try:
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "csv=p=0", input_path,
        ], capture_output=True, text=True, timeout=20, creationflags=flags)
        duration = float(probe.stdout.strip())
        if probe.returncode or not math.isfinite(duration):
            raise ValueError("Cannot read replay duration")
        end = duration - max(0, tail_seconds)
        start = 0 if keep_seconds is None else max(0, end - keep_seconds)
        if end - start < 0.1:
            raise ValueError("The button press is outside the available replay buffer")
        result = subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error", "-y", "-threads", "2",
            "-ss", f"{start:.6f}", "-i", input_path,
            "-t", f"{end - start:.6f}", "-map", "0:v:0", "-map", "0:a?",
            "-map_metadata", "0", "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "18", "-threads", "2", "-c:a", "aac", "-b:a", "192k",
            "-f", "matroska", temporary,
        ], capture_output=True, text=True, timeout=1800, creationflags=flags)
        if result.returncode or not Path(temporary).is_file() or not Path(temporary).stat().st_size:
            raise ValueError(result.stderr[-800:] or "No cut produced")
        Path(temporary).replace(output_path)
        print(f"[instant_replay] Clip ready: {output_path} ({end-start:.1f}s; command tail removed)")
        return output_path
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        print(f"[instant_replay] Trim failed; original retained: {exc}")
        return None
    finally:
        Path(temporary).unlink(missing_ok=True)



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

    Commands: 'save', 'mark', 'play', 'stop'.

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
    lowered = " ".join(text.lower().strip().rstrip(".,!?;:").split())
    if lowered in {"stop", "stop replay", "leave", "leave replay", "exit", "exit replay",
                   "end replay", "cancel replay", "quit replay"}:
        return ("stop", "", 0, False)
    # Group names may contain command words (e.g. "save the day").
    if lowered.startswith("play intro ") or lowered.startswith("play group "):
        return ("play", lowered[5:], 0, False)
    if lowered in {"random", "random replay", "random clip", "surprise me", "play random replay", "play a random replay", "play a random clip"}:
        return ("play", "random", 0, False)
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

def run(
    input_queue: queue.Queue,
    stop_event: threading.Event,
    *,
    startup_event: threading.Event | None = None,
) -> None:
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

    # Whether the replay scene is currently active.
    _replay_active = [False]
    _replay_paused = [False]

    # True while a multi-clip or continuous-random replay is running.
    # Used by the hotkey handler to decide skip-to-next vs cancel-all.
    _is_multi_clip_active = [False]
    _random_playback_active = [False]

    # Set by the hotkey when pressed during multi-clip playback — signals
    # the player to skip to the next clip rather than cancelling everything.
    _skip_clip = threading.Event()

    # Clips from the previous completed game (preserved after _clip_registry is cleared).
    # Allows "play all" / "play highlights" to work post-game.
    _previous_game_clips: list[dict] = []

    # Label assigned to the current game (e.g. "Game 4 2026-04-11").
    # Set when the game starts; used to label the compiled reel at game-end.
    _current_game_label: list[str | None] = [None]

    _scene_session = [None]

    # Watcher thread that auto-returns to RETURN_SCENE after playback.
    _watcher_thread: list[threading.Thread | None] = [None]
    _cancel_watcher = threading.Event()

    # Track previous game state to detect game-end resets.
    _was_in_game: list[bool] = [False]

    def _list_clips() -> list[dict]:
        """Return saved replay files, newest first, for the Hub UI."""
        with _lock:
            current = {str(Path(item["path"]).resolve()): dict(item) for item in _clip_registry}
            previous = {str(Path(item["path"]).resolve()): dict(item) for item in _previous_game_clips}
        from . import library
        persisted = library.read()["clips"]

        rows = []
        edited_root = Path(EDITED_DIR).resolve()
        for path in _replay_files_on_disk():
            try:
                resolved = path.resolve()
                stat = path.stat()
            except OSError:
                continue
            key = str(resolved)
            metadata = current.get(key) or previous.get(key) or persisted.get(library.clip_id(resolved), {})
            scope = "current game" if key in current else ("previous game" if key in previous else "saved")
            try:
                if resolved.is_relative_to(edited_root):
                    scope = "highlight reel"
            except ValueError:
                pass
            rows.append({
                "name": path.name,
                "path": str(resolved),
                "tag": str(metadata.get("tag") or ""),
                "saved_at": float(metadata.get("saved_at") or stat.st_mtime),
                "size_bytes": int(stat.st_size),
                "scope": scope,
            })
        return rows

    # ── Scene / audio return helper ───────────────────────────────────────────

    def _end_replay(*, cancelled: bool = False) -> None:
        # The playback worker performs the handoff after it stops touching OBS.
        # Returning the scene here races a file load already in progress.
        _cancel_watcher.set()
        _unmute_desktop(force=True)

    from .interface import _live
    _live["replay_active"] = _replay_active
    _live["replay_paused"] = _replay_paused
    _live["end_replay"]    = _end_replay
    _live["list_clips"]     = _list_clips
    _live["playback_detail"] = {}

    def _pause_replay() -> None:
        with _lock:
            if not _replay_active[0] or _replay_paused[0]:
                return
            _replay_paused[0] = True
        try:
            obs.pause_media(SOURCE_NAME)
        except Exception as exc:
            print(f"[instant_replay] Could not pause replay media: {exc}")
        _unmute_desktop()
        print("[instant_replay] Paused replay.")

    def _resume_replay() -> None:
        with _lock:
            if not _replay_active[0] or not _replay_paused[0]:
                return
            _replay_paused[0] = False
        session = _scene_session[0]
        if session is None or not session.owns_scene():
            _end_replay(cancelled=True)
            return
        _mute_desktop()
        try:
            obs.play_media(SOURCE_NAME)
        except Exception as exc:
            print(f"[instant_replay] Could not resume replay media: {exc}")
        print("[instant_replay] Resumed replay.")

    _live["pause_replay"] = _pause_replay
    _live["resume_replay"] = _resume_replay

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

    def _on_save(tag: str = "", clip_seconds: float = 0, full_save: bool = False, pressed_at: float | None = None) -> None:
        with _lock:
            if _save_in_progress[0]:
                print("[instant_replay] ⚠  Save already in progress — ignoring.")
                return
            _save_in_progress[0] = True
            manual_mark     = _manual_mark_wall[0]
            first_kill_time = tracker.first_kill_wall_time
            last_death_time = tracker.last_death_wall_time

        now = time.time() if pressed_at is None else pressed_at

        # Priority (highest first):
        #   1. "save full"       → keep_seconds = None  (entire buffer)
        #   2. explicit seconds  → keep_seconds = clip_seconds
        #   3. manual mark       → keep_seconds = now - mark_time
        #   4. kill/death anchor  → automatic highlight
        #   5. fallback          → entire pre-press buffer
        if full_save:
            keep_seconds = None
            anchor_label = "full replay buffer"
        elif clip_seconds > 0:
            keep_seconds = clip_seconds
            anchor_label = f"explicit duration ({clip_seconds:.0f}s)"
        elif manual_mark is not None:
            keep_seconds = now - manual_mark
            anchor_label = f"manual mark ({keep_seconds:.1f}s ago)"
        elif first_kill_time is not None and first_kill_time <= now:
            keep_seconds = (now - first_kill_time) + KILL_PRE_ROLL_SECONDS
            anchor_label = f"kill anchor ({keep_seconds:.1f}s total)"
        elif last_death_time is not None and last_death_time <= now:
            keep_seconds = (now - last_death_time) + DEATH_PRE_ROLL_SECONDS
            anchor_label = f"death anchor ({keep_seconds:.1f}s total)"
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
                save_requested = [time.time()]
                replay_file = save_replay_buffer_and_wait(
                    timeout=REPLAY_SAVE_TIMEOUT,
                    on_save_requested=lambda timestamp: save_requested.__setitem__(0, timestamp))
                if not replay_file:
                    print(
                        "[instant_replay] ❌ Timed out waiting for replay save. "
                        "Is the replay buffer running in OBS?"
                    )
                    return

                clip = _saved_clip(replay_file, keep_seconds, full_save=full_save,
                                   tail_seconds=max(0, save_requested[0] - now))
                if not clip:
                    return

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
                # Keep tags available after a restart and after game-end archiving.
                from . import library
                library.remember_capture(clip, tag=tag or "untagged", saved_at=time.time())

                print(
                    f"[instant_replay] Clip ready ({tag or 'untagged'} #{idx}) — "
                    f"press '|' and say 'play'."
                )

            finally:
                with _lock:
                    _save_in_progress[0] = False
                # Signal any waiting play() — even on failure so it doesn't hang.
                new_event.set()

        try:
            threading.Thread(target=_worker, daemon=True, name="ir-save-worker").start()
        except Exception:
            with _lock:
                _save_in_progress[0] = False
            new_event.set()
            raise

    # Keywords in the play spec that mean "play all clips from the current/last game"
    _HIGHLIGHTS_KEYWORDS = frozenset([
        "highlight", "highlights", "reel", "highlight reel",
        "last game", "game", "recap", "montage", "all",
    ])

    last_random_clip = [None]

    def _on_play(spec: str = "") -> None:
        """
        Route based on the play spec:
          "" / "last"          -> most recent clip (or deferred save-then-play)
            "random"             -> keep choosing saved clips until stopped
            "all" / "highlights" -> all clips from current game; if none, previous game
          "game N"             -> play the highlight reel for Game N from edited/
          "game last"          -> play the most recent highlight reel from edited/
          "<tag>"              -> most recent clip of that tag
          "<tag> <N>"          -> Nth clip of that tag

        During multi-clip playback, pressing '|' skips to the next clip.
        """
        spec_lower = spec.strip().lower()

        if spec_lower.startswith(("intro ", "group ")):
            from . import library
            try:
                clips = library.group_paths(spec_lower.split(" ", 1)[1], REPLAY_DIR, by_name=True)
                _play_all_clips_sequential(clips)
            except ValueError as exc:
                print(f"[instant_replay] {exc}")
            return

        if spec_lower in {"random", "random clip", "anything", "any", "surprise me"}:
            candidates = _replay_files_on_disk()
            if not candidates:
                print("[instant_replay] No saved clips available for random playback.")
                return
            print(
                f"[instant_replay] 🎲 Continuous random started ({len(candidates)} clip(s)). "
                "Press '|' again or say 'stop replay' to leave; use Stop Replay in the Hub too."
            )
            _play_all_clips_sequential([], random_forever=True)
            return

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
            from . import library
            reels = list_edited_reels()
            archived_numbers = library.game_numbers()
            if token in ("last", "latest"):
                available_numbers = archived_numbers + [n for n, _ in reels]
                if not available_numbers:
                    print("[instant_replay] No saved game highlights yet.")
                    return
                target_num = max(available_numbers)
            else:
                try:
                    target_num = int(token)
                except ValueError:
                    target_num = _WORD_NUMS.get(token, -1)
            archived = library.game_paths(target_num, REPLAY_DIR)
            if archived:
                print(f"[instant_replay] Playing Game {target_num} ({len(archived)} individual cut(s)).")
                _play_all_clips_sequential(archived)
                return
            matches = [(n, p) for n, p in reels if n == target_num]
            if not matches:
                available = ", ".join(f"Game {n}" for n in sorted(set(archived_numbers + [n for n, _ in reels])))
                print(f"[instant_replay] No highlights for Game {target_num}. Available: {available or '(none)'}")
                return
            _, reel_path = matches[0]
            print(f"[instant_replay] Playing legacy reel: {reel_path.name}")
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
            if _clip_registry:
                return [_clip_registry[-1]["path"]]
        files = _replay_files_on_disk()
        return [str(files[0])] if files else []

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
            from . import library
            persisted = library.tagged_paths(tag, REPLAY_DIR)
            if number is not None:
                return [persisted[number - 1]] if 0 < number <= len(persisted) else []
            return [persisted[-1]] if persisted else []

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

    _playback_gate = threading.Lock()
    from lib.asset_fader import AssetFader
    replay_fader = AssetFader(SOURCE_NAME, Path(__file__).parent / 'asset_volumes.json')

    def _play_all_clips_sequential(
        clips: list[str], *, random_forever: bool = False
    ) -> None:
        """One owner controls OBS until a sequence or random session finishes."""
        if not _playback_gate.acquire(blocking=False):
            print("[instant_replay] Replay already starting/playing; stop it before choosing another.")
            return
        try:
            _cancel_watcher.clear()
            _skip_clip.clear()
            with _lock:
                _is_multi_clip_active[0] = random_forever or len(clips) > 1
                _random_playback_active[0] = random_forever
                _replay_active[0] = True
                _replay_paused[0] = False
            _scene_session[0] = coordinator.scene_session("instant_replay", SCENE, RETURN_SCENE)
            from . import library
            labels = library.read()["clips"]
            index = 0
            while not _cancel_watcher.is_set():
                session = _scene_session[0]
                if session.activated and not session.owns_scene():
                    _cancel_watcher.set()
                    break
                while _replay_paused[0] and not _cancel_watcher.is_set():
                    if not session.owns_scene():
                        _cancel_watcher.set()
                        break
                    _cancel_watcher.wait(0.1)
                if _cancel_watcher.is_set():
                    break
                if random_forever:
                    candidates = _replay_files_on_disk()
                    if not candidates:
                        print("[instant_replay] Random playback stopped: no saved clips remain.")
                        break
                    pool = [path for path in candidates if path != last_random_clip[0]] or candidates
                    choice = random.choice(pool)
                    last_random_clip[0] = choice
                    clip = str(choice)
                    total: int | str = "∞"
                    print(f"[instant_replay] 🎲 Random clip: {choice.name}")
                else:
                    if index >= len(clips):
                        break
                    clip = clips[index]
                    total = len(clips)
                index += 1
                if _cancel_watcher.is_set():
                    break
                clip_path = Path(clip)
                _live["playback_detail"] = {
                    "name": labels.get(library.clip_id(clip), {}).get("title") or clip_path.name,
                    "index": index, "total": total,
                }
                if not clip_path.is_file() or clip_path.stat().st_size <= 0:
                    print(f"[instant_replay] Missing or empty clip: {clip}")
                    continue
                print(f"[instant_replay] Loading: {clip_path.name}")
                obs.configure_media_source_properties(
                    SOURCE_NAME, restart_on_activate=False,
                    close_when_inactive=False, looping=False, clear_on_media_end=False)
                # Select the new file before activating the scene. OBS may not
                # decode an inactive scene, so activate it before waiting.
                obs.hide_source(SCENE, SOURCE_NAME)
                stop_media(SOURCE_NAME)
                replay_fader.capture()
                set_media_source_file(SOURCE_NAME, str(clip_path))
                volume_source = library.volume_source(clip_path, labels, replay_fader.values())
                replay_fader.apply(clip_path, fallback=volume_source)
                if _cancel_watcher.is_set() or not session.activate():
                    _cancel_watcher.set()
                    break
                obs.show_source(SCENE, SOURCE_NAME)
                _mute_desktop()
                if not wait_for_replay_start(SOURCE_NAME, _cancel_watcher):
                    if not _cancel_watcher.is_set():
                        print(f"[instant_replay] Clip could not start: {clip_path.name}")
                    continue
                if _cancel_watcher.is_set():
                    break
                _animate_replay_logo()
                ended_polls = 0
                deadline = time.monotonic() + 7200
                while not _cancel_watcher.is_set():
                    if not session.owns_scene():
                        _cancel_watcher.set()
                        break
                    if _skip_clip.is_set():
                        _skip_clip.clear()
                        break
                    with _lock:
                        paused = _replay_paused[0]
                    if paused:
                        deadline += 0.1
                        time.sleep(0.1)
                        continue
                    replay_fader.capture()
                    state = get_media_state(SOURCE_NAME)
                    ended_polls = ended_polls + 1 if state in (
                        "OBS_MEDIA_STATE_ENDED", "OBS_MEDIA_STATE_STOPPED",
                        "OBS_MEDIA_STATE_NONE", "OBS_MEDIA_STATE_ERROR") else 0
                    if ended_polls >= 3 or time.monotonic() >= deadline:
                        break
                    time.sleep(0.1)
        except Exception as exc:
            print(f"[instant_replay] Playback failed: {exc}")
        finally:
            try:
                replay_fader.capture()
                try:
                    obs.park_media_source(SCENE, SOURCE_NAME)
                finally:
                    _unmute_desktop(force=True)
                    _hide_replay_logo()
                    with _lock:
                        _replay_active[0] = False
                        _replay_paused[0] = False
                    session = _scene_session[0]
                    _scene_session[0] = None
                    if session:
                        session.finish()
            finally:
                with _lock:
                    _is_multi_clip_active[0] = False
                    _random_playback_active[0] = False
                _live["playback_detail"] = {}
                _skip_clip.clear()
                _playback_gate.release()

    def _play_clip_path(path_value: str) -> None:
        root = Path(REPLAY_DIR).resolve()
        candidate = Path(path_value).resolve()
        try:
            allowed = candidate.is_relative_to(root)
        except ValueError:
            allowed = False
        if not allowed or not candidate.is_file():
            print(f"[instant_replay] Refusing unknown clip path: {path_value}")
            return
        _play_all_clips_sequential([str(candidate)])

    _live["play_clip"] = _play_clip_path
    _live["play_sequence"] = _play_all_clips_sequential
    _live["playback_busy"] = _playback_gate.locked
    _live["skip_clip"] = _skip_clip.set
    _live["play_spec"] = _on_play
    _live["save_clip"] = _on_save
    _live["mark"] = _on_mark

    # ── Voice dispatch (called from background thread by voice.listener) ──────

    def _dispatch(text: str, pressed_at: float | None = None) -> None:
        """Receive a transcribed string and run the matching command."""
        if not text or not text.strip():
            print("[instant_replay] ⚠  Transcription was empty.")
            return
        print(f"[instant_replay] 💬 Heard: {text!r}")
        cmd, spec, clip_seconds, full_save = _parse_command(text)
        if cmd == "save":
            _on_save(tag=spec, clip_seconds=clip_seconds, full_save=full_save, pressed_at=pressed_at)
        elif cmd == "play":
            _on_play(spec)
        elif cmd == "mark":
            _on_mark()
        elif cmd == "stop":
            print("[instant_replay] ⏹ Leaving replay.")
            _cancel_watcher.set()
            _end_replay(cancelled=True)
        else:
            print(
                f"[instant_replay] ⚠  Didn't recognise a command in {text!r}. "
                "Say 'random', 'stop replay', 'play last', 'save', or 'mark'. See Instant Replay in the Hub for all commands."
            )

    ptt = VoicePTT(
        timeout=RECORD_TIMEOUT_SECONDS,
        on_transcript=_dispatch,
        on_timed_transcript=_dispatch,
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
            is_random = _random_playback_active[0]

        if replay_running:
            if is_random:
                print("[instant_replay] ⏹ Hotkey pressed during random replay — leaving replay.")
                _cancel_watcher.set()
                _end_replay(cancelled=True)
            elif is_multi and not _skip_clip.is_set():
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
        char = key_char(key)
        if char == HOTKEY_LISTEN:
            threading.Thread(target=_on_listen_key, daemon=True).start()

    kb_token = subscribe_global_hotkeys(on_press)
    print(
        f"[instant_replay] ⌨  Armed — press '{HOTKEY_LISTEN}' to start recording, "
        "then press 'C' or trigger again to transcribe (auto-transcribes in 2s). "
        "Say 'save [tag]', 'mark', 'play [spec]', or 'stop replay'."
    )
    if startup_event is not None:
        startup_event.set()

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
    unsubscribe_global_hotkeys(kb_token)
    print("[instant_replay] Stopped.")

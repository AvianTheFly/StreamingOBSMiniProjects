"""
instant_replay/cleanup.py
=========================
Manages raw replay clips and produces permanent highlight reels.

Directory layout
----------------
  REPLAY_DIR/          <- OBS writes raw buffers here; trimmed clips land here too.
                          Everything in this root is wiped on hub startup.
                          Safe to nuke because finished reels live in edited/.
  REPLAY_DIR/edited/   <- Permanent highlight reels, one MKV per game session.
                          Never touched by the startup wipe.

Workflow (run_once / game-end merge)
-------------------------------------
  1. Scan REPLAY_DIR root for *_ir_trimmed.mkv files.
  2. Group them by game session (game_sessions.json, or 10-min window fallback).
  3. Resolve overlaps: consecutive clips that share wall-clock time are stitched
     seamlessly by trimming the start of the later clip to the exact boundary.
  4. Merge all clips into one MKV in edited/ (singletons are copied, not skipped).
  5. Delete the *_ir_trimmed.mkv source clips from REPLAY_DIR.
  6. Delete the original raw OBS .mkv/.mp4 files from REPLAY_DIR.

Game numbering
--------------
  Game numbers are persistent across restarts via ~/.claude/ir_game_counter.json.
  Each new game label increments from the stored counter, so "Game 3" from last
  session stays "Game 3" on disk and the next game becomes "Game 4".

Playing reels
-------------
  main.py calls list_edited_reels() to enumerate available reels and resolve
  voice commands like "play game 2".  Returns sorted [(game_num, path)] tuples.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import threading
from datetime import datetime, timedelta
from pathlib import Path

from .config import EDITED_DIR, REPLAY_DIR

_TAG = "[instant_replay.cleanup]"
_WINDOW_SECONDS = 600       # 10-minute fallback grouping window
_MIN_OVERLAP_SECONDS = 1.5  # ignore overlaps smaller than this (timestamp imprecision)

_SESSIONS_FILE = Path.home() / ".claude" / "game_sessions.json"
_COUNTER_FILE  = Path.home() / ".claude" / "ir_game_counter.json"


# ---------------------------------------------------------------------------
#  Startup wipe

def wipe_raw_clips_on_startup() -> None:
    """
    Delete every file in REPLAY_DIR root (raw OBS buffers + trimmed clips).
    The edited/ subfolder is left completely untouched.
    Called once when the hub starts, before OBS writes anything new.
    """
    raw_dir    = Path(REPLAY_DIR)
    edited_dir = Path(EDITED_DIR)

    if not raw_dir.exists():
        raw_dir.mkdir(parents=True, exist_ok=True)

    edited_dir.mkdir(parents=True, exist_ok=True)

    deleted = 0
    for f in raw_dir.iterdir():
        if f.is_dir():
            continue  # skip edited/ and any other subdirectory
        try:
            f.unlink()
            deleted += 1
        except OSError as exc:
            print(f"{_TAG} Could not delete {f.name}: {exc}")

    if deleted:
        print(f"{_TAG} Startup wipe: removed {deleted} raw file(s) from {raw_dir}")
    else:
        print(f"{_TAG} Startup wipe: REPLAY_DIR already clean.")


# ---------------------------------------------------------------------------
#  Persistent game counter

def _read_next_game_num() -> int:
    try:
        data = json.loads(_COUNTER_FILE.read_text(encoding="utf-8"))
        return int(data.get("next_game_num", 1))
    except Exception:
        return 1


def _write_next_game_num(n: int) -> None:
    _COUNTER_FILE.parent.mkdir(parents=True, exist_ok=True)
    _COUNTER_FILE.write_text(json.dumps({"next_game_num": n}, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
#  File helpers

def _parse_timestamp(filename: str) -> datetime | None:
    """Extract wall-clock datetime from OBS replay filenames like
    ``Replay 2026-04-03 00-19-16_ir_trimmed.mkv``.
    The timestamp is when the buffer was *saved*, i.e. approximately clip end."""
    m = re.search(r"(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})-(\d{2})", filename)
    if not m:
        return None
    try:
        return datetime.strptime(f"{m[1]} {m[2]}:{m[3]}:{m[4]}", "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def _find_trimmed() -> list[tuple[datetime, Path]]:
    """Return (timestamp, path) for every *_ir_trimmed.mkv in REPLAY_DIR root."""
    result: list[tuple[datetime, Path]] = []
    raw_dir = Path(REPLAY_DIR)
    if not raw_dir.exists():
        return result
    for f in raw_dir.iterdir():
        if f.is_dir():
            continue
        if f.name.endswith("_ir_trimmed.mkv"):
            ts = _parse_timestamp(f.name)
            if ts:
                result.append((ts, f))
    result.sort(key=lambda x: x[0])
    return result


def _get_clip_duration(path: Path) -> float | None:
    """Return duration in seconds via ffprobe, or None on error."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        str(path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def _trim_clip_start(input_path: Path, skip_seconds: float, output_path: Path) -> bool:
    """Write input_path with its first skip_seconds removed to output_path."""
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{skip_seconds:.3f}",
        "-i", str(input_path),
        "-avoid_negative_ts", "make_zero",
        "-c", "copy",
        str(output_path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"{_TAG} ffmpeg trim-start error:\n{r.stderr[-400:]}")
    return r.returncode == 0


# ---------------------------------------------------------------------------
#  Overlap resolution

def _resolve_overlaps(sorted_files: list[Path]) -> tuple[list[Path], list[Path]]:
    """
    For each consecutive pair of clips, if the later clip overlaps the earlier
    one in wall-clock time, trim the overlap from the later clip's start so the
    two stitch seamlessly.

    clip_end  = OBS filename timestamp  (when the buffer was saved)
    clip_start = clip_end - ffprobe_duration

    Returns (processed_files, temp_files).  Caller must delete temp_files.
    """
    if len(sorted_files) <= 1:
        return list(sorted_files), []

    result: list[Path] = []
    temps:  list[Path] = []
    prev_end: datetime | None = None

    for path in sorted_files:
        clip_end = _parse_timestamp(path.name)
        duration = _get_clip_duration(path)

        if clip_end is None or duration is None:
            result.append(path)
            prev_end = clip_end
            continue

        clip_start = clip_end - timedelta(seconds=duration)

        if prev_end is not None:
            overlap = (prev_end - clip_start).total_seconds()
            if overlap > _MIN_OVERLAP_SECONDS:
                if overlap >= duration:
                    print(f"{_TAG} {path.name} fully inside previous clip — skipping")
                    continue  # don't update prev_end; this clip contributes nothing new
                print(f"{_TAG} {overlap:.1f}s overlap — trimming start of {path.name}")
                tmp = path.with_suffix(".overlap_trim.mkv")
                if _trim_clip_start(path, overlap, tmp):
                    result.append(tmp)
                    temps.append(tmp)
                else:
                    print(f"{_TAG} Overlap trim failed — keeping original")
                    result.append(path)
                prev_end = clip_end
                continue

        result.append(path)
        prev_end = clip_end

    return result, temps


# ---------------------------------------------------------------------------
#  Merge / copy

def _merge_into(files: list[Path], output: Path) -> bool:
    """Concatenate files into output (stream-copy).  Single file = plain copy."""
    output.parent.mkdir(parents=True, exist_ok=True)

    if len(files) == 1:
        shutil.copy2(files[0], output)
        return True

    list_path = output.with_suffix(".concat.txt")
    try:
        with open(list_path, "w", encoding="utf-8") as fh:
            for p in files:
                fh.write(f"file '{p.absolute()}'\n")
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(list_path), "-c", "copy", str(output),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"{_TAG} ffmpeg merge error:\n{r.stderr[-500:]}")
        return r.returncode == 0
    finally:
        list_path.unlink(missing_ok=True)


def _delete_raw_obs_files(trimmed_files: list[Path]) -> None:
    """Delete the original OBS .mkv/.mp4 each trimmed clip was derived from."""
    for p in trimmed_files:
        stem = p.name.removesuffix("_ir_trimmed.mkv")
        for ext in (".mp4", ".mkv"):
            original = p.parent / (stem + ext)
            if original.exists() and original != p:
                try:
                    original.unlink()
                    print(f"{_TAG} Deleted raw OBS file: {original.name}")
                except OSError as exc:
                    print(f"{_TAG} Could not delete {original.name}: {exc}")


# ---------------------------------------------------------------------------
#  Session grouping

def _load_game_sessions() -> list[dict]:
    if not _SESSIONS_FILE.exists():
        return []
    try:
        data = json.loads(_SESSIONS_FILE.read_text(encoding="utf-8"))
        sessions = data.get("sessions", [])
        sessions.sort(key=lambda s: s.get("start", ""))
        return sessions
    except Exception as exc:
        print(f"{_TAG} Could not read game sessions: {exc}")
        return []


def _group_by_sessions(
    items: list[tuple[datetime, Path]],
    sessions: list[dict],
) -> list[tuple[str | None, list[Path]]]:
    """
    Assign clips to game windows.  Returns [(label_or_None, [paths])].
    Labels look like "Game 4 2026-04-11".  Orphan clips get None.
    Game numbers are assigned sequentially from the persistent counter.
    """
    MIN_GAME_SECONDS = 60
    windows: list[tuple[datetime, datetime]] = []
    for sess in sessions:
        try:
            s = datetime.fromisoformat(sess["start"]).replace(tzinfo=None)
            e = datetime.fromisoformat(sess["end"]).replace(tzinfo=None)
            if (e - s).total_seconds() >= MIN_GAME_SECONDS:
                windows.append((s, e))
        except (KeyError, ValueError):
            continue

    if not windows:
        return [(None, [p for _, p in items])]

    game_buckets: dict[int, list[tuple[datetime, Path]]] = {}
    orphans: list[tuple[datetime, Path]] = []

    for ts, path in items:
        assigned = False
        for idx, (start, end) in enumerate(windows):
            if start <= ts <= end:
                game_buckets.setdefault(idx, []).append((ts, path))
                assigned = True
                break
        if not assigned:
            orphans.append((ts, path))

    result: list[tuple[str | None, list[Path]]] = []
    next_num = _read_next_game_num()

    for idx, (start_ts, _) in enumerate(windows):
        bucket = game_buckets.get(idx, [])
        if not bucket:
            continue
        date_str = start_ts.strftime("%Y-%m-%d")
        label = f"Game {next_num} {date_str}"
        next_num += 1
        result.append((label, [p for _, p in sorted(bucket, key=lambda x: x[0])]))

    _write_next_game_num(next_num)

    if orphans:
        orphans.sort(key=lambda x: x[0])
        groups: list[list[Path]] = [[orphans[0][1]]]
        for ts, path in orphans[1:]:
            prev_ts = _parse_timestamp(groups[-1][-1].name)
            if prev_ts and (ts - prev_ts).total_seconds() <= _WINDOW_SECONDS:
                groups[-1].append(path)
            else:
                groups.append([path])
        for g in groups:
            result.append((None, g))

    return result


# ---------------------------------------------------------------------------
#  Public API used by main.py

def list_edited_reels() -> list[tuple[int, Path]]:
    """
    Return [(game_num, path)] for every highlight reel in edited/, sorted ascending.
    Filenames must start with "Game N" to be recognised.
    """
    edited_dir = Path(EDITED_DIR)
    if not edited_dir.exists():
        return []
    reels: list[tuple[int, Path]] = []
    for f in edited_dir.iterdir():
        if f.is_dir():
            continue
        m = re.match(r"Game (\d+)", f.name)
        if m:
            reels.append((int(m.group(1)), f))
    reels.sort(key=lambda x: x[0])
    return reels


# ---------------------------------------------------------------------------
#  Core merge entry point

def run_once(game_label: str | None = None) -> int:
    """
    Process all *_ir_trimmed.mkv clips currently in REPLAY_DIR:
      - Resolve overlaps.
      - Merge or copy into edited/<label>_reel.mkv.
      - Delete source trimmed clips.
      - Delete original raw OBS files.

    game_label: if provided, treat all found clips as one group with that label
                (used by run_for_game()).  If None, group automatically from sessions.

    Returns count of trimmed clip files cleaned up.
    """
    items = _find_trimmed()
    if not items:
        return 0

    edited_dir = Path(EDITED_DIR)
    edited_dir.mkdir(parents=True, exist_ok=True)

    if game_label is not None:
        groups: list[tuple[str | None, list[Path]]] = [
            (game_label, [p for _, p in items])
        ]
    else:
        sessions = _load_game_sessions()
        if sessions:
            groups = _group_by_sessions(items, sessions)
        else:
            # Fallback: greedy 10-min window, no game labels
            _groups: list[list[Path]] = [[items[0][1]]]
            for ts, path in items[1:]:
                prev_ts = _parse_timestamp(_groups[-1][-1].name)
                if prev_ts and (ts - prev_ts).total_seconds() <= _WINDOW_SECONDS:
                    _groups[-1].append(path)
                else:
                    _groups.append([path])
            groups = [(None, g) for g in _groups]

    removed = 0

    for label, group in groups:
        if not group:
            continue

        if label:
            output = edited_dir / f"{label}_reel.mkv"
        else:
            base = group[0].name.replace("_ir_trimmed.mkv", "")
            output = edited_dir / f"{base}_reel.mkv"

        if output.exists():
            print(f"{_TAG} Reel already exists — cleaning up source clips: {output.name}")
            for p in group:
                p.unlink(missing_ok=True)
                removed += 1
            _delete_raw_obs_files(group)
            continue

        processed, temps = _resolve_overlaps(group)
        try:
            if not processed:
                continue

            n = len(processed)
            verb = "Moving" if n == 1 else f"Merging {n} clips"
            print(f"{_TAG} {verb} → {output.name}")

            if _merge_into(processed, output):
                size_mb = output.stat().st_size / 1_048_576
                print(f"{_TAG} Reel ready: {output.name}  ({size_mb:.1f} MB)")
                for p in group:
                    p.unlink(missing_ok=True)
                    removed += 1
                _delete_raw_obs_files(group)
            else:
                print(f"{_TAG} Merge failed — source clips kept for retry.")
        finally:
            for t in temps:
                t.unlink(missing_ok=True)

    return removed


# ---------------------------------------------------------------------------
#  Called from main.py at game-end

def run_for_game(game_label: str) -> None:
    """
    Merge all clips currently in REPLAY_DIR into one reel labelled game_label.
    Runs in a background thread 30 s after game-end so in-progress trims finish.
    """
    print(f"{_TAG} Compiling reel for '{game_label}'...")
    try:
        removed = run_once(game_label=game_label)
        if removed > 0:
            print(f"{_TAG} Done ({removed} source clip(s) cleaned up).")
        else:
            print(f"{_TAG} No clips found for '{game_label}'.")
    except Exception as exc:
        print(f"{_TAG} Error during game-end merge: {exc}")


# ---------------------------------------------------------------------------
#  Deferred startup scan (handles leftover clips from a previous interrupted session)

_STARTED = False
_THREAD: threading.Thread | None = None


def start_deferred(stop_event: threading.Event) -> None:
    """Spawn a daemon thread that waits 60 s then merges any leftover clips."""
    global _STARTED, _THREAD
    if _STARTED:
        return
    _STARTED = True

    def _worker() -> None:
        print(f"{_TAG} Waiting 60 s before scanning for leftover clips...")
        if stop_event.wait(timeout=60):
            return
        print(f"{_TAG} Scanning for leftover clips...")
        try:
            run_once()
        except Exception as exc:
            print(f"{_TAG} Error during deferred cleanup: {exc}")

    _THREAD = threading.Thread(target=_worker, daemon=True, name="instant_replay:cleanup")
    _THREAD.start()

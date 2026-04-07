"""
instant_replay/cleanup.py
=========================
Background replay cleaner.  Runs 60 s after the hub starts so that OBS is
not busy writing its first buffer.

Workflow:
  1. Scan for all ``*_ir_trimmed.mkv`` files in the REPLAY_DIR.
  2. If a game-sessions file exists, group clips by game session; otherwise
     fall back to grouping clips whose timestamps are within 10 minutes.
  3. Merge each group into one merged mkv file (fast stream-copy).
     Game-based merges are named ``Game 1 YYYY-MM-DD_merged.mkv``.
     Window-based merges keep the original naming scheme.
  4. Delete the originals that were consumed in the merge.
  5. Exit the thread — the user can run ``run_cleanup()`` again later if
     they want, or restart the hub.
"""

from __future__ import annotations

import json
import re
import subprocess
import threading
from datetime import datetime
from pathlib import Path

from .config import REPLAY_DIR

_TAG = "[instant_replay.cleanup]"
_WINDOW_SECONDS = 600  # 10 minutes

# Path to the game-sessions file written by the league project
_SESSIONS_FILE = Path.home() / ".claude" / "game_sessions.json"


def _load_game_sessions() -> list[dict]:
    """
    Return a list of ``{"start": <iso>, "end": <iso>}`` dicts sorted by start time.
    Returns an empty list if the file doesn't exist or is malformed.
    """
    if not _SESSIONS_FILE.exists():
        return []
    try:
        data = json.loads(_SESSIONS_FILE.read_text(encoding="utf-8"))
        sessions = data.get("sessions", [])
        # Sort by start time just in case
        sessions.sort(key=lambda s: s.get("start", ""))
        return sessions
    except Exception as exc:
        print(f"{_TAG} Could not read game sessions: {exc}")
        return []


# ---------------------------------------------------------------------------
#  Internal helpers

def _parse_timestamp(filename: str) -> datetime | None:
    """Extract datetime from ``Replay 2026-04-03 00-19-16_ir_trimmed.mkv``."""
    m = re.search(r"(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})-(\d{2})", filename)
    if not m:
        return None
    try:
        return datetime.strptime(f"{m[1]} {m[2]}:{m[3]}:{m[4]}",
                                 "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def _find_trimmed() -> list[tuple[datetime, Path]]:
    result: list[tuple[datetime, Path]] = []
    for f in Path(REPLAY_DIR).iterdir():
        if f.name.endswith("_ir_trimmed.mkv") and "_merged_" not in f.name:
            ts = _parse_timestamp(f.name)
            if ts:
                result.append((ts, f))
    result.sort(key=lambda x: x[0])
    return result


def _merge_files(files: list[Path], output: Path) -> bool:
    if len(files) == 1:
        return True

    list_path = output.with_suffix(output.suffix + ".concat.txt")
    with open(list_path, "w", encoding="utf-8") as fh:
        for p in files:
            fh.write(f"file '{p.absolute()}'\n")

    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(list_path), "-c", "copy", str(output),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"{_TAG} ffmpeg error:\n{result.stderr[-500:]}")
    else:
        list_path.unlink(missing_ok=True)
    return result.returncode == 0


# ---------------------------------------------------------------------------
#  Public entry point

def _group_by_sessions(items: list[tuple[datetime, Path]],
                       sessions: list[dict]) -> list[tuple[str, list[Path]]]:
    """
    Group clips into game sessions.  Clips between a game-start and game-end
    are bundled together; clips that don't belong to any game are handled
    with the 10-minute window fallback.

    Returns a list of ``(label, [Path, ...])`` tuples.
    """
    # Build game windows: [(start_dt, end_dt, game_number)]
    # Skip bogus sessions (shorter than 60 s — likely loading-screen blips).
    MIN_GAME_SECONDS = 60
    windows: list[tuple[datetime, datetime, int]] = []
    game_num = 0
    for sess in sessions:
        try:
            s = datetime.fromisoformat(sess["start"])
            e = datetime.fromisoformat(sess["end"])
            # Strip tzinfo so they're offset-naive like clip timestamps
            if s.tzinfo is not None:
                s = s.replace(tzinfo=None)
            if e.tzinfo is not None:
                e = e.replace(tzinfo=None)
            if (e - s).total_seconds() >= MIN_GAME_SECONDS:
                game_num += 1
                windows.append((s, e, game_num))
            # Skip sessions shorter than MIN_GAME_SECONDS silently
        except (KeyError, ValueError):
            continue

    if not windows:
        # No game sessions known — full 10-min window fallback
        labels: list[list[Path]] = []
        for _, path in items:
            labels.append([path])
        return [("", paths) for paths in labels]

    # Assign each clip to a game or orphan
    game_buckets: dict[int, list[tuple[datetime, Path]]] = {}
    orphans: list[tuple[datetime, Path]] = []

    for ts, path in items:
        assigned = False
        for start, end, num in windows:
            if start <= ts <= end:
                game_buckets.setdefault(num, []).append((ts, path))
                assigned = True
                break
        if not assigned:
            orphans.append((ts, path))

    # Build result: game groups first, then orphan groups (10-min window)
    result: list[tuple[str, list[Path]]] = []

    for start_ts, _end_ts, gnum in windows:
        date_str = start_ts.strftime("%Y-%m-%d")
        label = f"Game {gnum} {date_str}"
        clips = [p for (_, p) in game_buckets.get(gnum, [])]
        if clips:
            result.append((label, clips))

    # Orphan clips: group by 10-minute window
    if orphans:
        orphans.sort(key=lambda x: x[0])
        orphan_groups: list[list[Path]] = [[orphans[0][1]]]
        for ts, path in orphans[1:]:
            prev_ts = _parse_timestamp(orphan_groups[-1][0].name)
            if prev_ts and (ts - prev_ts).total_seconds() <= _WINDOW_SECONDS:
                orphan_groups[-1].append(path)
            else:
                orphan_groups.append([path])
        for group in orphan_groups:
            result.append(("", group))

    return result


def run_once() -> int:
    """
    Scan, merge, and delete.  Returns the number of files saved
    (original clips removed).
    """
    items = _find_trimmed()
    if not items:
        return 0

    sessions = _load_game_sessions()

    if sessions:
        groups = _group_by_sessions(items, sessions)
    else:
        # Old behaviour: greedy grouping with 10-min window
        groups: list[tuple[str, list[Path]]] = [[items[0][1]]]
        for ts, path in items[1:]:
            prev_ts = _parse_timestamp(groups[-1][0].name)
            if prev_ts and (ts - prev_ts).total_seconds() <= _WINDOW_SECONDS:
                groups[-1].append(path)
            else:
                groups.append([path])
        groups = [("", g) for g in groups]

    removed = 0
    for label, group in groups:
        if len(group) < 2:
            continue  # singleton — nothing to do

        # Derive output name
        if label:
            # Game-based merge
            output = group[0].parent / f"{label}_merged.mkv"
        else:
            base = group[0].name.replace("_ir_trimmed.mkv", "")
            output = group[0].parent / f"{base}_merged.mkv"

        if output.exists():
            continue  # already merged

        print(f"{_TAG} Merging {len(group)} clips into {output.name}")
        if _merge_files(group, output):
            for p in group:
                p.unlink(missing_ok=True)
                removed += 1
            print(f"{_TAG} Removed {removed} originals.")
        else:
            print(f"{_TAG} Merge failed — originals kept.")

    return removed


# ---------------------------------------------------------------------------
#  Auto-start thread (fires ~60 s after import)

_STARTED = False
_THREAD: threading.Thread | None = None


def start_deferred(stop_event: threading.Event) -> None:
    """Spawn a daemon thread that waits 60 s then runs cleanup once."""
    global _STARTED, _THREAD
    if _STARTED:
        return
    _STARTED = True

    def _worker() -> None:
        print(f"{_TAG} Waiting 60 s before first scan…")
        if stop_event.wait(timeout=60):
            return  # hub shut down before scan ran

        print(f"{_TAG} Scanning for fresh replay clips…")
        try:
            n = run_once()
            print(f"{_TAG} Cleanup complete")
        except Exception as exc:
            print(f"{_TAG} Error during cleanup: {exc}")

    _THREAD = threading.Thread(
        target=_worker, daemon=True, name="instant_replay:cleanup"
    )
    _THREAD.start()

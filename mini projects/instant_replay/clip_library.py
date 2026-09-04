"""Persistent metadata and media helpers for the Instant Replay clip library."""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import subprocess
import threading
from pathlib import Path
from typing import Any

from .config import REPLAY_DIR


MEDIA_EXTENSIONS = {".mkv", ".mp4", ".mov", ".webm"}
ROOT = Path(REPLAY_DIR).resolve()
STATE_FILE = ROOT / ".instant_replay_library.json"
THUMBNAIL_DIR = ROOT / ".instant_replay_thumbnails"
PREVIEW_DIR = ROOT / ".instant_replay_previews"
_LOCK = threading.Lock()
_FFMPEG = threading.Semaphore(2)


def resolve_clip(path_value: str | Path) -> Path:
    candidate = Path(path_value).resolve()
    try:
        allowed = candidate.is_relative_to(ROOT)
    except ValueError:
        allowed = False
    if not allowed or not candidate.is_file() or candidate.suffix.lower() not in MEDIA_EXTENSIONS:
        raise ValueError("Unknown replay clip")
    return candidate


def _key(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def _load() -> dict[str, Any]:
    try:
        raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    clips = raw.setdefault("clips", {})
    if not isinstance(clips, dict):
        raw["clips"] = {}
    return raw


def _save(state: dict[str, Any]) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    temp = STATE_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    temp.replace(STATE_FILE)


def probe_duration(path_value: str | Path) -> float:
    path = resolve_clip(path_value)
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-400:] or "Could not read clip duration")
    return max(0.0, float(result.stdout.strip()))


def clip_settings(path_value: str | Path, *, include_duration: bool = False) -> dict[str, Any]:
    path = resolve_clip(path_value)
    stat = path.stat()
    with _LOCK:
        state = _load()
        entry = state["clips"].get(_key(path), {})
        fingerprint = f"{stat.st_size}:{stat.st_mtime_ns}"
        changed = False
        if entry and entry.get("fingerprint") != fingerprint:
            entry["fingerprint"] = fingerprint
            entry.pop("duration", None)
            changed = True
        if include_duration and entry.get("duration") is None:
            entry = state["clips"].setdefault(_key(path), entry)
            entry["duration"] = round(probe_duration(path), 3)
            changed = True
        if changed:
            _save(state)
        return {
            "duration": entry.get("duration"),
            "replay_start": float(entry.get("replay_start") or 0.0),
            "replay_end": entry.get("replay_end"),
            "intro": bool(entry.get("intro", False)),
            "tags": list(entry.get("tags") or []),
            "game": str(entry.get("game") or ""),
        }


def clip_settings_many(path_values: list[str | Path]) -> dict[str, dict[str, Any]]:
    """Read card metadata in one pass so large libraries stay fast."""
    with _LOCK:
        state = _load()
        saved = state["clips"]
        result: dict[str, dict[str, Any]] = {}
        for value in path_values:
            path = Path(value).resolve()
            entry = saved.get(_key(path), {})
            result[str(path)] = {
                "duration": entry.get("duration"),
                "replay_start": float(entry.get("replay_start") or 0.0),
                "replay_end": entry.get("replay_end"),
                "intro": bool(entry.get("intro", False)),
                "tags": list(entry.get("tags") or []),
                "game": str(entry.get("game") or ""),
            }
        return result


def update_clip_settings(
    path_value: str | Path,
    *,
    replay_start: float | None = None,
    replay_end: float | None = None,
    intro: bool | None = None,
    tags: list[str] | None = None,
    game: str | None = None,
) -> dict[str, Any]:
    path = resolve_clip(path_value)
    duration = probe_duration(path)
    with _LOCK:
        state = _load()
        entry = state["clips"].setdefault(_key(path), {})
        if replay_start is not None or replay_end is not None:
            start = max(0.0, min(float(replay_start or 0.0), duration))
            end = duration if replay_end is None else max(0.0, min(float(replay_end), duration))
            if end - start < 0.1:
                raise ValueError("Replay range must be at least 0.1 seconds")
            entry["replay_start"] = round(start, 3)
            entry["replay_end"] = round(end, 3)
        if intro is not None:
            entry["intro"] = bool(intro)
        if tags is not None:
            entry["tags"] = sorted({str(tag).strip() for tag in tags if str(tag).strip()}, key=str.casefold)
        if game is not None:
            entry["game"] = str(game).strip()
        stat = path.stat()
        entry["fingerprint"] = f"{stat.st_size}:{stat.st_mtime_ns}"
        entry["duration"] = round(duration, 3)
        _save(state)
    return clip_settings(path, include_duration=True)


def playback_range(path_value: str | Path) -> tuple[float, float | None]:
    settings = clip_settings(path_value)
    start = max(0.0, float(settings.get("replay_start") or 0.0))
    raw_end = settings.get("replay_end")
    return start, (float(raw_end) if raw_end is not None else None)


def intro_clips() -> list[str]:
    with _LOCK:
        state = _load()
        selected = [key for key, value in state["clips"].items() if isinstance(value, dict) and value.get("intro")]
    clips: list[str] = []
    for relative in selected:
        candidate = (ROOT / relative).resolve()
        try:
            clips.append(str(resolve_clip(candidate)))
        except ValueError:
            continue
    return clips


def thumbnail_for(path_value: str | Path) -> Path:
    path = resolve_clip(path_value)
    stat = path.stat()
    digest = hashlib.sha1(f"{_key(path)}:{stat.st_mtime_ns}:{stat.st_size}".encode("utf-8")).hexdigest()
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
    output = THUMBNAIL_DIR / f"{digest}.jpg"
    if output.is_file() and output.stat().st_size > 0:
        return output
    try:
        duration = probe_duration(path)
        seek = max(0.0, min(duration * 0.35, max(0.0, duration - 0.1)))
    except Exception:
        seek = 0.0
    with _FFMPEG:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-ss", f"{seek:.3f}", "-i", str(path),
                "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", str(output),
            ],
            capture_output=True,
            text=True,
        )
    if result.returncode != 0 or not output.is_file():
        output.unlink(missing_ok=True)
        raise RuntimeError(result.stderr[-500:] or "Could not create thumbnail")
    return output


def preview_for(path_value: str | Path) -> Path:
    """Return a browser-playable file, making a cached MP4 proxy only when needed."""
    path = resolve_clip(path_value)
    if path.suffix.lower() in {".mp4", ".webm"}:
        return path
    stat = path.stat()
    digest = hashlib.sha1(f"{_key(path)}:{stat.st_mtime_ns}:{stat.st_size}".encode("utf-8")).hexdigest()
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    output = PREVIEW_DIR / f"{digest}.mp4"
    if output.is_file() and output.stat().st_size > 0:
        return output
    temp = PREVIEW_DIR / f".{digest}.working.mp4"
    commands = [
        ["ffmpeg", "-y", "-i", str(path), "-map", "0:v:0", "-map", "0:a?", "-c", "copy", "-movflags", "+faststart", str(temp)],
        ["ffmpeg", "-y", "-i", str(path), "-map", "0:v:0", "-map", "0:a?", "-vf", "scale=min(960\\,iw):-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(temp)],
    ]
    last_error = ""
    with _FFMPEG:
        for command in commands:
            temp.unlink(missing_ok=True)
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode == 0 and temp.is_file() and temp.stat().st_size > 0:
                os.replace(temp, output)
                return output
            last_error = result.stderr[-800:]
    temp.unlink(missing_ok=True)
    raise RuntimeError(last_error or "Could not create browser preview")


def trim_file(path_value: str | Path, start: float, end: float) -> dict[str, Any]:
    """Precisely rewrite one clip to the selected range, replacing that file."""
    path = resolve_clip(path_value)
    duration = probe_duration(path)
    start = max(0.0, min(float(start), duration))
    end = max(0.0, min(float(end), duration))
    if end - start < 0.25:
        raise ValueError("File trim must keep at least 0.25 seconds")
    if start <= 0.01 and end >= duration - 0.01:
        raise ValueError("Choose a smaller range before trimming the file")

    temp = path.with_name(f".{path.stem}.trim-working{path.suffix}")
    command = [
        "ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", str(path),
        "-t", f"{end - start:.3f}", "-map", "0:v:0", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "160k",
    ]
    if path.suffix.lower() in {".mp4", ".mov"}:
        command += ["-movflags", "+faststart"]
    command.append(str(temp))
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0 or not temp.is_file() or temp.stat().st_size <= 0:
        temp.unlink(missing_ok=True)
        raise RuntimeError(result.stderr[-800:] or "ffmpeg could not trim the clip")

    old_size = path.stat().st_size
    os.replace(temp, path)
    new_duration = probe_duration(path)
    with _LOCK:
        state = _load()
        entry = state["clips"].setdefault(_key(path), {})
        entry["replay_start"] = 0.0
        entry["replay_end"] = round(new_duration, 3)
        stat = path.stat()
        entry["fingerprint"] = f"{stat.st_size}:{stat.st_mtime_ns}"
        entry["duration"] = round(new_duration, 3)
        _save(state)
    return {
        "path": str(path),
        "size_before": old_size,
        "size_after": path.stat().st_size,
        "duration": round(new_duration, 3),
    }


def content_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"

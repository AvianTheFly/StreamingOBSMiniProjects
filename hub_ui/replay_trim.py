"""Create full-resolution replay cuts in the background, keeping the source."""
from concurrent.futures import ThreadPoolExecutor
import math
from pathlib import Path
import subprocess
import threading
import uuid

from instant_replay import library

_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="replay-trim")
_lock = threading.Lock()
_jobs = {}
_flags = (getattr(subprocess, "CREATE_NO_WINDOW", 0)
          | getattr(subprocess, "BELOW_NORMAL_PRIORITY_CLASS", 0))


def _duration(source):
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(source),
    ], capture_output=True, text=True, timeout=20, creationflags=_flags)
    try:
        duration = float(result.stdout.strip())
        if result.returncode or not math.isfinite(duration) or duration <= 0:
            raise ValueError()
        return duration
    except ValueError:
        raise ValueError("Could not read this clip's duration. Try another clip.") from None


def _export(source, root, start, end, name):
    duration = _duration(source)
    # Browser previews can round the last frame slightly beyond the original.
    if end > duration + 0.25 or start >= duration:
        raise ValueError("The selected range extends beyond this clip.")
    end = min(end, duration)
    folder = Path(root) / "cuts"
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / f"{source.stem[:100]}_cut_{uuid.uuid4().hex[:10]}.mkv"
    temporary = output.with_suffix(".partial")
    try:
        result = subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error", "-y", "-threads", "2",
            "-ss", str(start), "-i", str(source), "-t", str(end - start),
            "-map", "0:v:0", "-map", "0:a?", "-map_metadata", "0",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-threads", "2", "-c:a", "aac", "-b:a", "192k",
            "-f", "matroska", str(temporary),
        ], capture_output=True, timeout=1800, creationflags=_flags)
        if result.returncode or not temporary.is_file() or temporary.stat().st_size == 0:
            raise ValueError("Could not save this cut. The original clip is unchanged.")
        with library.LOCK:
            data = library.read()
            previous_revision = data["revision"]
            original = data["clips"].get(library.clip_id(source), {})
            data["clips"][library.clip_id(output)] = {
                "path": str(output), "title": name,
                "notes": original.get("notes", ""),
                "favorite": original.get("favorite", False), "kept": True,
                "trim_source": str(source), "trim_start": start, "trim_end": end,
            }
            # Publish only a complete file. Library scans ignore the .partial file.
            temporary.replace(output)
            library._write(data)
        return {"path": str(output), "title": name, "duration": end - start,
                "previous_revision": previous_revision, "revision": data["revision"]}
    finally:
        temporary.unlink(missing_ok=True)


def start_trim(body, root):
    source = library.resolve(str(body.get("path", "")), root)
    try:
        start, end = float(body["start"]), float(body["end"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("Choose a start and end time in seconds.") from None
    if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end - start < 0.1 - 1e-9:
        raise ValueError("Choose at least 0.1 seconds, with the end after the start.")
    name = str(body.get("title", "")).strip()[:160] or f"{source.stem[:140]} (cut)"
    with _lock:
        if any(not job.done() for job in _jobs.values()):
            raise ValueError("A trimmed copy is already saving. Wait for it to finish.")
        # Keep both recordings through the module's automatic game-end cleanup.
        with library.LOCK:
            data = library.read()
            previous_revision = data["revision"]
            data["clips"].setdefault(library.clip_id(source), {}).update(path=str(source), kept=True)
            library._write(data)
        if len(_jobs) >= 20:
            del _jobs[next(iter(_jobs))]
        job_id = uuid.uuid4().hex
        _jobs[job_id] = _pool.submit(_export, source, Path(root).resolve(), start, end, name)
    return {"job": job_id, "status": "saving",
            "previous_revision": previous_revision, "revision": data["revision"]}


def trim_status(job_id):
    with _lock:
        job = _jobs.get(job_id)
    if job is None:
        raise ValueError("This trim job is no longer available. Check the clip library for your cut.")
    if not job.done():
        return {"status": "saving"}
    try:
        return {"status": "ready", **job.result()}
    except FileNotFoundError:
        return {"status": "error", "error": "FFmpeg or the source clip could not be found."}
    except subprocess.TimeoutExpired:
        return {"status": "error", "error": "Saving this cut took too long. Try a shorter selection."}
    except (ValueError, OSError) as exc:
        return {"status": "error", "error": str(exc)}

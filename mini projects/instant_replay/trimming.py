"""Replay media trimming with bounded CPU encoding and original-file retention."""
from __future__ import annotations
import os
import subprocess
from pathlib import Path
from .config import TRIMMED_SUFFIX
from lib.media_jobs import jobs, MediaJobCancelled


def trim_from_end(input_path: str, keep_seconds: float | None,
                   tail_seconds: float = 0, *, fast=False, output_dir=None) -> str | None:
    """Cut at the command's button press, with bounded CPU-only encoding."""
    import math
    base, _ = os.path.splitext(input_path)
    output_path = base + TRIMMED_SUFFIX
    if output_dir is not None:
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        output_path = str(Path(output_dir) / Path(output_path).name)
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
        codecs = ['-c', 'copy'] if fast else ['-c:v', 'libx264', '-preset', 'veryfast',
                  '-crf', '18', '-threads', '2', '-c:a', 'aac', '-b:a', '192k']
        result = jobs.run([
            "ffmpeg", "-nostdin", "-v", "error", "-y", "-threads", "2",
            "-filter_threads", "1", "-ss", f"{start:.6f}", "-i", input_path,
            "-t", f"{end - start:.6f}", "-map", "0:v:0", "-map", "0:a?",
            "-map_metadata", "0", *codecs,
            "-f", "matroska", temporary,
        ], kind='replay-cut', weight=1 if fast else 2, priority=0, text=True, timeout=1800)
        if result.returncode or not Path(temporary).is_file() or not Path(temporary).stat().st_size:
            raise ValueError(result.stderr[-800:] or "No cut produced")
        Path(temporary).replace(output_path)
        print(f"[instant_replay] Clip ready: {output_path} ({end-start:.1f}s; command tail removed)")
        return output_path
    except (OSError, ValueError, subprocess.TimeoutExpired, MediaJobCancelled) as exc:
        print(f"[instant_replay] Trim failed; original retained: {exc}")
        return None
    finally:
        Path(temporary).unlink(missing_ok=True)

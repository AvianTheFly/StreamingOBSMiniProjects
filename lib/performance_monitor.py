"""Low-frequency, read-only evidence for intermittent GPU/OBS failures.

Independent OBS connection: a stalled diagnostics request never holds the
playback socket lock. Files are bounded and each sample is flushed to disk.
No URLs, credentials, audio, or transcription text are recorded.
"""
from __future__ import annotations

import csv
from datetime import datetime, timezone
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time

GPU_FIELDS = ("index", "utilization.gpu", "utilization.memory", "memory.used",
              "memory.total", "temperature.gpu", "power.draw", "power.limit",
              "clocks.gr", "clocks.mem")
OBS_FIELDS = ("cpu_usage", "memory_usage", "active_fps", "average_frame_render_time",
              "render_skipped_frames", "render_total_frames", "output_skipped_frames",
              "output_total_frames")


def parse_gpu_csv(output: str) -> list[dict]:
    result = []
    for row in csv.reader(output.splitlines(), skipinitialspace=True):
        if len(row) == len(GPU_FIELDS):
            result.append(dict(zip(GPU_FIELDS, (x.strip() for x in row))))
    return result


class Collector:
    def __init__(self):
        self.client = None
        self.smi = shutil.which("nvidia-smi")

    def close(self):
        client, self.client = self.client, None
        if client is not None:
            try:
                client.disconnect()
            except Exception:
                pass

    def sample(self) -> dict:
        data = {"time": datetime.now(timezone.utc).isoformat(), "hub_pid": os.getpid()}
        if self.smi:
            try:
                r = subprocess.run([self.smi, "--query-gpu=" + ",".join(GPU_FIELDS),
                                    "--format=csv,noheader,nounits"],
                                   capture_output=True, text=True, timeout=2,
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                data["gpu"] = parse_gpu_csv(r.stdout) if r.returncode == 0 else []
                if r.returncode:
                    data["gpu_error"] = "nvidia-smi exit " + str(r.returncode)
            except (OSError, subprocess.SubprocessError) as exc:
                data["gpu_error"] = type(exc).__name__
        try:
            import psutil
            p = psutil.Process()
            data["hub"] = {"rss_mb": round(p.memory_info().rss / 1048576, 1),
                           "threads": p.num_threads(), "system_memory_percent": psutil.virtual_memory().percent}
        except Exception as exc:
            data["hub_error"] = type(exc).__name__
        try:
            from voice.listener import diagnostics
            data["voice"] = diagnostics()
        except Exception as exc:
            data["voice_error"] = type(exc).__name__
        try:
            if self.client is None:
                import obsws_python
                from obs.obs_config import OBS_HOST, OBS_PORT, OBS_PASSWORD
                self.client = obsws_python.ReqClient(host=OBS_HOST, port=OBS_PORT,
                                                     password=OBS_PASSWORD, timeout=2)
            stats = self.client.get_stats()
            data["obs"] = {k: getattr(stats, k, None) for k in OBS_FIELDS}
            data["obs"]["scene"] = self.client.get_current_program_scene().current_program_scene_name
        except Exception as exc:
            data["obs_error"] = type(exc).__name__
            self.close()
        return data


def start_performance_monitor(stop_event: threading.Event):
    if os.environ.get("HUB_PERFORMANCE_LOG", "1") == "0":
        return
    folder = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "StreamingHub" / "diagnostics"
    try:
        folder.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(folder / "performance.jsonl", maxBytes=5_000_000,
                                      backupCount=3, encoding="utf-8")
    except OSError as exc:
        print(f"[performance] Could not open diagnostics: {exc}")
        return
    logger = logging.Logger("hub-performance", level=logging.INFO)
    logger.addHandler(handler)

    def run():
        collector = Collector()
        try:
            while not stop_event.is_set():
                started = time.monotonic()
                try:
                    sample = collector.sample()
                    sample["sample_seconds"] = round(time.monotonic() - started, 3)
                    logger.info(json.dumps(sample, ensure_ascii=True))
                except Exception as exc:
                    logger.info(json.dumps({"time": datetime.now(timezone.utc).isoformat(),
                                            "collector_error": type(exc).__name__}))
                stop_event.wait(5)
        finally:
            collector.close()
            handler.close()

    thread = threading.Thread(target=run, name="performance-monitor", daemon=True)
    thread.start()
    print(f"[performance] Rolling GPU/OBS diagnostics: {folder / 'performance.jsonl'}")
    return thread

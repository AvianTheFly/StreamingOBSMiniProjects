"""Low-frequency, read-only evidence for intermittent GPU/OBS failures.

Independent OBS connection: a stalled diagnostics request never holds the
playback socket lock. Files are bounded and each sample is flushed to disk.
No URLs, credentials, audio, or transcription text are recorded.
"""
from __future__ import annotations

import csv
from collections import deque
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
from lib.process_metrics import ProcessMetrics

GPU_FIELDS = ("index", "utilization.gpu", "utilization.memory", "memory.used",
              "memory.total", "temperature.gpu", "power.draw", "power.limit",
              "clocks.gr", "clocks.mem", "utilization.encoder", "utilization.decoder")
OBS_FIELDS = ("cpu_usage", "memory_usage", "active_fps", "average_frame_render_time",
              "render_skipped_frames", "render_total_frames", "output_skipped_frames",
              "output_total_frames")
VOICE_FIELDS = ("ready", "recording", "transcribing", "model", "device", "compute",
                "state", "owner", "session_id", "started_at")
LEAGUE_PROCESS_NAMES = frozenset({"league of legends.exe", "leagueclient.exe",
                                "leagueclientux.exe", "leagueclientuxhelper.exe"})
_activity_lock = threading.Lock()
_activity = deque(maxlen=32)
_sample_requested = threading.Event()
_burst_until = 0.0


def note_media_load(source, phase):
    """Mark media/voice work and request a short burst of half-second samples."""
    global _burst_until
    with _activity_lock:
        _activity.append(dict(time=datetime.now(timezone.utc).isoformat(),
                              source=source, phase=phase))
        _burst_until = time.monotonic() + 5
    _sample_requested.set()


def _wait_for_sample(stop_event, *, sampled_at=None):
    # Activity wakes idle diagnostics, but rapid replacements/conversions must
    # not launch nvidia-smi and process scans faster than the half-second cadence.
    sampled_at = time.monotonic() if sampled_at is None else sampled_at
    with _activity_lock:
        delay = .5 if time.monotonic() < _burst_until else 5
    deadline = max(time.monotonic(), sampled_at + delay)
    while not stop_event.is_set():
        if _sample_requested.wait(min(.25, max(0, deadline - time.monotonic()))):
            _sample_requested.clear()
            deadline = max(time.monotonic(), sampled_at + .5)
        if time.monotonic() >= deadline:
            break


def parse_gpu_csv(output: str) -> list[dict]:
    result = []
    for row in csv.reader(output.splitlines(), skipinitialspace=True):
        if len(row) == len(GPU_FIELDS):
            result.append(dict(zip(GPU_FIELDS, (x.strip() for x in row))))
    return result


def find_obs_process(psutil, port):
    """Prefer the connected server, rather than an older exiting OBS instance."""
    try:
        for connection in psutil.net_connections(kind='tcp'):
            if (connection.status == psutil.CONN_LISTEN and connection.laddr.port == port
                    and connection.pid is not None):
                process = psutil.Process(connection.pid)
                if process.name().lower() == 'obs64.exe':
                    return process
    except (psutil.AccessDenied, psutil.NoSuchProcess, OSError):
        pass
    candidates = []
    for process in psutil.process_iter(['name', 'create_time']):
        if (process.info['name'] or '').lower() == 'obs64.exe':
            candidates.append(process)
    return max(candidates, key=lambda p: p.info['create_time'] or 0, default=None)


class Collector:
    def __init__(self):
        self.client = None
        self.smi = shutil.which("nvidia-smi")
        self.process = None
        self.obs_process = None
        self._league_processes = {}
        self._league_scan_at = 0.0
        self._work_processes = ProcessMetrics()

    def _sample_league(self, psutil):
        # Discover infrequently, then reuse Process objects so CPU percentages
        # cover the interval between samples. Never read command lines: Riot
        # launches carry authentication tokens there.
        now = time.monotonic()
        if now >= self._league_scan_at:
            found = {}
            for process in psutil.process_iter(['pid', 'name']):
                name = (process.info['name'] or '').lower()
                if name not in LEAGUE_PROCESS_NAMES:
                    continue
                previous = self._league_processes.get(process.pid)
                if previous is not None and previous['process'].is_running():
                    found[process.pid] = previous
                else:
                    try:
                        process.cpu_percent()  # Prime; the first reading is not a measurement.
                        found[process.pid] = dict(process=process, name=name, primed=False)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            self._league_processes = found
            self._league_scan_at = now + 5
        rows = []
        for pid, tracked in list(self._league_processes.items()):
            process = tracked['process']
            try:
                with process.oneshot():
                    rows.append(dict(pid=pid, name=tracked['name'],
                        cpu_percent=process.cpu_percent() if tracked['primed'] else None,
                        rss_mb=round(process.memory_info().rss / 1048576, 1),
                        threads=process.num_threads()))
                tracked['primed'] = True
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                self._league_processes.pop(pid, None)
        return sorted(rows, key=lambda row: (row['name'], row['pid']))

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
            if self.process is None:
                self.process = psutil.Process()
                self.process.cpu_percent()
                psutil.cpu_percent()
            p = self.process
            data["hub"] = {"rss_mb": round(p.memory_info().rss / 1048576, 1),
                           "threads": p.num_threads(), "cpu_percent": p.cpu_percent(),
                           "system_cpu_percent": psutil.cpu_percent(),
                           "logical_cpus": psutil.cpu_count(),
                           "system_memory_percent": psutil.virtual_memory().percent}
            if (self.obs_process is None or not self.obs_process.is_running()
                    or self.obs_process.num_threads() <= 1):
                from obs.obs_config import OBS_PORT
                self.obs_process = find_obs_process(psutil, int(OBS_PORT))
                if self.obs_process is not None:
                    self.obs_process.cpu_percent()
            if self.obs_process is not None:
                data['obs_process'] = dict(pid=self.obs_process.pid,
                    cpu_percent=self.obs_process.cpu_percent(),
                    rss_mb=round(self.obs_process.memory_info().rss / 1048576, 1),
                    threads=self.obs_process.num_threads())
        except Exception as exc:
            data["hub_error"] = type(exc).__name__
        try:
            import psutil
            data['league_processes'] = self._sample_league(psutil)
        except Exception as exc:
            data['league_error'] = type(exc).__name__
        try:
            import psutil
            data['work_processes'] = self._work_processes.sample(psutil)
        except Exception as exc:
            data['work_process_error'] = type(exc).__name__
        with _activity_lock:
            data['media_loads'] = list(_activity)
        from lib.asset_preparation import preparation
        data['asset_preparation'] = preparation.status()
        from lib.media_jobs import jobs
        data['media_jobs'] = jobs.status()
        try:
            from voice.service import service
            diagnostics = service.diagnostics(include_details=False)
            data["voice"] = {key: diagnostics.get(key) for key in VOICE_FIELDS}
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
        collector = None
        try:
            collector = Collector()
            while not stop_event.is_set():
                started = time.monotonic()
                try:
                    sample = collector.sample()
                    sample["sample_seconds"] = round(time.monotonic() - started, 3)
                    logger.info(json.dumps(sample, ensure_ascii=True))
                except Exception as exc:
                    logger.info(json.dumps({"time": datetime.now(timezone.utc).isoformat(),
                                            "collector_error": type(exc).__name__}))
                _wait_for_sample(stop_event, sampled_at=started)
        finally:
            if collector is not None:
                collector.close()
            handler.close()

    try:
        thread = threading.Thread(target=run, name="performance-monitor", daemon=True)
        thread.start()
    except Exception:
        handler.close()
        raise
    print(f"[performance] Rolling GPU/OBS diagnostics: {folder / 'performance.jsonl'}")
    return thread

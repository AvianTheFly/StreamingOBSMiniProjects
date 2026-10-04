"""Read-only CPU attribution for Python and finite media tools.

Called by the existing performance collector; owns no polling thread. Keep
process identities and counters across samples, without inspecting command
lines, environments, file paths, or other applications' credentials.
"""
from __future__ import annotations

import os
import time

PROCESS_NAMES = frozenset({'python.exe', 'pythonw.exe', 'py.exe', 'python',
                           'python3', 'ffmpeg.exe', 'ffprobe.exe', 'ffmpeg', 'ffprobe'})


class ProcessMetrics:
    def __init__(self, *, clock=time.monotonic):
        self._clock = clock
        self._scan_at = 0.0
        self._tracked = {}

    def sample(self, psutil):
        now = self._clock()
        if now >= self._scan_at:
            found = {}
            for process in psutil.process_iter(['pid', 'name', 'ppid', 'create_time']):
                info = process.info
                name = (info['name'] or '').lower()
                if name not in PROCESS_NAMES:
                    continue
                identity = (process.pid, info['create_time'])
                previous = self._tracked.get(identity)
                if previous is not None and previous['process'].is_running():
                    found[identity] = previous
                    continue
                try:
                    process.cpu_percent()  # Prime: the first reading is unknown.
                    found[identity] = dict(process=process, name=name,
                                           ppid=info['ppid'], primed=False)
                except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
                    continue
            self._tracked = found
            self._scan_at = now + 5
        cores = psutil.cpu_count() or 1
        rows = []
        for identity, tracked in list(self._tracked.items()):
            process = tracked['process']
            try:
                with process.oneshot():
                    cpu = process.cpu_percent() if tracked['primed'] else None
                    rows.append(dict(pid=process.pid, ppid=tracked['ppid'],
                        name=tracked['name'], create_time=identity[1],
                        is_hub=process.pid == os.getpid(), cpu_percent=cpu,
                        machine_cpu_percent=round(cpu / cores, 2) if cpu is not None else None,
                        rss_mb=round(process.memory_info().rss / 1048576, 1),
                        threads=process.num_threads()))
                tracked['primed'] = True
            except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
                self._tracked.pop(identity, None)
        return sorted(rows, key=lambda row: (row['name'], row['pid']))

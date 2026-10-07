"""Cooperative CPU admission for optional work, sampled by its existing worker.

No thread, process scan or blocking CPU query. This gate must be consulted before
acquiring a shared playback/decoder lock, never while holding one. Foreground
actions do not use it. Hysteresis avoids starting/stopping near the threshold.
"""
from __future__ import annotations

import time


def _sample_cpu():
    import psutil
    return psutil.cpu_percent(interval=None)


class CpuHeadroom:
    def __init__(self, *, sample=_sample_cpu, clock=time.monotonic,
                 pause_at=70, resume_below=55):
        self._sample = sample
        self._clock = clock
        self._primed = False
        self._next_sample = 0.0
        self._paused = False
        self.pause_at = pause_at
        self.resume_below = resume_below

    @property
    def waiting(self):
        return self._paused

    def wait(self, stop_event):
        while not stop_event.is_set():
            now = self._clock()
            if now >= self._next_sample:
                try:
                    usage = self._sample()
                except (ImportError, OSError):
                    # Monitoring is optional; ordinary paced work still works.
                    usage = 0
                if not self._primed:
                    self._primed = True
                    self._next_sample = now + .25
                    if stop_event.wait(.25):
                        return False
                    continue  # First nonblocking reading has no usable interval.
                self._paused = usage >= (self.resume_below if self._paused else self.pause_at)
                self._next_sample = now + 1.0
            if not self._paused:
                return not stop_event.is_set()
            stop_event.wait(min(.25, max(0, self._next_sample - self._clock())))
        return False

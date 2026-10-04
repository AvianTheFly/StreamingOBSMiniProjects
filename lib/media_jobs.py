"""Shared CPU budget and cancellation for finite media conversion jobs.

Playback decoders and paced visualizer analysis have their own lifetimes. This
budget owns finite conversions (cuts, previews, audio extraction), so independent
features cannot each assume they have all CPU cores. Callers must also bound the
actual FFmpeg decoder/filter/encoder thread counts to their requested weight.
"""
from __future__ import annotations

from contextlib import contextmanager
import itertools
import subprocess
import threading
import time
from lib.performance_monitor import note_media_load


class MediaJobCancelled(InterruptedError):
    pass


class MediaJobBudget:
    def __init__(self, capacity=3):
        self.capacity = capacity
        self._condition = threading.Condition()
        self._tickets = itertools.count()
        self._waiting = []
        self._active = {}
        self._used = 0
        self._shutdown = None

    def bind(self, stop_event):
        """Bind to the application's lifetime before starting project workers."""
        with self._condition:
            self._shutdown = stop_event
            self._condition.notify_all()

    def _cancelled(self, cancelled):
        return (self._shutdown is not None and self._shutdown.is_set()) or cancelled()

    def status(self):
        with self._condition:
            return dict(capacity=self.capacity, used=self._used,
                        queued=len(self._waiting),
                        active=[dict(item) for item in self._active.values()])

    @contextmanager
    def slot(self, kind, *, weight=1, priority=0, cancelled=lambda: False):
        from events import inspect_event
        inspect_event('conversion.job', owner='conversion', phase='waiting', kind=kind)
        if not 1 <= weight <= self.capacity:
            raise ValueError('Invalid media job CPU weight')
        ticket = (priority, next(self._tickets), weight)
        granted = False
        with self._condition:
            self._waiting.append(ticket)
            self._waiting.sort()
            try:
                while True:
                    if self._cancelled(cancelled):
                        raise MediaJobCancelled('Media job cancelled before starting')
                    if self._waiting[0] == ticket and self._used + weight <= self.capacity:
                        self._used += weight
                        self._active[ticket] = dict(kind=kind, weight=weight, pid=None)
                        granted = True
                        break
                    self._condition.wait(.05)
            finally:
                self._waiting.remove(ticket)
                self._condition.notify_all()
        try:
            inspect_event('conversion.job', owner='conversion', phase='started', kind=kind)
            yield ticket
        finally:
            if granted:
                with self._condition:
                    self._used -= weight
                    self._active.pop(ticket, None)
                    self._condition.notify_all()
                inspect_event('conversion.job', owner='conversion', phase='finished', kind=kind)

    def run(self, args, *, kind, weight=1, priority=0, timeout=300,
            cancelled=lambda: False, text=False, check=False):
        with self.slot(kind, weight=weight, priority=priority, cancelled=cancelled) as ticket:
            if self._cancelled(cancelled):
                raise MediaJobCancelled('Media job cancelled before process creation')
            process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=text, creationflags=(getattr(subprocess, 'CREATE_NO_WINDOW', 0) |
                                         getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)))
            with self._condition:
                self._active[ticket]['pid'] = process.pid
            note_media_load('conversion:' + kind, 'running')
            deadline = time.monotonic() + timeout
            try:
                while True:
                    if self._cancelled(cancelled):
                        raise MediaJobCancelled('Media job cancelled while running')
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise subprocess.TimeoutExpired(args, timeout)
                    try:
                        stdout, stderr = process.communicate(timeout=min(.1, remaining))
                        break
                    except subprocess.TimeoutExpired:
                        continue
                result = subprocess.CompletedProcess(args, process.returncode, stdout, stderr)
                if check:
                    result.check_returncode()
                return result
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.communicate(timeout=1)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.communicate()
                process.stdout.close()
                process.stderr.close()
                note_media_load('conversion:' + kind, 'released')


jobs = MediaJobBudget()

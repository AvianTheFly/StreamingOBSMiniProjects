"""Short-lived, read-only process inventory shared by Hub observers.

No worker or retained OS handles. Windows takes one Toolhelp process snapshot,
instead of querying every process separately for its name/parent/thread count.
Rows are discovery hints, not proof of identity: consumers opening a process
must still validate its creation time or handle PID reuse through psutil.
"""
from dataclasses import dataclass
import os
import threading
import time


@dataclass(frozen=True)
class ProcessEntry:
    pid: int
    name: str
    parent: int
    threads: int


def _windows_snapshot():
    import ctypes as c
    from ctypes import wintypes as w

    class Entry(c.Structure):
        _fields_ = [('size', w.DWORD), ('usage', w.DWORD), ('pid', w.DWORD),
                    ('heap', c.c_size_t), ('module', w.DWORD), ('threads', w.DWORD),
                    ('parent', w.DWORD), ('priority', w.LONG), ('flags', w.DWORD),
                    ('name', w.WCHAR * 260)]

    kernel = c.WinDLL('kernel32', use_last_error=True)
    kernel.CreateToolhelp32Snapshot.argtypes = [w.DWORD, w.DWORD]
    kernel.CreateToolhelp32Snapshot.restype = w.HANDLE
    for name in ('Process32FirstW', 'Process32NextW'):
        fn = getattr(kernel, name)
        fn.argtypes = [w.HANDLE, c.POINTER(Entry)]
        fn.restype = w.BOOL
    kernel.CloseHandle.argtypes = [w.HANDLE]
    kernel.CloseHandle.restype = w.BOOL
    handle = kernel.CreateToolhelp32Snapshot(2, 0)  # TH32CS_SNAPPROCESS
    if handle == c.c_void_p(-1).value:
        raise c.WinError(c.get_last_error())
    try:
        entry = Entry()
        entry.size = c.sizeof(entry)
        rows = []
        available = kernel.Process32FirstW(handle, c.byref(entry))
        while available:
            rows.append(ProcessEntry(entry.pid, entry.name, entry.parent, entry.threads))
            if len(rows) > 16384:
                raise OSError('Process inventory exceeds capacity')
            available = kernel.Process32NextW(handle, c.byref(entry))
        error = c.get_last_error()
        if error != 18:  # ERROR_NO_MORE_FILES; never publish a partial snapshot.
            raise c.WinError(error)
        return tuple(rows)
    finally:
        kernel.CloseHandle(handle)


def _snapshot():
    if os.name == 'nt':
        return _windows_snapshot()
    import psutil
    return tuple(ProcessEntry(p.pid, p.info['name'] or '', p.info['ppid'] or 0,
                              p.info['num_threads'] or 0)
                 for p in psutil.process_iter(['name', 'ppid', 'num_threads']))


class ProcessInventory:
    def __init__(self, *, read=_snapshot, clock=time.monotonic, ttl=1.0):
        self._read, self._clock, self._ttl = read, clock, ttl
        self._lock = threading.Lock()
        self._rows = ()
        self._expires = float('-inf')
        self._error = None

    def snapshot(self):
        with self._lock:
            if self._clock() >= self._expires:
                try:
                    self._rows = tuple(self._read())
                    self._error = None
                except OSError as exc:
                    self._rows = ()
                    self._error = str(exc)
                self._expires = self._clock() + self._ttl
            if self._error is not None:
                raise OSError(self._error)
            return self._rows


inventory = ProcessInventory()
process_snapshot = inventory.snapshot

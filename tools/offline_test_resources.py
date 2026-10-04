"""Standalone test-runner resource policy; never applies to the live Hub.

Serialize suites for one checkout with an OS-owned lock, released on crashes.
Queued suites import expensive test dependencies only after acquiring the slot.
"""
from contextlib import contextmanager
import hashlib
import os
from pathlib import Path
import time


def configure_test_process():
    # Must run before test discovery imports numerical/inference libraries.
    # Respect deliberately supplied environment values.
    for name in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS'):
        os.environ.setdefault(name, '2')
    if os.name == 'nt':
        import psutil
        try:
            psutil.Process().nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
        except (psutil.Error, OSError):
            pass


@contextmanager
def test_run_slot(root):
    identity = hashlib.sha256(os.path.normcase(str(Path(root).resolve())).encode()).hexdigest()
    announced = False
    def waiting():
        nonlocal announced
        if not announced:
            print('Another offline suite is running for this checkout; waiting for its CPU slot.', flush=True)
            announced = True

    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.CreateMutexW.argtypes = (wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR)
        kernel.CreateMutexW.restype = wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes = (wintypes.HANDLE, wintypes.DWORD)
        kernel.WaitForSingleObject.restype = wintypes.DWORD
        kernel.ReleaseMutex.argtypes = (wintypes.HANDLE,)
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        handle = kernel.CreateMutexW(None, False, 'Local\\StreamingHub-offline-tests-' + identity)
        if not handle:
            raise ctypes.WinError(ctypes.get_last_error())
        acquired = False
        try:
            while True:
                result = kernel.WaitForSingleObject(handle, 0)
                if result in (0, 0x80):  # Acquired, or the previous owner crashed.
                    acquired = True
                    break
                if result != 0x102:  # WAIT_TIMEOUT
                    raise ctypes.WinError(ctypes.get_last_error())
                waiting()
                time.sleep(.25)
            yield
        finally:
            if acquired:
                kernel.ReleaseMutex(handle)
            kernel.CloseHandle(handle)
    else:
        import fcntl
        import tempfile
        with open(Path(tempfile.gettempdir()) / ('streaming-hub-tests-' + identity + '.lock'), 'a') as file:
            while True:
                try:
                    fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    waiting()
                    time.sleep(.25)
            try:
                yield
            finally:
                fcntl.flock(file, fcntl.LOCK_UN)

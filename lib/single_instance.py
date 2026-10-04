"""Keep one Hub process per checkout; OS handles release locks after crashes."""
from contextlib import contextmanager
import hashlib
import os
from pathlib import Path


@contextmanager
def hub_instance(root):
    identity = hashlib.sha256(os.path.normcase(str(Path(root).resolve())).encode()).hexdigest()
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.CreateMutexW.argtypes = (wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR)
        kernel.CreateMutexW.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        kernel.CloseHandle.restype = wintypes.BOOL
        handle = kernel.CreateMutexW(None, False, 'Local\\StreamingHub-' + identity)
        if not handle:
            raise ctypes.WinError(ctypes.get_last_error())
        acquired = ctypes.get_last_error() != 183  # ERROR_ALREADY_EXISTS
        try:
            yield acquired
        finally:
            kernel.CloseHandle(handle)
    else:
        import fcntl
        import tempfile
        with open(Path(tempfile.gettempdir()) / ('streaming-hub-' + identity + '.lock'), 'a') as file:
            try:
                fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                yield False
            else:
                try:
                    yield True
                finally:
                    fcntl.flock(file, fcntl.LOCK_UN)

"""Keep the Hub at normal priority so background work cannot starve the desktop.

Uses psutil if available, falls back to ctypes SetPriorityClass on Windows.
Best-effort: any failure is logged and ignored.
"""

from __future__ import annotations

import os


def raise_priority() -> None:
    if _try_psutil():
        return
    if os.name == "nt":
        _try_ctypes_windows()


def _try_psutil() -> bool:
    try:
        import psutil
    except Exception:
        return False
    try:
        proc = psutil.Process()
        target = getattr(psutil, "NORMAL_PRIORITY_CLASS", None)
        if target is None:
            target = 0
        proc.nice(target)
        print("[priority] Hub set to NORMAL priority class.")
        return True
    except Exception as exc:
        print(f"[priority] psutil priority bump failed: {exc}")
        return False


def _try_ctypes_windows() -> None:
    try:
        import ctypes

        NORMAL_PRIORITY_CLASS = 0x00000020
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        if not ctypes.windll.kernel32.SetPriorityClass(handle, NORMAL_PRIORITY_CLASS):
            err = ctypes.windll.kernel32.GetLastError()
            print(f"[priority] SetPriorityClass failed (err {err}).")
            return
        print("[priority] Hub set to NORMAL priority class (ctypes).")
    except Exception as exc:
        print(f"[priority] ctypes priority bump failed: {exc}")

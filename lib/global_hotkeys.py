from __future__ import annotations

import atexit
import json
import os
import queue
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from typing import NamedTuple


KeyCallback = Callable[[object], None]


class KeyEvent(NamedTuple):
    """Key press received from the keyboard worker subprocess.

    Mirrors the pynput Key/KeyCode duck-typed surface that the rest of
    the codebase reads via key_char()/key_token(): .char (str | None) and
    .name (str).
    """

    char: str | None
    name: str


def key_char(key) -> str | None:
    """Return the pressed character when available, else None."""
    char = getattr(key, "char", None)
    if char is None:
        return None
    return str(char)


def key_token(key) -> str:
    """Return a simple token for a key press: char when possible, else key name."""
    char = key_char(key)
    if char is not None:
        return char
    return str(getattr(key, "name", "") or "")


class _SubprocessHotkeyBus:
    """Process-wide keyboard listener backed by a child Python process.

    Why a subprocess: pynput on Windows installs a WH_KEYBOARD_LL low-level
    hook. Windows blocks keyboard input system-wide until the hook callback
    returns, and the callback must acquire the Python GIL to run. If anything
    in the hub's process holds the GIL (Whisper, numpy, etc.) the hook stalls
    and the entire OS's keyboard input stutters — visibly, since OBS hotkeys
    and audio threads also starve. Running the listener in its own Python
    process gives the hook a private GIL and decouples it from hub workload.

    The child emits one JSON line per key press; this bus reads them, wraps
    each in a KeyEvent, and dispatches to subscribed callbacks on a worker
    thread. Public API mirrors the previous pynput-based bus.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._callbacks: dict[int, KeyCallback] = {}
        self._next_token = 1
        self._proc: subprocess.Popen | None = None
        self._queue: queue.Queue[object] = queue.Queue(maxsize=1024)
        self._drop_count = 0
        self._last_drop_log = 0.0

    def subscribe(self, callback: KeyCallback) -> int:
        self._ensure_started()
        with self._lock:
            token = self._next_token
            self._next_token += 1
            self._callbacks[token] = callback
            return token

    def unsubscribe(self, token: int | None) -> None:
        if token is None:
            return
        with self._lock:
            self._callbacks.pop(token, None)

    def shutdown(self) -> None:
        proc = self._proc
        if proc is None:
            return
        self._proc = None
        try:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=2.0)
                except subprocess.TimeoutExpired:
                    proc.kill()
        except Exception:
            pass

    def _ensure_started(self) -> None:
        with self._lock:
            if self._proc is not None and self._proc.poll() is None:
                return

            worker_path = os.path.join(os.path.dirname(__file__), "keyboard_worker.py")
            creationflags = 0
            if os.name == "nt":
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

            try:
                proc = subprocess.Popen(
                    [sys.executable, "-u", worker_path],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    stdin=subprocess.DEVNULL,
                    bufsize=1,
                    text=True,
                    encoding="utf-8",
                    creationflags=creationflags,
                )
            except Exception as exc:
                raise RuntimeError(f"failed to start keyboard worker: {exc}") from exc

            self._proc = proc
            atexit.register(self.shutdown)

            threading.Thread(
                target=self._reader_loop,
                args=(proc,),
                name="global-hotkeys-reader",
                daemon=True,
            ).start()
            threading.Thread(
                target=self._stderr_loop,
                args=(proc,),
                name="global-hotkeys-stderr",
                daemon=True,
            ).start()
            threading.Thread(
                target=self._dispatch_loop,
                name="global-hotkeys-dispatch",
                daemon=True,
            ).start()

            print(f"[hotkeys] Keyboard worker started (pid {proc.pid}).")

    def _reader_loop(self, proc: subprocess.Popen) -> None:
        if proc.stdout is None:
            return
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                event = KeyEvent(char=data.get("char"), name=data.get("name") or "")
            except Exception:
                continue
            try:
                self._queue.put_nowait(event)
            except queue.Full:
                now = time.monotonic()
                self._drop_count += 1
                if now - self._last_drop_log >= 5.0:
                    self._last_drop_log = now
                    print(
                        f"[hotkeys] Dispatch queue full; dropping key presses "
                        f"(total dropped: {self._drop_count})."
                    )
        print("[hotkeys] Keyboard worker stdout closed.")

    def _stderr_loop(self, proc: subprocess.Popen) -> None:
        if proc.stderr is None:
            return
        for line in proc.stderr:
            line = line.rstrip()
            if line:
                print(f"[hotkeys] worker: {line}")

    def _dispatch_loop(self) -> None:
        while True:
            event = self._queue.get()
            with self._lock:
                callbacks = list(self._callbacks.values())
            for callback in callbacks:
                try:
                    callback(event)
                except Exception as exc:
                    print(f"[hotkeys] Callback error: {exc}")


_bus = _SubprocessHotkeyBus()


def subscribe_global_hotkeys(callback: KeyCallback) -> int:
    return _bus.subscribe(callback)


def unsubscribe_global_hotkeys(token: int | None) -> None:
    _bus.unsubscribe(token)


def shutdown_global_hotkeys() -> None:
    _bus.shutdown()

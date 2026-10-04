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
        atexit.register(self.shutdown)

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
        with self._lock:
            proc, self._proc = self._proc, None
        if proc is None:
            return
        self._stop_process(proc)

    @staticmethod
    def _stop_process(proc: subprocess.Popen) -> None:
        try:
            if proc.stdin is not None:
                proc.stdin.close()
            if proc.poll() is None:
                try:
                    proc.wait(timeout=2.0)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=2.0)
        except (OSError, subprocess.SubprocessError) as exc:
            print(f"[hotkeys] Could not stop keyboard worker: {exc}")

    def _ensure_started(self) -> None:
        with self._lock:
            if self._proc is not None and self._proc.poll() is None:
                return
            if self._proc is not None and self._proc.stdin is not None:
                self._proc.stdin.close()

            worker_path = os.path.join(os.path.dirname(__file__), "keyboard_worker.py")
            creationflags = 0
            if os.name == "nt":
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

            try:
                proc = subprocess.Popen(
                    [sys.executable, "-u", worker_path],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    # A pipe owned by this parent lets the child detect even
                    # a forced Hub exit without waiting for another keystroke.
                    stdin=subprocess.PIPE,
                    bufsize=1,
                    text=True,
                    encoding="utf-8",
                    creationflags=creationflags,
                )
            except Exception as exc:
                raise RuntimeError(f"failed to start keyboard worker: {exc}") from exc

            self._proc = proc
            # Each worker owns its queue. An old dispatch thread must never
            # compete for a replacement worker's key presses.
            inbox = self._queue = queue.Queue(maxsize=1024)

            workers = (
                ("dispatch", self._dispatch_loop, (proc, inbox)),
                ("stderr", self._stderr_loop, (proc,)),
                ("reader", self._reader_loop, (proc, inbox)),
            )
            started = set()
            try:
                for name, target, args in workers:
                    threading.Thread(target=target, args=args,
                                     name=f"global-hotkeys-{name}", daemon=True).start()
                    started.add(name)
            except Exception:
                self._proc = None
                self._stop_process(proc)
                if "reader" not in started:
                    if proc.stdout is not None:
                        proc.stdout.close()
                    inbox.put(None)
                if "stderr" not in started and proc.stderr is not None:
                    proc.stderr.close()
                raise

            print(f"[hotkeys] Keyboard worker started (pid {proc.pid}).")

    def _reader_loop(self, proc: subprocess.Popen, inbox: queue.Queue) -> None:
        if proc.stdout is None:
            inbox.put(None)
            return
        try:
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    event = KeyEvent(char=data.get("char"), name=data.get("name") or "")
                except (ValueError, AttributeError):
                    continue
                try:
                    inbox.put_nowait(event)
                except queue.Full:
                    now = time.monotonic()
                    self._drop_count += 1
                    if now - self._last_drop_log >= 5.0:
                        self._last_drop_log = now
                        print(
                            f"[hotkeys] Dispatch queue full; dropping key presses "
                            f"(total dropped: {self._drop_count})."
                        )
        finally:
            proc.stdout.close()
            inbox.put(None)
            print("[hotkeys] Keyboard worker stdout closed.")

    def _stderr_loop(self, proc: subprocess.Popen) -> None:
        if proc.stderr is None:
            return
        try:
            for line in proc.stderr:
                line = line.rstrip()
                if line:
                    print(f"[hotkeys] worker: {line}")
        finally:
            proc.stderr.close()

    def _dispatch_loop(self, proc: subprocess.Popen, inbox: queue.Queue) -> None:
        while True:
            event = inbox.get()
            if event is None:
                return
            with self._lock:
                if self._proc is not proc:
                    continue
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

"""
log.py
======
Thread-safe, level-filtered logging for OBS Hub.

ALL stdout output from every thread is routed through a single writer
thread, preventing the Windows console freeze caused by concurrent
print() calls blocking when the terminal is scrolled.

Log Levels
----------
  DEBUG  Fine-grained diagnostics — hidden by default.
  INFO   High-level events (song started, game detected). Default level.
  WARN   Unexpected but recoverable situations.
  ERROR  Failures that affect visible features.

Enabling verbose output
-----------------------
  Set the environment variable  LOG_LEVEL=DEBUG  before starting the hub:
      set LOG_LEVEL=DEBUG && python main.py       (Windows cmd)
      $env:LOG_LEVEL="DEBUG"; python main.py      (PowerShell)

  Or call at runtime:
      import log; log.set_level(log.DEBUG)

Usage in project files
-----------------------
  import log

  # These respect the current level filter:
  log.info("my_project",  "Song started: 'Rockefeller Street'")
  log.debug("my_project", f"OBS poll state: {state!r}")   # hidden by default
  log.warn("my_project",  "Source not found — check OBS scene name in config.py")
  log.error("my_project", f"Playback failed: {exc}")

  # Regular print() still works and also goes through the writer queue,
  # so the freeze fix applies automatically to all existing code.
"""

from __future__ import annotations

import os
import queue
import sys
import threading

# ── Log level constants ───────────────────────────────────────────────────────
DEBUG = 10
INFO  = 20
WARN  = 30
ERROR = 40

# ── Internal state ────────────────────────────────────────────────────────────
_level: int   = INFO
_q: queue.Queue[str | None] = queue.Queue()
_started      = False
_start_lock   = threading.Lock()
_real_stdout  = sys.stdout   # captured before any interception

_PREFIXES = {
    DEBUG: "DBG",
    INFO:  "   ",
    WARN:  "WRN",
    ERROR: "ERR",
}


# ── Public API ────────────────────────────────────────────────────────────────

def set_level(level: int) -> None:
    """Change the minimum log level shown.  Use log.DEBUG for verbose output."""
    global _level
    _level = level


def start() -> None:
    """
    Install the queue-based stdout interceptor and start the writer thread.

    Call this ONCE from hub main() before spawning any project threads.
    Safe to call multiple times — subsequent calls are no-ops.

    After this call all print() statements from any thread in any project
    automatically benefit from the freeze fix and queue ordering.
    """
    global _started, _level, _real_stdout

    with _start_lock:
        if _started:
            return
        _started = True

    # Apply log level from environment (set before launching the hub).
    env = os.environ.get("LOG_LEVEL", "").upper().strip()
    if env == "DEBUG":
        _level = DEBUG
    elif env == "WARN":
        _level = WARN
    elif env == "ERROR":
        _level = ERROR

    # Start the writer thread BEFORE replacing sys.stdout so the first
    # writes are not lost if there is a brief startup delay.
    t = threading.Thread(target=_writer, daemon=True, name="log-writer")
    t.start()

    # Capture and replace sys.stdout so all print() calls are queued.
    _real_stdout = sys.stdout
    sys.stdout   = _Interceptor(_real_stdout)


def debug(tag: str, msg: str) -> None:
    """Emit a DEBUG message.  Hidden unless LOG_LEVEL=DEBUG."""
    _emit(DEBUG, tag, msg)


def info(tag: str, msg: str) -> None:
    """Emit an INFO message.  Shown by default."""
    _emit(INFO, tag, msg)


def warn(tag: str, msg: str) -> None:
    """Emit a WARN message.  Always shown."""
    _emit(WARN, tag, msg)


def error(tag: str, msg: str) -> None:
    """Emit an ERROR message.  Always shown."""
    _emit(ERROR, tag, msg)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _emit(level: int, tag: str, msg: str) -> None:
    if level < _level:
        return
    prefix = _PREFIXES.get(level, "   ")
    _q.put(f"[{prefix}][{tag}] {msg}\n")


class _Interceptor:
    """
    Replaces sys.stdout.  All writes are forwarded to the log queue so the
    single writer thread handles all I/O — preventing concurrent-write freeze.
    """

    def __init__(self, real) -> None:
        self._real = real

    def write(self, text: str) -> int:
        if text:
            _q.put(text)
        return len(text) if text else 0

    def flush(self) -> None:
        pass  # the writer thread flushes after every message

    def isatty(self) -> bool:
        return False

    def __getattr__(self, name: str):
        # Proxy any attribute not defined here to the real stdout handle.
        return getattr(self._real, name)


def _writer() -> None:
    """
    Single background thread that drains the message queue and writes to the
    real stdout handle.  Only this thread ever calls _real_stdout.write().
    """
    while True:
        try:
            text = _q.get(timeout=2.0)
        except queue.Empty:
            # Periodic flush keeps the console live when output is sparse.
            try:
                _real_stdout.flush()
            except Exception:
                pass
            continue

        if text is None:
            break  # graceful shutdown signal (not currently sent, but available)

        try:
            _real_stdout.write(text)
            _real_stdout.flush()
        except Exception:
            pass

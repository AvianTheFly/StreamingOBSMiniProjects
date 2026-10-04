"""Publish complete JSON files so concurrent readers never see partial writes.

Callers own read/modify/write transaction locks and settings snapshots. Each
write uses its own temporary file in the destination folder, including when
different writers run concurrently.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import time
import threading
from contextlib import contextmanager
from typing import Any

_locks_guard = threading.Lock()
_path_locks = {}


@contextmanager
def json_transaction(path):
    """Serialize an entire read/modify/write for this file within the Hub process."""
    key = os.path.normcase(str(Path(path).resolve()))
    with _locks_guard:
        lock = _path_locks.setdefault(key, threading.RLock())
    with lock:
        yield


def update_json(path, update, *, default=None):
    """Read the latest complete value, apply a pure update, and publish atomically.

    Malformed existing data raises; it is never silently replaced by defaults.
    Settings callers snapshot personal data before invoking this transaction.
    """
    path = Path(path)
    with json_transaction(path):
        current = json.loads(path.read_text(encoding='utf-8')) if path.exists() else default
        value = update(current)
        write_json(path, value)
        return value


def write_json(path: Path, value: Any, *, ensure_ascii: bool = False) -> None:
    with json_transaction(path):
        _write_json(path, value, ensure_ascii=ensure_ascii)


def _write_json(path: Path, value: Any, *, ensure_ascii: bool = False) -> None:
    path = Path(path)
    text = json.dumps(value, indent=2, ensure_ascii=ensure_ascii)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8',
                                         dir=path.parent, prefix=f'.{path.name}.',
                                         suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(text)
        for attempt in range(5):
            try:
                os.replace(temporary, path)
                break
            except PermissionError:
                # Windows readers/scanners can briefly hold a file open
                # without delete sharing. Preserve the old file on failure.
                if attempt == 4:
                    raise
                time.sleep(.01 * 2**attempt)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)

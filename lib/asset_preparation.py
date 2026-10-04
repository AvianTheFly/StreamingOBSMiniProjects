"""Paced preparation of compressed assets, owned by the supported Hub.

One bounded queue and one worker. Metadata lives in the shared RAM cache;
small reads warm Windows' ordinary file cache without retaining a second copy
in Python, opening OBS decoders or changing asset paths/settings. Windows may
reclaim those pages. Warming helps file I/O, not video decoding or encoding.
"""
from __future__ import annotations

from collections import deque
import os
from pathlib import Path
import threading

from lib.media_metadata import probe_media
from lib.shared_media.media_startup import background_media_slot

VIDEO_EXTS = {'.mp4', '.mkv', '.mov', '.m4v', '.ts', '.webm', '.avi', '.flv', '.ogv'}
MEDIA_EXTS = VIDEO_EXTS | {'.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.opus'}


def preparation_budget():
    """Use spare RAM for the OS file cache without assuming every host has 64 GB.

    This bounds bytes read, not reserved or pinned memory. Windows can reclaim
    the pages normally. Keep the budget below 1/32 of installed RAM and 1/16 of
    current available RAM, with a 2 GiB ceiling for large streaming machines.
    """
    try:
        import psutil
        memory = psutil.virtual_memory()
        return max(0, min(2 * 1024**3, memory.total // 32, memory.available // 16))
    except (ImportError, OSError):
        return 512 * 1024**2


class AssetPreparation:
    def __init__(self, *, budget_bytes=None, head_bytes=8 * 1024 * 1024):
        self.budget_bytes = preparation_budget() if budget_bytes is None else budget_bytes
        self.head_bytes = head_bytes
        self._lock = threading.Lock()
        self._pending = deque()
        self._queued = set()
        self._thread = None
        self._wake = threading.Event()
        self._probed = self._warmed = self._failed = 0

    def register(self, paths):
        if os.environ.get('HUB_ASSET_PREPARE', '1') == '0':
            return
        with self._lock:
            for path in paths:
                path = Path(path)
                if path.suffix.lower() not in MEDIA_EXTS or path in self._queued:
                    continue
                if len(self._pending) >= 512:
                    break  # Playback can always fall back to a lazy probe/read.
                self._pending.append(path)
                self._queued.add(path)
        self._wake.set()

    def start(self, stop_event):
        if os.environ.get('HUB_ASSET_PREPARE', '1') == '0':
            return None
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return self._thread
            self._thread = threading.Thread(target=self._run, args=(stop_event,),
                                            name='asset-preparation', daemon=True)
            self._thread.start()
            return self._thread

    def status(self):
        with self._lock:
            return dict(queued=len(self._pending), probed=self._probed,
                        warmed_mb=round(self._warmed / 1048576, 1),
                        budget_mb=round(self.budget_bytes / 1048576, 1), failures=self._failed)

    def _prepare(self, path, stop_event):
        if path.suffix.lower() in VIDEO_EXTS:
            with background_media_slot(stop_event) as allowed:
                if not allowed:
                    return
                probe_media(path)
                with self._lock:
                    self._probed += 1
        with self._lock:
            remaining = min(self.head_bytes, max(0, self.budget_bytes - self._warmed))
        if not remaining:
            return
        with path.open('rb') as stream:
            while remaining and not stop_event.is_set():
                with background_media_slot(stop_event) as allowed:
                    if not allowed:
                        return
                    read = len(stream.read(min(1024 * 1024, remaining)))
                if not read:
                    break
                remaining -= read
                with self._lock:
                    self._warmed += read
                if stop_event.wait(.02):
                    return

    def _run(self, stop_event):
        while not stop_event.is_set():
            with self._lock:
                path = self._pending.popleft() if self._pending else None
                if path is None:
                    self._wake.clear()
            if path is None:
                self._wake.wait(.25)
                continue
            try:
                self._prepare(path, stop_event)
            except Exception:
                with self._lock:
                    self._failed += 1
            finally:
                with self._lock:
                    self._queued.discard(path)
            stop_event.wait(.15)


preparation = AssetPreparation()

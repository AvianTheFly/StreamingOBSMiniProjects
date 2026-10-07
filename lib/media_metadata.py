"""One bounded RAM cache for layout and decoder metadata.

Cache compressed-file metadata rather than decoded frames. File size and
nanosecond modification time invalidate edits. A single probe runs at a time;
cached playback/layout reads do not queue behind unrelated cache misses.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from collections import OrderedDict
from fractions import Fraction
import json
from pathlib import Path
import subprocess
import threading
import time

_probe_lock = threading.Lock()
_cache_lock = threading.Lock()
_cache = OrderedDict()
_cache_generation = 0
_CACHE_LIMIT = 512
_store = None
_cache_revision = 0


@dataclass(frozen=True)
class MediaMetadata:
    codec: str = ''
    width: int = 0
    height: int = 0
    fps: float = 0

    @property
    def dimension_key(self):
        return f'{self.width}x{self.height}' if self.width and self.height else ''


def _read_metadata(path: str) -> MediaMetadata:
    proc = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
         'stream=codec_name,width,height,avg_frame_rate', '-of', 'json', path],
        capture_output=True, text=True, timeout=3,
        creationflags=(getattr(subprocess, 'CREATE_NO_WINDOW', 0) |
                       getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)))
    if proc.returncode:
        raise ValueError('Media metadata unavailable')
    streams = json.loads(proc.stdout or '{}').get('streams') or []
    if not streams:
        return MediaMetadata()
    stream = streams[0]
    try:
        fps = float(Fraction(stream.get('avg_frame_rate') or '0'))
    except (ValueError, ZeroDivisionError):
        fps = 0
    return MediaMetadata(codec=str(stream.get('codec_name') or ''),
                         width=int(stream.get('width') or 0),
                         height=int(stream.get('height') or 0), fps=fps)


def probe_media(path: str | Path) -> MediaMetadata:
    global _cache_revision
    path = Path(path).resolve()
    stat = path.stat()
    key = (str(path), stat.st_mtime_ns, stat.st_size)
    with _cache_lock:
        result = _cached(key)
        if result is not None:
            return result
    # Recheck after admission: callers sharing a miss still launch just one
    # probe, while all cached reads use only the short cache lock above.
    with _probe_lock:
        with _cache_lock:
            result = _cached(key)
            if result is not None:
                return result
            generation = _cache_generation
        result = _read_metadata(str(path))
        with _cache_lock:
            if generation == _cache_generation:
                _cache[key] = result
                _cache_revision += 1
                while len(_cache) > _CACHE_LIMIT:
                    _cache.popitem(last=False)
    flush_metadata_cache()
    return result


def _cached(key):
    """Caller holds the cache lock; metadata values are immutable."""
    result = _cache.get(key)
    if result is not None:
        _cache.move_to_end(key)
    return result


def clear_metadata_cache():
    global _cache_generation, _cache_revision
    with _cache_lock:
        _cache_generation += 1
        _cache.clear()
        _cache_revision += 1
    flush_metadata_cache(force=True)


def configure_metadata_cache(path=None):
    """Hydrate derived metadata once during Hub startup, before feature imports.

    Exact file path/mtime/size keys are still checked on every normal lookup.
    Passing None disables disk persistence without discarding current RAM state.
    """
    global _store, _cache_generation, _cache_revision
    from lib.media_metadata_store import MetadataStore
    store = MetadataStore(path) if path is not None else None
    rows = store.load() if store else []
    with _cache_lock:
        _store = store
        _cache_generation += 1
        _cache_revision += 1
        for row in rows:
            key = (row['path'],row['mtime_ns'],row['size'])
            _cache.setdefault(key,MediaMetadata(**row['metadata']))
        while len(_cache) > _CACHE_LIMIT:
            _cache.popitem(last=False)


def flush_metadata_cache(*, force=False):
    """Coalesce writes to at most one per two seconds; cached reads never wait."""
    store = _store
    if store is None:
        return
    with store.lock:
        if not force and time.monotonic() < store.next_save:
            return
        with _cache_lock:
            if store is not _store:
                return
            revision = _cache_revision
            if store.saved_revision == revision:
                return
            rows = [dict(path=key[0],mtime_ns=key[1],size=key[2],metadata=asdict(value))
                    for key,value in _cache.items()]
        # No cache/probe lock is held during disk I/O. A concurrent clear waits
        # on this publisher and then snapshots the new generation, never stale rows.
        if store.save(rows):
            store.saved_revision = revision

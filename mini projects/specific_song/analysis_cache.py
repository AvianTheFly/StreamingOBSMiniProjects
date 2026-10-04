"""Disposable spectral data, separate from original media and personal settings."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import tempfile

import numpy as np

VERSION = 1
COLUMNS = 7  # RMS and six compressed spectral bands; preserve float64 precision.
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_CACHE_BYTES = 256 * 1024 * 1024


class AnalysisCache:
    def __init__(self, source, sample_rate, block_size, bass_low, bass_high, *, root=None):
        self.source = Path(source).resolve()
        self.signature = self._signature()
        identity = [VERSION, str(self.source), *self.signature,
                    sample_rate, block_size, bass_low, bass_high]
        digest = hashlib.sha256(json.dumps(identity).encode()).hexdigest()
        self.root = Path(root) if root else (
            Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'StreamingHub' / 'song-analysis')
        self.path = self.root / (digest + '.npy')

    def _signature(self):
        info = self.source.stat()
        return info.st_mtime_ns, info.st_size

    def load(self):
        data = None
        try:
            if self._signature() != self.signature or self.path.stat().st_size > MAX_FILE_BYTES:
                return None
            data = np.load(self.path, mmap_mode='r', allow_pickle=False)
            if data.dtype != np.float64 or data.ndim != 2 or data.shape[1] != COLUMNS or not len(data):
                raise ValueError('Invalid analysis shape')
            if not np.isfinite(data).all():
                raise ValueError('Invalid analysis values')
            try:
                self.path.touch()  # LRU without keeping full tracks in Python memory.
            except OSError:
                pass
            return data
        except (OSError, ValueError, EOFError):
            if data is not None:
                close_analysis(data)
            return None

    def save(self, rows):
        data = np.asarray(rows, dtype=np.float64).reshape(-1, COLUMNS)
        if not len(data) or data.nbytes + 1024 > MAX_FILE_BYTES or self._signature() != self.signature:
            return False
        temporary = None
        try:
            self.root.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=self.root, suffix='.tmp', delete=False) as output:
                temporary = Path(output.name)
                np.save(output, data, allow_pickle=False)
            os.replace(temporary, self.path)
            self._prune()
            return True
        except OSError:
            return False  # A read-only/full cache must never prevent normal playback.
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def _prune(self):
        files = []
        for path in self.root.glob('*.npy'):
            if len(path.stem) == 64 and all(c in '0123456789abcdef' for c in path.stem):
                info = path.stat()
                files.append((info.st_mtime_ns, info.st_size, path))
        total = sum(row[1] for row in files)
        for _, size, path in sorted(files):
            if total <= MAX_CACHE_BYTES:
                break
            if path == self.path:
                continue
            try:
                path.unlink()
                total -= size
            except OSError:
                pass  # A currently mapped track can be evicted on a later pass.


def close_analysis(data):
    mapping = getattr(data, '_mmap', None)
    if mapping is not None:
        mapping.close()

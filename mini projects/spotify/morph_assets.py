"""Feature-owned prepared geometry publication; the existing HTTP owner serves it.

One server-lifetime byte cache. Source changes invalidate derived tables, never
the personal settings or runtime renderer. No imports start work or write files.
"""
import hashlib
import json
import threading
from pathlib import Path

RECIPE_FILES = ('stage_geometry.js', 'stage_palette.js', 'stage_designs.js',
                'stage_morph.js', 'morph_cache.js')
MAX_BYTES = 256 * 1024 * 1024


def recipe_hash(web):
    digest = hashlib.sha256()
    for name in RECIPE_FILES:
        digest.update(name.encode() + b'\0')
        digest.update((web / name).read_bytes().replace(b'\r\n', b'\n') + b'\0')
    return digest.hexdigest()


class PreparedMorphs:
    def __init__(self, web):
        self.web = Path(web)
        self.signature = None
        self.payload = None
        self.lock = threading.Lock()

    def read(self):
        with self.lock:
            return self._read()

    def _read(self):
        paths = [self.web / name for name in (*RECIPE_FILES, 'prepared-morphs.json')]
        try:
            signature = tuple((p.stat().st_mtime_ns, p.stat().st_size) for p in paths)
            if signature != self.signature:
                self.payload = None
                target = paths[-1]
                if target.stat().st_size > MAX_BYTES:
                    return None
                payload = target.read_bytes()
                if len(payload) > MAX_BYTES:
                    return None
                data = json.loads(payload)
                if data.get('schema') == 1 and data.get('recipe_hash') == recipe_hash(self.web):
                    self.payload = payload
                self.signature = signature
            return self.payload
        except (OSError,ValueError,TypeError,AttributeError):
            self.signature = None
            self.payload = None
            return None

"""Bounded, disposable metadata persistence; never media or personal settings.

The RAM cache supplies complete snapshots. This owner serializes publications,
validates disk data and uses atomic JSON replacement. No worker/connection is
created on import or construction. Disk errors only forgo a cache optimization.
"""
import json
import math
from pathlib import Path
import threading
import time
from lib.json_store import write_json

MAX_BYTES = 2 * 1024 * 1024
MAX_ENTRIES = 512


def valid_row(row):
    if not isinstance(row, dict) or set(row) != {'path','mtime_ns','size','metadata'}:
        return False
    if not isinstance(row['path'], str) or not 0 < len(row['path']) <= 4096:
        return False
    if not Path(row['path']).is_absolute():
        return False
    if any(type(row[k]) is not int or row[k] < 0 for k in ('mtime_ns','size')):
        return False
    value = row['metadata']
    return (isinstance(value,dict) and set(value) in
            ({'codec','width','height','fps'}, {'codec','width','height','fps','has_audio'})
            and (value.get('has_audio') is None or type(value.get('has_audio')) is bool)
            and isinstance(value['codec'],str) and len(value['codec']) <= 64
            and all(type(value[k]) is int and 0 <= value[k] <= 65536 for k in ('width','height'))
            and type(value['fps']) in (int,float) and math.isfinite(value['fps'])
            and 0 <= value['fps'] <= 1000)


class MetadataStore:
    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.Lock()
        self.next_save = 0.0
        self.saved_revision = None

    def load(self):
        try:
            with self.path.open('rb') as stream:
                encoded = stream.read(MAX_BYTES + 1)
            if len(encoded) > MAX_BYTES:
                return []
            data = json.loads(encoded)
            if not isinstance(data,dict) or data.get('version') != 1 or not isinstance(data.get('entries'),list):
                return []
            return [row for row in data['entries'][-MAX_ENTRIES:] if valid_row(row)]
        except (OSError,ValueError,TypeError,OverflowError):
            return []

    def save(self, rows):
        """Caller owns lock and copies current RAM state after taking that lock."""
        self.next_save = time.monotonic() + 2
        try:
            rows = [row for row in rows[-MAX_ENTRIES:] if valid_row(row)]
            data = dict(version=1, entries=rows)
            if len(json.dumps(data,ensure_ascii=True,indent=2).encode('utf-8')) > MAX_BYTES:
                return False  # Unusual paths can exceed the byte bound; RAM still works.
            self.path.parent.mkdir(parents=True,exist_ok=True)
            write_json(self.path,data,ensure_ascii=True)
            return True
        except (OSError,ValueError,TypeError,OverflowError):
            return False

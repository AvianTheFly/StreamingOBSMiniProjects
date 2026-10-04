"""Editor metadata projection; expensive probes belong to lib.media_metadata."""
from pathlib import Path
from .context import _VIDEO_EXTS
from lib.shared_media.layout_rules import probe_dimension_key

def _probe_media_dimensions(path: Path) -> dict:
    if path.suffix.lower() not in _VIDEO_EXTS:
        return {}
    key = probe_dimension_key(path)
    if not key:
        return {}
    width, height = key.split('x')
    return {'width': int(width), 'height': int(height), 'dimension_key': key}

"""Read producer-authored review exclusions without importing a media feature.

The portable catalog contract is {clips: {id: {path, purpose}}}. Explicit
replay_only rows are omitted from automatic review; older/unknown rows remain.
This reader never writes or changes personal review decisions.
"""
import json
from pathlib import Path


def excluded_paths(catalog):
    catalog = Path(catalog)
    if not catalog.exists():
        return frozenset()
    data = json.loads(catalog.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or not isinstance(data.get('clips'), dict):
        raise ValueError('The media purpose catalog needs recovery; its data is preserved.')
    return frozenset(str(Path(row['path']).resolve()).casefold()
                     for row in data['clips'].values()
                     if isinstance(row, dict) and row.get('purpose') == 'replay_only' and row.get('path'))

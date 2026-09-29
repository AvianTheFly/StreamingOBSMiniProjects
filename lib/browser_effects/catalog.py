"""Per-module effect mappings; independent from profiles and saved OBS asset data."""
import json
import math
from pathlib import Path


def load_catalog(project_dir):
    try:
        data = json.loads((Path(project_dir)/'browser_effects.json').read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def effect_for(project_dir, stem):
    value = next((v for k,v in load_catalog(project_dir).items() if k.casefold() == stem.casefold()), None)
    if not isinstance(value, dict) or value.get('renderer') != 'muffins':
        return None
    bpm = value.get('bpm', 126)
    if not isinstance(bpm, (int, float)) or not math.isfinite(bpm) or not 30 <= bpm <= 300:
        return None
    return value

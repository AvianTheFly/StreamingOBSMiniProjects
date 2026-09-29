"""Per-module effect mappings; independent from profiles and saved OBS asset data."""
import json
import math
import re
from pathlib import Path


def load_catalog(project_dir):
    try:
        data = json.loads((Path(project_dir)/'browser_effects.json').read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def effect_for(project_dir, stem):
    value = next((v for k,v in load_catalog(project_dir).items() if k.casefold() == stem.casefold()), None)
    if not isinstance(value, dict) or value.get('renderer') not in {'muffins', 'borders'}:
        return None
    bpm = value.get('bpm', 126)
    if not isinstance(bpm, (int, float)) or not math.isfinite(bpm) or not 30 <= bpm <= 300:
        return None
    if value['renderer'] == 'borders' and value.get('style') not in {'confetti', 'oops', 'arena', 'bonk', 'sparkles', 'disco', 'coffin', 'party', 'crabs', 'balloons', 'rats', 'raccoon', 'shades', 'racing', 'equalizer', 'cats'}:
        return None
    if 'label' in value and (not isinstance(value['label'], str) or len(value['label']) > 64):
        return None
    if 'color' in value and (not isinstance(value['color'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', value['color'])):
        return None
    return value

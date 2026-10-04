"""Personal presentation preferences, separate from clip metadata and audio."""
import copy
import json
from pathlib import Path

from lib.json_store import update_json
from lib.settings_backups import SettingsBackups

FILE = Path(__file__).with_name('presentation_settings.json')
DEFAULTS = {'replay': {'companion': 'live', 'camera': True, 'transition': 'move', 'clip_transition': 'sweep'},
            'showcase': {'companion': 'off', 'camera': True, 'transition': 'current', 'clip_transition': 'iris'},
            'motion': True}


def read():
    raw = json.loads(FILE.read_text(encoding='utf-8')) if FILE.exists() else {}
    if not isinstance(raw, dict):
        raise ValueError('Replay presentation settings must be an object; the original file is preserved.')
    result = copy.deepcopy(raw)
    for mode in ('replay', 'showcase'):
        value = raw.get(mode, {})
        if not isinstance(value, dict):
            raise ValueError(f'Replay {mode} settings must be an object; the original file is preserved.')
        result[mode] = {**DEFAULTS[mode], **value}
    result.setdefault('motion', True)
    return result


def save(changes):
    allowed = {'replay', 'showcase', 'motion'}
    if not isinstance(changes, dict) or set(changes) - allowed:
        raise ValueError('Choose replay, showcase or motion preferences.')
    for mode in ('replay', 'showcase'):
        if mode not in changes:
            continue
        value = changes[mode]
        if not isinstance(value, dict) or set(value) - {'companion', 'transition', 'camera', 'clip_transition'}:
            raise ValueError('Choose side views and transitions.')
        if 'companion' in value and value['companion'] not in ('live', 'desktop', 'off'):
            raise ValueError('Choose live, desktop or off.')
        if 'transition' in value and value['transition'] not in ('move', 'wipe', 'fade', 'cut', 'current'):
            raise ValueError('Choose move, wipe, fade, cut or current OBS transition.')
        if 'camera' in value and not isinstance(value['camera'], bool):
            raise ValueError('Camera must be on or off.')
        if 'clip_transition' in value and value['clip_transition'] not in ('sweep', 'iris', 'fade', 'cut'):
            raise ValueError('Choose sweep, iris, fade or cut between clips.')
    if 'motion' in changes and not isinstance(changes['motion'], bool):
        raise ValueError('Motion must be on or off.')
    SettingsBackups().snapshot()

    def merge(current):
        if not isinstance(current, dict):
            raise ValueError('Existing replay settings are malformed; the original file is preserved.')
        updated = copy.deepcopy(current)
        for key, value in changes.items():
            if key == 'motion':
                updated[key] = value
            else:
                old = updated.get(key, {})
                if not isinstance(old, dict):
                    raise ValueError('Existing replay settings are malformed; the original file is preserved.')
                updated[key] = {**old, **value}
        return updated

    update_json(FILE, merge, default={})
    return read()

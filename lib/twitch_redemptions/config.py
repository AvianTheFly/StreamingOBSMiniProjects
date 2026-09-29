"""Validated appearance overrides; never replace reward IDs, prices or credentials."""
import re
from copy import deepcopy
from .catalog import EFFECTS

STYLES = ('pop', 'oops', 'cannon', 'calculated', 'fear', 'party')


def effect_config(config, key):
    effect = dict(EFFECTS[key], enabled=True)
    effect['style'] = {'bear': 'pop'}.get(key, key)
    effect.update(config.get('effects', {}).get(key, {}))
    return effect


def validate_override(value):
    if not isinstance(value, dict) or set(value) - {'duration', 'label', 'color', 'style', 'enabled'}:
        raise ValueError('Unknown effect setting.')
    result = dict(value)
    if 'duration' in result and (type(result['duration']) is not int or not 400 <= result['duration'] <= 2000):
        raise ValueError('Quick effects must last between 400 and 2000 milliseconds.')
    if 'label' in result and (not isinstance(result['label'], str) or len(result['label']) > 32):
        raise ValueError('Labels must have at most 32 characters.')
    if 'color' in result and (not isinstance(result['color'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', result['color'])):
        raise ValueError('Choose a six-digit hex color.')
    if 'style' in result and result['style'] not in STYLES:
        raise ValueError('Unknown animation style.')
    if 'enabled' in result and type(result['enabled']) is not bool:
        raise ValueError('Enabled must be true or false.')
    return result


def configure_effect(bridge, key, value):
    if key not in EFFECTS:
        raise ValueError('Unknown reward.')
    override = validate_override(value)
    with bridge.lock:
        updated = deepcopy(bridge.config)
        updated.setdefault('effects', {}).setdefault(key, {}).update(override)
        bridge._write('settings.json', updated)
        bridge.config = updated
        bridge.paused_remote = None
    return effect_config(bridge.config, key)

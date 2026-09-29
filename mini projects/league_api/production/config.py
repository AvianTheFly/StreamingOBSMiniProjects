"""Validated production controls. Original clip settings remain untouched."""
import copy
import json
import math

DEFAULTS = dict(revision=0, enabled=False, dragon_ambience=True, objectives=True,
                combat=True, structures=True, opacity=.8, edge_width=56,
                burst_seconds=2.7, spacing_seconds=4)


def validate(settings):
    result = copy.deepcopy(settings)
    if set(result) - set(DEFAULTS):
        raise ValueError('Unknown production setting')
    if type(result['revision']) is not int or result['revision'] < 0:
        raise ValueError('Invalid production revision')
    for key in ('enabled', 'dragon_ambience', 'objectives', 'combat', 'structures'):
        if type(result[key]) is not bool:
            raise ValueError(key + ' must be true or false')
    for key, low, high in (('opacity', .2, 1), ('edge_width', 24, 84),
                           ('burst_seconds', 1, 5), ('spacing_seconds', 1, 30)):
        value = result[key]
        if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f'{key} must be between {low} and {high}')
    return result


class ProductionSettings:
    def __init__(self, path):
        self.path = path

    def load(self):
        saved = json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {}
        return validate({**DEFAULTS, **saved})

    def save(self, current, body):
        if body.get('revision') != current['revision']:
            raise ValueError('Production settings changed. Reload before saving.')
        patch = body.get('settings', {})
        if not isinstance(patch, dict) or 'revision' in patch:
            raise ValueError('Invalid production settings')
        updated = validate({**current, **patch})
        updated['revision'] += 1
        from lib.settings_backups import SettingsBackups
        SettingsBackups().snapshot()
        temp = self.path.with_suffix('.tmp')
        temp.write_text(json.dumps(updated, indent=2) + '\n', encoding='utf-8')
        temp.replace(self.path)
        return updated

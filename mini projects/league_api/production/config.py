"""Validated production controls. Original clip settings remain untouched."""
import copy
import json
import math

DEFAULTS = dict(revision=0, enabled=False, dragon_ambience=True, objectives=True,
                combat=True, structures=True, opacity=.8, edge_width=56,
                burst_seconds=2.7, spacing_seconds=4, survival=True, progression=True,
                economy=True, lifecycle=True, inferred=False, custom_rules=True,
                intensity=1.15, event_options={})


def validate(settings):
    result = copy.deepcopy(settings)
    if set(result) - set(DEFAULTS):
        raise ValueError('Unknown production setting')
    if type(result['revision']) is not int or result['revision'] < 0:
        raise ValueError('Invalid production revision')
    for key in ('enabled', 'dragon_ambience', 'objectives', 'combat', 'structures',
                'survival', 'progression', 'economy', 'lifecycle', 'inferred', 'custom_rules'):
        if type(result[key]) is not bool:
            raise ValueError(key + ' must be true or false')
    for key, low, high in (('opacity', .2, 1), ('edge_width', 24, 84),
                           ('burst_seconds', 1, 5), ('spacing_seconds', 1, 30), ('intensity', .5, 1.6)):
        value = result[key]
        if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f'{key} must be between {low} and {high}')
    from .catalog import valid_key
    options=result['event_options']
    if not isinstance(options,dict) or len(options)>200: raise ValueError('Invalid event controls')
    for key,patch in options.items():
        if not valid_key(key) or not isinstance(patch,dict) or set(patch)-{'enabled','intensity','duration'}:
            raise ValueError('Unknown event control')
        if 'enabled' in patch and type(patch['enabled']) is not bool: raise ValueError('Invalid event toggle')
        for field,low,high in [('intensity',.3,1.6),('duration',.6,5)]:
            if field in patch and (type(patch[field]) not in (int,float) or not math.isfinite(patch[field]) or not low<=patch[field]<=high):
                raise ValueError(f'Event {field} must be between {low} and {high}')
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

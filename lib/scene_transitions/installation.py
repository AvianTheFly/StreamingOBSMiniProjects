"""Pure collection policy shared by finite open/closed-OBS maintenance adapters."""
from __future__ import annotations
import copy
from pathlib import Path

NAME = 'Hub Spirit Transitions'
SPIRITS = ('bear', 'turtle', 'ram', 'phoenix')
CLIPS = {s + suffix for s in SPIRITS for suffix in ('', '-alt')}


def select_collection_file(files, collection_name, configured_file=None):
    """Select from filename/name metadata without editing any saved collection.

    OBS's active filename disambiguates personal copies sharing the same name.
    A configured filename is authoritative only when its internal name agrees.
    """
    if configured_file:
        filename = str(configured_file)
        if not filename.endswith('.json'):
            filename += '.json'
        if Path(filename).name != filename or files.get(filename) != collection_name:
            raise ValueError('Configured active collection filename/name do not match')
        return filename
    matches = [filename for filename, name in files.items() if name == collection_name]
    if len(matches) != 1:
        raise ValueError('Cannot uniquely identify the active collection file')
    return matches[0]


def validate_manifest(manifest):
    if set(manifest['spirits']) != set(SPIRITS) or set(manifest['clips']) != CLIPS:
        raise ValueError('A complete export needs all eight separate performances')
    for spirit in SPIRITS:
        timing = manifest['animations'][spirit]
        if not 0 <= timing['coveredFrom'] + .05 < timing['cut'] < timing['coveredUntil'] - .05 <= manifest['duration']:
            raise ValueError(f'{spirit}: cut must have verified opaque safety margins')


def patch_collection(current, media, manifest, script, *, select=True, require_existing=False):
    """Return a complete new generation; preserve all unrelated personal fields."""
    validate_manifest(manifest)
    data = copy.deepcopy(current)
    transitions = data.setdefault('transitions', [])
    transition = next((x for x in transitions if x.get('name') == NAME), None)
    if transition and transition.get('id') not in {'obs_stinger_transition', 'hub_spirit_transition'}:
        raise ValueError('The transition name belongs to another transition type')
    if transition is None:
        if require_existing:
            raise ValueError('Closed-OBS updates require an already installed transition')
        transition = {'name': NAME, 'volume': 1.0, 'balance': .5, 'enabled': True,
                      'muted': False, 'mixers': 255, 'sync': 0, 'flags': 0, 'private_settings': {}}
        transitions.append(transition)
    transition['id'] = transition['versioned_id'] = 'hub_spirit_transition'
    settings = transition.setdefault('settings', {})
    settings.update(directory=Path(media).as_posix(), variant_count=2,
                    cut_ms=manifest['cut_ms'], duration_ms=round(manifest['duration'] * 1000))
    for spirit, timing in manifest['animations'].items():
        low, high = round(timing['coveredFrom'] * 1000), round(timing['coveredUntil'] * 1000)
        value = settings.get(f'{spirit}_cut_ms', round(timing['cut'] * 1000))
        settings[f'{spirit}_cut_ms'] = max(low + 50, min(high - 50, value))
        settings[f'{spirit}_covered_from_ms'] = low
        settings[f'{spirit}_covered_until_ms'] = high
    scripts = data.setdefault('modules', {}).setdefault('scripts-tool', [])
    script = Path(script).as_posix()
    entry = next((x for x in scripts if x.get('path', '').replace('\\', '/') == script), None)
    if entry is None:
        entry = {'path': script, 'settings': {}}
        scripts.append(entry)
    entry['settings'].update(directory=Path(media).as_posix(), transition_name=NAME, enabled=False)
    if select:
        data['current_transition'] = NAME
    return data

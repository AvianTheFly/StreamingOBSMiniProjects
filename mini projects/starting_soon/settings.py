"""Transactional personal configuration and named playlists, with legacy preservation."""
import copy
import json
from pathlib import Path
from .config import SETTINGS, ART
from .layouts import validate_choice
from .looks import validate as validate_looks
from lib.json_store import update_json
from lib.settings_backups import SettingsBackups

DEFAULTS = dict(title='STREAM STARTING SOON', subtitle='Gather by the fire. The next adventure is almost here.',
                rotation_seconds=35, artwork=['fjord.png', 'forest.png', 'mountain.png'],
                playlist=[], loop=True, shuffle=False, gap_seconds=5, rotate_artwork=True,
                layout='preserve', custom_box={'x':690, 'y':320, 'width':1144}, clip_layouts={},
                active_playlist_id='main', revision=0, show_message=True, show_footer=True,
                highlights_enabled=True, transition_style='dissolve', motion='still', saved_looks=[])


class Conflict(ValueError):
    pass


def _paths(value):
    if (not isinstance(value, list) or len(value) > 500 or
            any(not isinstance(v, str) or not v or len(v) > 3000 for v in value)):
        raise ValueError('A playlist must contain at most 500 file paths.')


def _expanded(data):
    if not isinstance(data, dict):
        raise ValueError('Starting Soon settings need recovery; the original file is untouched.')
    result = {**copy.deepcopy(DEFAULTS), **data}
    if 'playlists' not in result:
        _paths(result['playlist'])
        result['playlists'] = [dict(id='main', name='My waiting room', paths=list(result['playlist']))]
    return result


def read(path=SETTINGS):
    data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    result = _expanded(data)
    _validate(result, check_files=False)
    return result


def _validate(data, *, check_files):
    validate_looks(data['saved_looks'])
    for key in ('title', 'subtitle'):
        if not isinstance(data[key], str) or len(data[key]) > 180:
            raise ValueError('Titles must be text up to 180 characters.')
    for key, low, high in [('rotation_seconds',10,600), ('gap_seconds',0,120)]:
        value = data[key]
        if isinstance(value, bool) or not isinstance(value, (int,float)) or not low <= value <= high:
            raise ValueError(f'{key} must be between {low} and {high}.')
    for key in ('loop','shuffle','rotate_artwork','show_message','show_footer','highlights_enabled'):
        if not isinstance(data[key], bool):
            raise ValueError(key + ' must be true or false.')
    if data['transition_style'] not in ('dissolve','portal','gates','embers'):
        raise ValueError('Choose an available artwork transition.')
    if data['motion'] not in ('still','drift'):
        raise ValueError('Choose still or gentle drift.')
    _paths(data['playlist'])
    arts = data['artwork']
    if (not isinstance(arts,list) or not arts or len(arts)>100 or
            any(not isinstance(v,str) or v != Path(v).name for v in arts)):
        raise ValueError('Select at least one background.')
    if check_files and any(not (ART/v).is_file() for v in arts):
        raise ValueError('Select available artwork files.')
    lists = data['playlists']
    if not isinstance(lists,list) or not 1 <= len(lists) <= 30:
        raise ValueError('Keep between 1 and 30 named playlists.')
    identifiers, names = set(), set()
    for item in lists:
        if not isinstance(item,dict):
            raise ValueError('Malformed playlist; original data is untouched.')
        identifier, name = item.get('id'), item.get('name')
        if not isinstance(identifier,str) or not identifier or len(identifier)>80 or identifier in identifiers:
            raise ValueError('Every playlist needs a unique ID.')
        if not isinstance(name,str) or not name.strip() or len(name)>80 or name.strip().casefold() in names:
            raise ValueError('Give each playlist a unique name (up to 80 characters).')
        _paths(item.get('paths'))
        identifiers.add(identifier); names.add(name.strip().casefold())
    if data['active_playlist_id'] not in identifiers:
        raise ValueError('Choose an existing playlist.')
    validate_choice(data)
    if not isinstance(data['clip_layouts'],dict) or len(data['clip_layouts'])>500:
        raise ValueError('Clip placements must be an asset map with at most 500 entries.')
    for path, choice in data['clip_layouts'].items():
        if not isinstance(path,str) or not path:
            raise ValueError('Invalid clip placement path.')
        validate_choice(choice)


def save(changes, path=SETTINGS):
    clean = {k:v for k,v in changes.items() if k in DEFAULTS or k=='playlists'}
    expected = clean.pop('revision', None)
    SettingsBackups().snapshot()
    def merge(current):
        current = _expanded(current)
        _validate(current, check_files=False)
        if expected is not None and expected != current['revision']:
            raise Conflict('Settings changed in another window. Reload before saving your edits.')
        data = {**current, **clean}
        if 'saved_looks' in clean and isinstance(clean['saved_looks'],list):
            previous={look['id']:look for look in current['saved_looks']}
            data['saved_looks']=[]
            for value in clean['saved_looks']:
                if not isinstance(value,dict):
                    data['saved_looks'].append(value)
                    continue
                old=previous.get(value.get('id'),{})
                merged={**old,**value}
                if isinstance(value.get('settings'),dict):
                    merged['settings']={**old.get('settings',{}),**value['settings']}
                data['saved_looks'].append(merged)
        _validate(data, check_files='artwork' in clean)
        if 'playlists' in clean and isinstance(clean['playlists'],list):
            previous = {p['id']:p for p in current['playlists']}
            data['playlists'] = [{**previous.get(p.get('id'),{}), **p} if isinstance(p,dict) else p
                                 for p in clean['playlists']]
        elif 'playlist' in clean:
            data['playlists'] = [{**p, 'paths':clean['playlist']} if p['id']==data['active_playlist_id']
                                 else p for p in current['playlists']]
        _validate(data, check_files='artwork' in clean)
        data['playlist'] = list(next(p['paths'] for p in data['playlists'] if p['id']==data['active_playlist_id']))
        data['revision'] = current['revision'] + 1
        return data
    return update_json(path, merge, default={})


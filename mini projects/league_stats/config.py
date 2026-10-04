"""Validate tracker preferences independently of match history and other modules."""
import json
import re
import copy
from pathlib import Path
from lib.json_store import update_json
from lib.settings_backups import SettingsBackups

EDITOR_DISABLED = True
PATH = Path(__file__).parent / 'settings.json'
DEFAULTS = dict(allow_moderators=True, helpers=[], cooldown_seconds=15,
                helper_enabled=True, include_custom=False, region='na1',
                custom_counters={}, blocked_helpers=[], viewer_requests=True,
                request_cooldown_seconds=10,cs_goal=7,chat_replies=True)
REGIONS = {'na1':'americas', 'br1':'americas', 'la1':'americas', 'la2':'americas',
           'euw1':'europe', 'eun1':'europe', 'tr1':'europe', 'ru':'europe',
           'kr':'asia', 'jp1':'asia', 'oc1':'sea', 'ph2':'sea', 'sg2':'sea',
           'th2':'sea', 'tw2':'sea', 'vn2':'sea', 'me1':'europe'}


def read(path=PATH):
    data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    if not isinstance(data, dict):
        raise ValueError('Tracker settings must be an object; original file preserved')
    return validate({**copy.deepcopy(DEFAULTS), **data})


def validate(result):
    if isinstance(result['cs_goal'],bool) or not isinstance(result['cs_goal'],(int,float)) or not 1<=result['cs_goal']<=15:
        raise ValueError('CS goal must be between 1 and 15 per minute')
    for key in ('allow_moderators','helper_enabled','include_custom','viewer_requests','chat_replies'):
        if not isinstance(result[key],bool):
            raise ValueError(f'{key} must be true or false; original settings preserved')
    for key in ('cooldown_seconds','request_cooldown_seconds'):
        value=result[key]
        if isinstance(value,bool) or not isinstance(value,int) or not 5<=value<=60:
            raise ValueError('Cooldown must be between 5 and 60 seconds')
    for key in ('helpers','blocked_helpers'):
        values=result[key]
        if not isinstance(values,list) or len(values)>100 or any(not isinstance(u,str) or not re.fullmatch(r'[A-Za-z0-9_]{1,25}',u) for u in values):
            raise ValueError('Helper lists must contain Twitch login names')
        result[key]=sorted({u.lower() for u in values})
    counters=result['custom_counters']
    if not isinstance(counters,dict) or len(counters)>20 or any(
        not isinstance(k,str) or not re.fullmatch(r'[a-z][a-z0-9_]{0,23}',k) or
        not isinstance(v,str) or not v.strip() or len(v)>60 for k,v in counters.items()):
        raise ValueError('Use up to 20 custom counters with short lowercase keys and labels')
    if result['region'] not in REGIONS:
        raise ValueError('Unknown Riot platform region')
    return result


def save(patch, path=PATH):
    if not isinstance(patch, dict) or set(patch)-set(DEFAULTS):
        raise ValueError('Unknown tracker setting')
    def apply(current):
        if not isinstance(current, dict):
            raise ValueError('Malformed tracker settings; original file preserved')
        return validate({**copy.deepcopy(DEFAULTS), **current, **patch})
    # Validate before creating a settings-history snapshot.
    apply(read(path))
    SettingsBackups().snapshot()
    return update_json(path, apply, default={})

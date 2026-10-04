"""Atomic personal command edits with optimistic revisions and lossless unknown fields."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
from lib.json_store import json_transaction, update_json
from lib.settings_backups import SettingsBackups

PATH = Path(__file__).with_name('commands.json')
RESERVED = {'!stats','!count','!melee','!range','!ranged','!caster','!cannon','!siege',
            '!nexus','!statundo','!command','!cmd','!addcom','!editcom','!delcom'}
KINDS = {'text','index','time','8ball'}


class Conflict(ValueError):
    pass


def validate(data):
    if not isinstance(data,dict) or type(data.get('enabled')) is not bool:
        raise ValueError('Commands need an enabled switch.')
    if not isinstance(data.get('channel'),str) or not re.fullmatch(r'[a-z0-9_]{1,25}',data['channel']):
        raise ValueError('Enter a valid Twitch channel.')
    rows = data.get('commands')
    if not isinstance(rows,list) or len(rows)>300:
        raise ValueError('Use at most 300 command groups.')
    names = set()
    for row in rows:
        if not isinstance(row,dict) or type(row.get('enabled')) is not bool:
            raise ValueError('Each command needs an enabled switch.')
        aliases = row.get('aliases',[])
        if not isinstance(aliases,list) or len(aliases)>25:
            raise ValueError('Use at most 25 aliases per command.')
        for name in [row.get('command'),*aliases]:
            if not isinstance(name,str) or not re.fullmatch(r'![a-z0-9][a-z0-9_.-]{0,31}',name):
                raise ValueError('Commands use ! followed by lowercase letters, numbers, dots, dashes or underscores.')
            if name in names or name in RESERVED:
                raise ValueError('Duplicate or reserved command: '+name)
            names.add(name)
        kind = row.get('kind','text')
        if kind not in KINDS:
            raise ValueError('Choose a supported response type.')
        response = row.get('response','')
        if not isinstance(response,str) or len(response)>400 or any(ord(c)<32 for c in response):
            raise ValueError('Responses must be one line of at most 400 characters.')
        if row['enabled'] and kind=='text' and not response.strip():
            raise ValueError('Write a reply before enabling this command.')
        if response.lstrip().startswith(('/', '.')):
            raise ValueError('Replies are plain chat text, not slash commands.')
        if row.get('permission','everyone') not in {'everyone','moderator','owner'}:
            raise ValueError('Choose everyone, moderator or owner permission.')
        if not isinstance(row.get('category',''),str) or len(row.get('category',''))>60:
            raise ValueError('Category must be text of at most 60 characters.')
        if type(row.get('cooldown',30)) is not int or not 5<=row.get('cooldown',30)<=3600:
            raise ValueError('Cooldown must be between 5 and 3600 seconds.')
    return data


def revision(data):
    return hashlib.sha256(json.dumps(data,sort_keys=True,ensure_ascii=False).encode()).hexdigest()


def read(path=PATH):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    return validate(data)


def save(body,path=PATH,*,snapshot=None):
    if not isinstance(body,dict) or set(body)-{'revision','enabled','command','original'}:
        raise ValueError('Unknown command edit.')
    def edit(current):
        validate(current)
        if body.get('revision')!=revision(current):
            raise Conflict('Commands changed since you opened this editor. Reload before saving.')
        result = deepcopy(current)
        if 'enabled' in body:
            result['enabled'] = body['enabled']
        if 'command' in body:
            row = body['command']
            if not isinstance(row,dict) or set(row)-{'command','aliases','response','kind','enabled','cooldown','permission','category'}:
                raise ValueError('Unknown command field.')
            original = body.get('original')
            index = next((i for i,c in enumerate(result['commands']) if c['command']==original),None)
            if original and index is None:
                raise Conflict('This command no longer exists. Reload before saving.')
            if index is None:
                result['commands'].append(deepcopy(row))
            else:
                result['commands'][index] = {**result['commands'][index],**row}
        validate(result)
        return result
    with json_transaction(path):
        # Validate the pending update before snapshotting or writing anything.
        edit(read(path))
        (snapshot or SettingsBackups().snapshot)()
        return update_json(path,edit)

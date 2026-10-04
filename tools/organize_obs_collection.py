"""Finite, offline reorganization of this Hub's personalized OBS collection.

No runtime imports or program-scene API writes. Run while OBS and the Hub are
closed, against the active file named in OBS user.ini. The rollback collection
must already exist; never overwrite it. All existing inputs/settings/filters
remain available, including retired HUD capture inputs.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.json_store import write_json
from lib.settings_backups import SettingsBackups

HUD_GROUPS = ('LeagueHUD', 'LeagueHUD2', 'LeagueHUD3', 'LeagueHUD4', 'leagueMAP')
PRIMARY = ('Test', 'Lobbies', 'Starting Soon', 'InstantReplay',
           'League Champion Select World', 'just screen', 'afk',
           'Spirit Welcome', 'Spirit Intermission', 'Spirit Signoff',
           'Bot Lane Court', 'Court - Genius', 'Court - Inting')
QA = re.compile(r'^Hub Spirit QA \d+ [01]$')


def items(source):
    return [row for row in source.get('settings', {}).get('items', [])
            if not row.get('group_item_backup')]


def reorganize(original):
    """Build a detached candidate; refuse unsafe group nesting or lost hotkeys."""
    data = copy.deepcopy(original)
    sources = {row['name']: row for row in data['sources']}
    groups = {row['name']: row for row in data.get('groups', [])}
    if 'Lobbies' not in sources or 'ScreenCaptureMAPHUD' not in sources:
        raise ValueError('Expected the personalized Hub lobby and HUD parents')
    parents = {}
    for owner in [*sources.values(), *groups.values()]:
        for row in items(owner):
            parents.setdefault(row['name'], set()).add(owner['name'])
    lobbies = [row['name'] for row in items(sources['Lobbies'])
               if row['name'].endswith('Lobby') or row['name'] == 'Spirit Afterparty']
    targets = [name for name in (*lobbies, *HUD_GROUPS, 'LeagueHudUdyrAnimation')
               if name in sources and sources[name]['id'] == 'scene']
    resolution = data.get('resolution', {'x': 1920, 'y': 1080})
    for name in targets:
        source = sources[name]
        if source.get('hotkeys', {}).get('OBSBasic.SelectScene'):
            raise ValueError('Preserve directly bound scene hotkeys: ' + name)
        if not parents.get(name) or any(parent in groups or parent in targets
                                        for parent in parents[name]):
            raise ValueError('A migrated group needs a retained scene parent: ' + name)
        if any(row['name'] in groups or row['name'] in targets for row in items(source)):
            raise ValueError('Do not create nested groups: ' + name)
        source['id'] = source['versioned_id'] = 'group'
        source['settings'].update(custom_size=True, cx=resolution['x'], cy=resolution['y'])
        # Keep complete original children, filters, UUIDs, hotkeys, audio and
        # private fields. Full-canvas artwork/audio links stabilize group bounds.
        groups[name] = source
    retired = [name for name, source in sources.items()
               if QA.fullmatch(name) and source['id'] == 'scene' and not parents.get(name)]
    retired_inputs = {row['name'] for name in retired for row in items(sources[name])
                      if row['name'] == name + ' color' and parents.get(row['name']) == {name}}
    excluded = set(targets) | set(retired) | retired_inputs
    data['sources'] = [row for row in data['sources'] if row['name'] not in excluded]
    data['groups'] = list(groups.values())
    shared = sources.get('teammatehud2')
    capture_changes = []
    if shared and shared['id'] == 'monitor_capture':
        for owner in (*data['sources'], *data['groups']):
            if owner['name'] not in HUD_GROUPS:
                continue
            for row in owner.get('settings', {}).get('items', []):
                old = sources.get(row['name'])
                if (old and old['name'] in ('teammatehud1', 'displayacptureLeagueMAP')
                        and old['id'] == shared['id']
                        and old['settings'].get('monitor_id') == shared['settings'].get('monitor_id')
                        and not any(f.get('enabled', True) for f in old.get('filters', []))):
                    capture_changes.append((owner['name'], row['name'], shared['name']))
                    row.update(name=shared['name'], source_uuid=shared['uuid'])
    retired_capture_names = tuple(dict.fromkeys(old for _, old, _ in capture_changes))
    if retired_capture_names:
        # OBS releases unreferenced sources during load. Keep their personal
        # settings/filters in a hidden group, so retiring capture workers does
        # not discard the original source data on the next collection save.
        name = 'Retired HUD captures'
        if name in sources or name in groups:
            raise ValueError('Preserve an existing retirement container: ' + name)
        group = copy.deepcopy(groups[next(n for n in HUD_GROUPS if n in groups)])
        group.update(name=name, uuid=str(uuid.uuid5(uuid.NAMESPACE_URL,
                     'StreamingHub/retired-hud-captures/'+original['name'])),
                     hotkeys={}, filters=[], volume=1.0)
        children = []
        for index, capture in enumerate(retired_capture_names, 1):
            donor = next(row for owner in original['sources'] for row in items(owner)
                         if row['name'] == capture)
            row = copy.deepcopy(donor)
            row.update(id=index, visible=False)
            children.append(row)
        group['settings'] = dict(custom_size=True,cx=resolution['x'],cy=resolution['y'],
                                 id_counter=len(children),items=children)
        data['groups'].append(group)
        parent = sources['ScreenCaptureMAPHUD']
        link = copy.deepcopy(next(row for row in items(parent) if row['name'] in HUD_GROUPS))
        identifier = parent['settings']['id_counter'] + 1
        link.update(name=name,source_uuid=group['uuid'],id=identifier,visible=False,locked=True)
        parent['settings']['id_counter'] = identifier
        parent['settings']['items'].append(link)
    for owner in (*data['sources'], *data['groups']):
        for row in owner.get('settings', {}).get('items', []):
            if row['name'] in targets or row['name'] == 'Retired HUD captures':
                row.setdefault('private_settings', {})['collapsed'] = True
    surviving = [row for row in data['scene_order'] if row['name'] not in excluded]
    ranked = {name: index for index, name in enumerate(PRIMARY)}
    data['scene_order'] = sorted(surviving, key=lambda row: ranked.get(row['name'], len(ranked)))
    for key in ('current_scene', 'current_program_scene'):
        current = data.get(key)
        if current in targets:
            data[key] = 'Lobbies' if current in lobbies else next(iter(sorted(parents[current])))
        elif current in retired:
            data[key] = 'Test'
    return data, {'converted_groups': targets, 'archived_qa_scenes': retired,
                  'shared_capture_links': capture_changes,
                  'scenes_before': len(original['scene_order']),
                  'scenes_after': len(data['scene_order'])}


def install(path, rollback):
    processes = subprocess.check_output(['tasklist', '/FI', 'IMAGENAME eq obs64.exe', '/FO', 'CSV', '/NH'], text=True)
    if 'obs64.exe' in processes.lower():
        raise RuntimeError('Close OBS before editing the collection')
    path, rollback = Path(path).resolve(), Path(rollback).resolve()
    expected = (Path(os.environ['APPDATA']) / 'obs-studio/basic/scenes').resolve()
    if path.parent != expected or rollback.parent != expected or path == rollback:
        raise ValueError('Use distinct active and rollback collections in the OBS scenes folder')
    if not rollback.is_file():
        raise ValueError('Create the duplicate rollback collection first')
    original = json.loads(path.read_text(encoding='utf-8'))
    candidate, report = reorganize(original)
    saved = json.loads(rollback.read_text(encoding='utf-8'))
    if report['converted_groups'] and saved['scene_order'] != original['scene_order']:
        raise ValueError('The rollback must match the complete pre-migration scene inventory')
    SettingsBackups().snapshot()
    write_json(path, candidate)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('path')
    parser.add_argument('--rollback', required=True)
    args = parser.parse_args()
    print(json.dumps(install(args.path, args.rollback), indent=2))

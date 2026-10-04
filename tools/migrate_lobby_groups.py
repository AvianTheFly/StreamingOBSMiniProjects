"""Offline OBS group migration, necessary because WebSocket cannot add group items.

Run only after closing OBS. Reuse existing item IDs and every transform field;
also update OBS's flattened group backup rows. Original input settings/filters
are retained for recovery and never changed by this operation.
"""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.display_capture import CAPTURE_SCENE
from lib.json_store import write_json
from lib.settings_backups import SettingsBackups


def migrate(data):
    updated = copy.deepcopy(data)
    indexed = {s['name']: s for s in updated['sources']}
    replacements = {'Display Capture': CAPTURE_SCENE, 'DESKTOP 3D SCREEN': 'Hub Desktop Panel'}
    for target in replacements.values():
        if target not in indexed or indexed[target]['id'] != 'scene':
            raise ValueError(f'Install the nested scene first: {target}')
    changes = []
    for owner in [*updated['sources'], *updated.get('groups', [])]:
        for row in owner.get('settings', {}).get('items', []):
            name = row.get('name')
            if name not in replacements or owner['name'] in ('Test', CAPTURE_SCENE, 'Hub Desktop Panel'):
                continue
            target = replacements[name]
            row['name'] = target
            row['source_uuid'] = indexed[target]['uuid']
            row['visible'] = True
            changes.append((owner['name'], name, target))
    return updated, changes


def install(path):
    listing = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq obs64.exe', '/FO', 'CSV', '/NH'],
                             capture_output=True, text=True, check=True)
    if 'obs64.exe' in listing.stdout.lower():
        raise RuntimeError('Close OBS before modifying its scene collection')
    path = Path(path).resolve()
    expected = (Path(os.environ['APPDATA']) / 'obs-studio' / 'basic' / 'scenes').resolve()
    if path.parent != expected or path.suffix != '.json':
        raise ValueError('Expected an OBS scene collection in the standard scenes folder')
    original = json.loads(path.read_text(encoding='utf-8'))
    updated, changes = migrate(original)
    SettingsBackups().snapshot()
    if changes:
        write_json(path, updated)
    return changes


if __name__ == '__main__':
    print('Migrated group references:', install(sys.argv[1]))

"""Finite saved-collection update while OBS is closed; never connects or launches it."""
from __future__ import annotations
import configparser
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.json_store import write_json
from lib.scene_transitions.installation import CLIPS, NAME, patch_collection, select_collection_file
from lib.settings_backups import SettingsBackups

MEDIA = Path(os.environ.get('SPIRIT_OUTPUT', 'C:/StreamingMedia/Transitions/udyr-spirits-v11')) / 'production'


def require_obs_closed():
    result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq obs64.exe', '/FO', 'CSV', '/NH'],
                            capture_output=True, text=True, check=True, timeout=15)
    if any(row and row[0].lower() == 'obs64.exe' for row in csv.reader(io.StringIO(result.stdout))):
        raise RuntimeError('OBS must stay closed throughout the saved-collection update')


def install(*, collection_file=None, media=None):
    media = Path(media or MEDIA)
    require_obs_closed()
    if not all((media / f'{clip}.webm').is_file() for clip in CLIPS):
        raise RuntimeError('Finish all eight production clips before installing')
    verified = json.loads((media / 'encoded-validation.json').read_text())
    if {item['clip'] for item in verified} != CLIPS or not all(
            item['cut_window_alpha'] == 255 and item['transparent_boundaries'] for item in verified):
        raise RuntimeError('All encoded clips need opaque-cut validation')
    manifest = json.loads((media / 'manifest.json').read_text())
    for item in verified:
        file = media / (item['clip'] + '.webm')
        timing = manifest['animations'][item['clip'].split('-')[0]]
        if hashlib.sha256(file.read_bytes()).hexdigest() != item['sha256'] or (
                item['covered_from'], item['covered_until']) != (timing['coveredFrom'], timing['coveredUntil']):
            raise RuntimeError('Encoded validation no longer matches the clips and timing; verify again')
    base = Path(os.environ['APPDATA']) / 'obs-studio'
    config = configparser.ConfigParser(interpolation=None)
    config.read(base / 'user.ini', encoding='utf-8-sig')
    name = config['Basic']['SceneCollection']
    folder = base / 'basic' / 'scenes'
    files = {p.name: json.loads(p.read_text(encoding='utf-8')).get('name') for p in folder.glob('*.json')}
    file = folder / select_collection_file(files, name, collection_file or config.get('Basic', 'SceneCollectionFile', fallback=None))
    before = file.read_bytes()
    current = json.loads(before)
    history = SettingsBackups()
    history.snapshot()
    backup = history.backup_root / '_spirit_install_offline' / str(time.time_ns())
    backup.mkdir(parents=True)
    (backup / file.name).write_bytes(before)
    # Updating installed media never replaces a deliberately chosen selector.
    updated = patch_collection(current, media, manifest, ROOT / 'lib/scene_transitions/random_spirits.lua',
                               select=False, require_existing=True)
    require_obs_closed()
    if file.read_bytes() != before:
        raise RuntimeError('The saved collection changed during preparation; retry from latest settings')
    write_json(file, updated)
    if json.loads(file.read_text()) != updated:
        raise RuntimeError(f'Saved collection verification failed; recovery at {backup}')
    transition = next(t for t in updated['transitions'] if t['name'] == NAME)
    report = {'collection': name, 'file': str(file), 'backup': str(backup),
              'media': str(media), 'selector_preserved': current.get('current_transition') == updated.get('current_transition'),
              'cuts_ms': {s: transition['settings'][f'{s}_cut_ms'] for s in manifest['spirits']},
              'collection_sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
              'obs_launched': False, 'live_verification': 'pending user reopening OBS'}
    write_json(media.parent / 'offline-install-validation.json', report)
    print(f'Prepared {NAME} in {name}; OBS remains closed; backup {backup}')



if __name__ == '__main__':
    install()

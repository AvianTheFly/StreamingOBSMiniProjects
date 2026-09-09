"""Offline repair for hidden native media that decode on collection restore.

Defaults to a dry run of OBS's selected collection. --apply requires OBS closed
and verifies an external settings snapshot before replacing the collection.
Only media hidden in EVERY scene/group is eligible; visible media is untouched.
"""
from __future__ import annotations

import argparse
import configparser
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.settings_backups import SettingsBackups


def repair_idle_sources(collection: dict) -> list[str]:
    """Change only the two idle flags, returning repaired source names."""
    sources = collection.get('sources', [])
    visible = set()
    for container in [*sources, *collection.get('groups', [])]:
        # A filter can sample a source that has no visible scene item.
        visible.update(_strings(container.get('filters', [])))
        if container.get('id') not in ('scene', 'group'):
            visible.update(_strings(container.get('settings', {})))
        for item in container.get('settings', {}).get('items', []):
            # Unknown visibility is conservatively considered visible.
            if item.get('visible', True):
                visible.update(filter(None, (item.get('name'), item.get('source_uuid'))))
    for projector in collection.get('saved_projectors', []):
        visible.update(filter(None, (projector.get('name'), projector.get('source_uuid'))))

    changed = []
    for source in sources:
        if source.get('id') != 'ffmpeg_source':
            continue
        if source.get('name') in visible or source.get('uuid') in visible:
            continue
        settings = source.get('settings', {})
        if not settings.get('is_local_file', True) or not settings.get('local_file'):
            continue
        if settings.get('restart_on_activate', True) and settings.get('close_when_inactive', False):
            continue
        settings.update(restart_on_activate=True, close_when_inactive=True)
        changed.append(source['name'])
    return changed


def _strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from _strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _strings(child)
    elif isinstance(value, str):
        yield value


def require_obs_closed() -> None:
    result = subprocess.run(
        ['tasklist', '/FI', 'IMAGENAME eq obs64.exe', '/FO', 'CSV', '/NH'],
        capture_output=True, text=True, check=True,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), timeout=10,
    )
    if 'obs64.exe' in result.stdout.lower():
        raise RuntimeError('Close OBS before applying; OBS would overwrite an offline repair.')


def selected_collection() -> Path:
    root = Path(os.environ['APPDATA']) / 'obs-studio'
    config = configparser.ConfigParser(interpolation=None, strict=False)
    config.read(root / 'user.ini', encoding='utf-8-sig')
    name = config['Basic']['SceneCollectionFile']
    return root / 'basic' / 'scenes' / (name if name.endswith('.json') else name + '.json')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    path = selected_collection()
    original = path.read_bytes()
    collection = json.loads(original)
    changed = repair_idle_sources(collection)
    print(f'{path.name}: {len(changed)} dormant media sources to repair')
    for name in changed:
        print(f'  {name}')
    if not args.apply or not changed:
        return

    require_obs_closed()
    backups = SettingsBackups()
    backups.snapshot()
    backup = backups.backup_root / '_obs_scenes' / path.name / 'latest.json'
    if not backup.is_file() or backup.read_bytes() != original:
        raise RuntimeError('Snapshot verification failed; collection has not been changed.')
    require_obs_closed()
    if path.read_bytes() != original:
        raise RuntimeError('Collection changed during repair; retry with OBS closed.')
    temporary = path.with_suffix('.idle-repair.tmp')
    temporary.write_text(json.dumps(collection, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')
    temporary.replace(path)
    print(f'Applied. Original preserved in {backup.parent}')


if __name__ == '__main__':
    main()

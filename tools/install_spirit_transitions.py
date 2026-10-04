"""Transactional OBS collection update, using native WebSocket collection switching.

Run with the Hub stopped, OBS open, streaming/recording inactive. The temporary
collection makes OBS save its latest settings before this tool reads anything.
An update preserves the current selector and changes only owned media settings.
No source settings, transforms, filters, audio levels, profiles or output paths
are edited. The original collection is restored even if installation fails.
"""
from __future__ import annotations
import json
import hashlib
import configparser
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lib.scene_transitions.installation import NAME, patch_collection, select_collection_file
from lib.json_store import write_json
STAGING = 'Hub Spirit Setup'
MEDIA = Path(os.environ.get('SPIRIT_OUTPUT', 'C:/StreamingMedia/Transitions/udyr-spirits-v11')) / 'production'


def wait_for_transition(client, name, *, timeout=2):
    """Wait for the queued OBS frontend selector write, with a finite deadline."""
    deadline = time.monotonic() + timeout
    while True:
        result = client.send('GetCurrentSceneTransition', {}, raw=True)
        if result.get('transitionName') == name:
            return result
        if time.monotonic() >= deadline:
            raise RuntimeError(f'OBS did not confirm transition selector {name!r}')
        time.sleep(.05)


def install(*, collection_file=None, media=None, update_existing=False):
    media = Path(media or MEDIA)
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
    import obs
    from lib.settings_backups import SettingsBackups
    client = obs.get_obs()
    for request in ('GetStreamStatus', 'GetRecordStatus'):
        if client.send(request, {}, raw=True)['outputActive']:
            raise RuntimeError('Install while streaming and recording are inactive')
    assert 'hub_spirit_transition' in client.send('GetTransitionKindList', {}, raw=True)['transitionKinds'], 'Load the native plugin by restarting OBS first'
    original = client.send('GetSceneCollectionList', {}, raw=True)['currentSceneCollectionName']
    scene = client.send('GetSceneList', {}, raw=True)['currentProgramSceneName']
    selected = client.send('GetCurrentSceneTransition', {}, raw=True)['transitionName']
    folder = Path(os.environ['APPDATA']) / 'obs-studio' / 'basic' / 'scenes'
    config = configparser.ConfigParser(interpolation=None)
    config.read(folder.parents[1] / 'user.ini', encoding='utf-8-sig')
    # An explicit filename may be needed when OBS's cached menu resolves a
    # duplicate name differently from user.ini. Verify it against saved metadata.
    configured = collection_file or (config.get('Basic', 'SceneCollectionFile', fallback=None) if config.get('Basic', 'SceneCollection', fallback=None) == original else None)
    files = {p.name: json.loads(p.read_text(encoding='utf-8')).get('name') for p in folder.glob('*.json')}
    file = folder / select_collection_file(files, original, configured)
    history = SettingsBackups(); history.snapshot()
    if not all((media / f'{id}.webm').is_file() for id in ('bear', 'turtle', 'ram', 'phoenix')):
        raise RuntimeError('Render all four spirit videos first')
    manifest = json.loads((media/'manifest.json').read_text())
    if not all((media / f'{spirit}-alt.webm').is_file() for spirit in ('bear','turtle','ram','phoenix')):
        raise RuntimeError('Render all alternate performances first')
    if set(manifest['spirits']) != {'bear','turtle','ram','phoenix'}:
        raise RuntimeError('The export manifest must contain all four spirits')
    collections = client.send('GetSceneCollectionList', {}, raw=True)['sceneCollections']
    if STAGING not in collections:
        client.send('CreateSceneCollection', {'sceneCollectionName': STAGING}, raw=True)
    else:
        client.send('SetCurrentSceneCollection', {'sceneCollectionName': STAGING}, raw=True)
    time.sleep(.5)
    before = file.read_bytes()
    backup = history.backup_root / '_spirit_install' / str(time.time_ns())
    backup.mkdir(parents=True)
    (backup / file.name).write_bytes(before)
    try:
        preserved = json.loads(before)
        script = (ROOT/'lib/scene_transitions/random_spirits.lua').as_posix()
        data = patch_collection(preserved, media, manifest, script,
                                select=not update_existing, require_existing=update_existing)
        scripts = data['modules']['scripts-tool']
        for key in preserved:
            if key not in {'transitions', 'modules', 'current_transition'}:
                assert data[key] == preserved[key], f'Unexpected change: {key}'
        for key, value in preserved.get('modules', {}).items():
            if key != 'scripts-tool':
                assert data['modules'][key] == value
        for entry in preserved.get('modules', {}).get('scripts-tool', []):
            if entry.get('path','').replace('\\','/')!=script:
                assert entry in scripts
        temporary = file.with_suffix('.spirit-install.tmp')
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=4), encoding='utf-8')
        temporary.replace(file)
        committed = file.read_bytes()
        if json.loads(committed) != data:
            raise RuntimeError('The prepared collection changed before OBS reloaded it')
        client.send('SetCurrentSceneCollection', {'sceneCollectionName': original}, raw=True)
        time.sleep(1)
        result = wait_for_transition(client, selected if update_existing else NAME)
        if update_existing and result.get('transitionName') != selected:
            raise RuntimeError('Selected transition changed during the media update')
        inspect_only = update_existing and selected != NAME
        if inspect_only:
            # No scene take occurs. Inspect the native settings briefly, then
            # restore only while this finite adapter still owns the selector.
            client.send('SetCurrentSceneTransition', {'transitionName': NAME}, raw=True)
        try:
            result = wait_for_transition(client, NAME)
        finally:
            if inspect_only and client.send('GetCurrentSceneTransition', {}, raw=True).get('transitionName') == NAME:
                client.send('SetCurrentSceneTransition', {'transitionName': selected}, raw=True)
                wait_for_transition(client, selected)
        if result.get('transitionName') != NAME or result.get('transitionKind') != 'hub_spirit_transition':
            raise RuntimeError('OBS did not load the spirit stinger')
        if result.get('transitionSettings', {}).get('directory') != media.as_posix():
            raise RuntimeError('OBS reloaded a different collection file; inspect the OBS switch log for its filename')
        current_scene = client.send('GetSceneList', {}, raw=True)['currentProgramSceneName']
        if current_scene != scene:
            raise RuntimeError('Program scene changed during installation; refusing a stale scene restore')
        write_json(MEDIA.parent / 'install-validation.json', {
            'collection': original, 'file': str(file), 'backup': str(backup / file.name),
            'media': MEDIA.as_posix(), 'sources_filters_transforms_levels_preserved': data.get('sources') == preserved.get('sources'),
            'program_scene_preserved': scene, 'selector_preserved': selected if update_existing else NAME,
            'before_sha256': hashlib.sha256(before).hexdigest(), 'committed_sha256': hashlib.sha256(committed).hexdigest(),
            'cuts_ms': {s: result['transitionSettings'][f'{s}_cut_ms'] for s in manifest['spirits']},
            'loaded_native_kind': result['transitionKind'], 'loaded_directory': result['transitionSettings']['directory'],
            'update_existing': update_existing})
        print(f'Installed {NAME} in {original}; program scene {scene}; backup {backup}')
    except Exception:
        # Restore through an inactive collection so OBS cannot overwrite recovery.
        try:
            active = client.send('GetSceneCollectionList', {}, raw=True)['currentSceneCollectionName']
            if active != STAGING:
                client.send('SetCurrentSceneCollection', {'sceneCollectionName': STAGING}, raw=True)
            file.write_bytes(before)
            client.send('SetCurrentSceneCollection', {'sceneCollectionName': original}, raw=True)
        finally:
            print(f'Installation failed; original collection recovery: {backup}')
        raise



if __name__ == '__main__':
    install()


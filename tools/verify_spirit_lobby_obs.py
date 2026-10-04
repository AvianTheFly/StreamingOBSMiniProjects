"""Finite off-air installation and native-preview QA; never selects program."""
from pathlib import Path
import base64
import hashlib
import json
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.install_spirit_lobby_obs import install, install_camera_stage, SCENE, SOURCE


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def snapshot(client):
    scenes = {s['sceneName']: client.get_scene_item_list(s['sceneName']).scene_items
              for s in client.get_scene_list().scenes}
    inputs = {i['inputName']: digest(client.get_input_settings(i['inputName']).input_settings)
              for i in client.get_input_list().inputs}
    filters = {name: digest(client.get_source_filter_list(name).filters) for name in inputs}
    volumes = {name: client.get_input_volume(name).input_volume_db for name in inputs
               if name in {'SoundboardMedia', 'InstantReplayMedia', 'Desktop Audio', 'Mic/Aux'}}
    return {'scenes': scenes, 'inputs': inputs, 'filters': filters, 'volumes': volumes}


def main():
    from lib.paths import load_project_env
    from lib.settings_backups import SettingsBackups
    load_project_env()
    import obs
    client = obs.get_obs()
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Use isolated browser QA while a live output is active.')
    output = Path('C:/StreamingMedia/SpiritLobby/2026-10-03/review')
    output.mkdir(parents=True, exist_ok=True)
    program = client.get_current_program_scene().current_program_scene_name
    original = snapshot(client)
    history = SettingsBackups()
    history.snapshot()
    installed = install(client)
    installed['camera_stage'] = install_camera_stage(client)
    after = snapshot(client)
    for category, values in original.items():
        for name, value in values.items():
            if (category, name) in {('scenes', SCENE), ('inputs', SOURCE)}:
                continue
            assert after[category][name] == value, (category, name, 'changed during installation')
    assert client.get_current_program_scene().current_program_scene_name == program
    # Studio preview activates the browser without selecting the program scene.
    # Release only the preview still showing our own QA presentation.
    studio = client.get_studio_mode_enabled().studio_mode_enabled
    if not studio:
        client.set_studio_mode_enabled(True)
    preview = client.get_current_preview_scene().current_preview_scene_name
    try:
        client.set_current_preview_scene(SCENE)
        time.sleep(4)
        for filename in ['obs-native-1.png', 'obs-native-2.png']:
            shot = client.send('GetSourceScreenshot', dict(sourceName=SCENE,
                imageFormat='png', imageWidth=1920, imageHeight=1080), raw=True)
            (output / filename).write_bytes(base64.b64decode(shot['imageData'].split(',', 1)[1]))
            if filename.endswith('1.png'):
                time.sleep(1.5)
    finally:
        if (client.get_studio_mode_enabled().studio_mode_enabled
                and client.get_current_preview_scene().current_preview_scene_name == SCENE):
            client.set_current_preview_scene(preview)
            if not studio:
                client.set_studio_mode_enabled(False)
    time.sleep(.5)
    assert client.get_current_program_scene().current_program_scene_name == program
    for name, value in original['volumes'].items():
        assert client.get_input_volume(name).input_volume_db == value, name
    active = client.send('GetSourceActive', {'sourceName': SOURCE}, raw=True)
    settings = client.get_input_settings(SOURCE).input_settings
    report = {'installed': installed, 'program_scene_preserved': program,
              'existing_scenes_preserved': len(original['scenes']),
              'existing_source_settings_and_filters_preserved': len(original['inputs']),
              'faders_preserved': list(original['volumes']),
              'settings_history': str(history.backup_root),
              'native_screenshots': ['obs-native-1.png', 'obs-native-2.png'],
              'inactive_source': active, 'browser_settings': settings}
    (output / 'obs-qa.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()

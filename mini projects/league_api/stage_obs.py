"""Additive OBS installation for the feature's loading scene and queue badge."""
from lib.settings_backups import SettingsBackups

SCENE = 'League Spirit Loading'
LOADING = 'League Spirit Loading Browser'
QUEUE = 'League Queue Badge'


def recover(client):
    names = {row['inputName'] for row in client.send('GetInputList', {}, raw=True)['inputs']}
    for name in (LOADING, QUEUE):
        if name in names:
            client.send('PressInputPropertiesButton', {'inputName': name, 'propertyName': 'refreshnocache'}, raw=True)


def install(client, path):
    """Preserve existing sources, transforms, filters and scene selection."""
    from lib.json_store import update_json
    SettingsBackups().snapshot()
    scenes = {row['sceneName'] for row in client.get_scene_list().scenes}
    if SCENE not in scenes:
        client.send('CreateScene', {'sceneName': SCENE}, raw=True)
    inputs = {row['inputName']: row for row in client.send('GetInputList', {}, raw=True)['inputs']}
    def attach(scene, name, endpoint):
        if name in inputs and inputs[name]['inputKind'] != 'browser_source':
            raise ValueError(f'{name} belongs to another input type')
        items = client.send('GetSceneItemList', {'sceneName': scene}, raw=True)['sceneItems']
        if name not in inputs:
            client.send('CreateInput', {'sceneName': scene, 'inputName': name, 'inputKind': 'browser_source',
                        'inputSettings': {'url': f'http://127.0.0.1:7431/stage/{endpoint}', 'width': 1920,
                                          'height': 1080, 'fps': 24, 'fps_custom': True, 'shutdown': False,
                                          'restart_when_active': True}, 'sceneItemEnabled': True}, raw=True)
            inputs[name] = {'inputKind': 'browser_source'}
        elif not any(i['sourceName'] == name for i in items):
            client.send('CreateSceneItem', {'sceneName': scene, 'sourceName': name, 'sceneItemEnabled': True}, raw=True)
    attach(SCENE, LOADING, 'loading')
    for scene in ('Lobbies', 'League Champion Select World'):
        if scene in scenes:
            attach(scene, QUEUE, 'queue')
    # Retain the existing alert scene for the explicit loading-screen meme.
    if 'TikTok' in scenes:
        items = client.send('GetSceneItemList', {'sceneName': SCENE}, raw=True)['sceneItems']
        if not any(i['sourceName'] == 'TikTok' for i in items):
            client.send('CreateSceneItem', {'sceneName': SCENE, 'sourceName': 'TikTok', 'sceneItemEnabled': True}, raw=True)
    def merge(saved):
        if not isinstance(saved, dict):
            raise ValueError('Preserve malformed client settings; repair explicitly')
        return {**saved, 'loading_scene': SCENE}
    update_json(path, merge, default={})
    return {'loading_scene': SCENE, 'queue_source': QUEUE}

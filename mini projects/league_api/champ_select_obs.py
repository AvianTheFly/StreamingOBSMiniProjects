"""Install the custom draft scene beside the existing personalized lobby scenes."""
from __future__ import annotations

from lib.settings_backups import SettingsBackups


SCENE = 'League Champion Select World'
SOURCE = 'League Champion Select World Browser'
URL = 'http://127.0.0.1:7431/champ-select'


def install(client):
    """Reuse the facecam scene without altering its original transform or filters."""
    scenes = {item['sceneName'] for item in client.get_scene_list().scenes}
    source = next((entry for entry in client.send('GetInputList', {}, raw=True)['inputs']
                   if entry['inputName'] == SOURCE), None)
    if source and source['inputKind'] != 'browser_source':
        raise ValueError(f'{SOURCE} is already a different OBS input type')
    original = next((item for item in client.send('GetGroupSceneItemList',
                     {'sceneName': 'LOL champ select'}, raw=True)['sceneItems']
                     if item['sourceName'] == 'FaceCamWithProps'), None)
    if original is None:
        raise ValueError('Existing FaceCamWithProps scene item was not found')
    SettingsBackups().snapshot()
    if SCENE not in scenes:
        client.send('CreateScene', {'sceneName': SCENE}, raw=True)
    settings = {'url': URL, 'width': 1920, 'height': 1080, 'fps': 30,
                'fps_custom': True, 'shutdown': False, 'restart_when_active': False}
    items = client.send('GetSceneItemList', {'sceneName': SCENE}, raw=True)['sceneItems']
    if not source:
        client.send('CreateInput', {'sceneName': SCENE, 'inputName': SOURCE,
                    'inputKind': 'browser_source', 'inputSettings': settings,
                    'sceneItemEnabled': True}, raw=True)
    else:
        current = client.send('GetInputSettings', {'inputName': SOURCE}, raw=True)['inputSettings']
        if current.get('url') != URL:
            client.send('SetInputSettings', {'inputName': SOURCE,
                        'inputSettings': {'url': URL}, 'overlay': True}, raw=True)
        if not any(item['sourceName'] == SOURCE for item in items):
            client.send('CreateSceneItem', {'sceneName': SCENE, 'sourceName': SOURCE,
                        'sceneItemEnabled': True}, raw=True)
    items = client.send('GetSceneItemList', {'sceneName': SCENE}, raw=True)['sceneItems']
    world = next(item for item in items if item['sourceName'] == SOURCE)
    if not world['sceneItemEnabled']:
        client.send('SetSceneItemEnabled', {'sceneName': SCENE,
                    'sceneItemId': world['sceneItemId'], 'sceneItemEnabled': True}, raw=True)
    camera = next((item for item in items if item['sourceName'] == 'FaceCamWithProps'), None)
    if camera is None:
        created = client.send('CreateSceneItem', {'sceneName': SCENE,
                    'sourceName': 'FaceCamWithProps', 'sceneItemEnabled': True}, raw=True)
        camera_id = created['sceneItemId']
    else:
        camera_id = camera['sceneItemId']
    if camera is None or (camera['sceneItemTransform']['positionX'] == 0
                          and camera['sceneItemTransform']['scaleX'] == 1):
        transform = original['sceneItemTransform']
        keep = ('positionX', 'positionY', 'alignment', 'rotation', 'scaleX', 'scaleY',
                'cropLeft', 'cropRight', 'cropTop', 'cropBottom', 'boundsType')
        client.send('SetSceneItemTransform', {'sceneName': SCENE,
                    'sceneItemId': camera_id,
                    'sceneItemTransform': {key: transform[key] for key in keep}}, raw=True)
    # The page cuts a camera-shaped hole in the scene art; it must render over
    # the camera so only that opening shows the reused video source.
    client.send('SetSceneItemIndex', {'sceneName': SCENE,
                'sceneItemId': camera_id, 'sceneItemIndex': 0}, raw=True)
    return {'scene': SCENE, 'source': SOURCE, 'camera': 'FaceCamWithProps'}

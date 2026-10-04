"""Visibility of the shared nested desktop capture; never switches scenes.

The standalone installer owns OBS collection migration. Runtime commands only
change the real input inside the dedicated scene, preserving every parent item.
"""
import threading

CAPTURE_SCENE = 'Hub Display Capture'
CAPTURE_SOURCE = 'Display Capture'
_lock = threading.Lock()


def snapshot(*, client=None):
    """Read the loaded capture visibility without changing OBS or saved data."""
    from obs.client import get_obs
    with _lock:
        client = client if client is not None else get_obs()
        matches = [i for i in client.get_scene_item_list(CAPTURE_SCENE).scene_items
                   if i['sourceName'] == CAPTURE_SOURCE]
        if len(matches) != 1:
            raise ValueError(f'{CAPTURE_SCENE} must contain exactly one {CAPTURE_SOURCE}')
        return {'visible': bool(matches[0]['sceneItemEnabled'])}


def set_visible(visible, *, client=None):
    from obs.client import get_obs
    with _lock:
        client = client if client is not None else get_obs()
        items = client.get_scene_item_list(CAPTURE_SCENE).scene_items
        matches = [i for i in items if i['sourceName'] == CAPTURE_SOURCE]
        if len(matches) != 1:
            raise ValueError(f'{CAPTURE_SCENE} must contain exactly one {CAPTURE_SOURCE}')
        item = matches[0]
        if item['sceneItemEnabled'] != bool(visible):
            client.set_scene_item_enabled(CAPTURE_SCENE, item['sceneItemId'], bool(visible))
        return {'ok': True, 'visible': bool(visible),
                'message': 'Screen shown.' if visible else 'Screen hidden.'}

"""Visibility of the shared nested desktop capture; never switches scenes.

The standalone installer owns OBS collection migration. Runtime commands only
change the real input inside the dedicated scene, preserving every parent item.
"""
import threading

CAPTURE_SCENE = 'Hub Display Capture'
CAPTURE_SOURCE = 'Display Capture'
_lock = threading.Lock()


def apply_content(spec, *, client):
    """Apply a published display selection without input settings or scene writes.

    The feature supplies the scene, allowed sources and choice as complete data.
    Unknown personal overlays and every original input/filter remain untouched.
    """
    with _lock:
        scene, sources, selected = spec['scene'], spec['sources'], spec['selected']
        if selected is not None and selected not in sources:
            raise ValueError('Invalid display selection')
        rows = client.get_scene_item_list(scene).scene_items
        matches = [row for row in rows if row['sourceName'] == selected]
        if selected is not None and len(matches) != 1:
            raise ValueError('Display selection must be installed exactly once')
        # Owners may publish a selected input's canvas fit. Parent lobby
        # rectangles remain authoritative; never touch other inputs or filters.
        transforms = spec.get('transforms', {})
        if any(name != selected for name in transforms):
            raise ValueError('Display transforms must belong to the selected input')
        if selected in transforms:
            from lib.coordination.lobby_layout import transform_matches
            from lib.settings_backups import SettingsBackups
            item = matches[0]
            if not transform_matches(item.get('sceneItemTransform', {}), transforms[selected]):
                SettingsBackups().snapshot()
                client.set_scene_item_transform(scene, item['sceneItemId'], transforms[selected])
        for row in rows:
            if row['sourceName'] in sources:
                visible = row['sourceName'] == selected
                if row['sceneItemEnabled'] != visible:
                    client.set_scene_item_enabled(scene, row['sceneItemId'], visible)


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

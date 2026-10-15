"""Persist the lobby display choice; shared mechanics only edit nested items."""
from . import settings, presentation
from lib.display_capture import CAPTURE_SCENE, apply_content
from lib.settings_backups import SettingsBackups
from lib.json_store import update_json

ORIGINAL_UDYR = 'udyr 3d animation'
SOURCES = {'udyr': 'Hub Lobby Udyr', 'client': 'League of Legends champ select',
           'desktop': 'Display Capture', 'chrome': 'google chrome'}
LABELS = {'udyr': 'Udyr animation', 'client': 'League client', 'desktop': 'Desktop', 'chrome': 'Google Chrome'}
HIDDEN = 'none'
RECAP_SOURCE = 'League Match Chronicle Auto'


def choice(data=None):
    data = settings.read() if data is None else data
    selected = data.get('screen_content')
    if selected is not None and selected not in SOURCES and selected != HIDDEN:
        raise ValueError('Preserve malformed lobby display choice')
    return selected


def blueprint(data=None):
    selected = choice(data)
    from .presentation import transform
    return ({'scene': CAPTURE_SCENE, 'sources': [*SOURCES.values(), ORIGINAL_UDYR, RECAP_SOURCE], 'selected': SOURCES.get(selected),
             'modes': {'league_idle': SOURCES['client'], 'league_queue': RECAP_SOURCE}}
            | {'transforms': {SOURCES['udyr']: transform((0, 0, 1920, 1080))} if selected == 'udyr' else {}}
            if selected is not None else None)


def catalog(client):
    installed = {row['sourceName'] for row in client.get_scene_item_list(CAPTURE_SCENE).scene_items}
    return {'selected': choice(), 'options': [{'id': HIDDEN, 'label': 'Scenery only', 'available': True}] + [
        {'id': key, 'label': LABELS[key], 'available': name in installed}
        for key, name in SOURCES.items()]}


def select(selected):
    if selected not in SOURCES and selected != HIDDEN:
        raise ValueError('Choose scenery, Udyr, League client, Desktop or Google Chrome')
    from obs import get_obs
    from .inventory import _discover_lobbies, publish_inventory
    with presentation.lock:
        client = get_obs()
        matches = [row for row in client.get_scene_item_list(CAPTURE_SCENE).scene_items
                   if row['sourceName'] == SOURCES.get(selected)]
        if selected != HIDDEN and len(matches) != 1:
            raise ValueError('The lobby display requires exactly one installed source reference')
        SettingsBackups().snapshot()
        def merge(data):
            choice(data)
            return {**data, 'screen_content': selected}
        saved = update_json(settings.PATH, merge, default={})
        publish_inventory(_discover_lobbies())
        apply_content(blueprint(saved), client=client)
        return {'ok': True, **catalog(client)}


def visibility(source, *, client=None):
    """Read actual nested media and parent visibility, including manual OBS edits."""
    from .layouts import LAYOUTS
    from obs import get_obs
    from obs.containers import container_items
    if source not in LAYOUTS or source == 'Spirit Afterparty':
        raise ValueError('Unknown living lobby')
    client = client if client is not None else get_obs()
    with presentation.lock:
        parent = container_items(client, source).scene_items
        linked = any(r['sourceName'] == CAPTURE_SCENE and r['sceneItemEnabled'] for r in parent)
        children = client.get_scene_item_list(CAPTURE_SCENE).scene_items
        active = any(r['sourceName'] in (*SOURCES.values(), RECAP_SOURCE) and r['sceneItemEnabled'] for r in children)
        return {'source': source, 'visible': linked and active}


def install(client):
    """Install an independent Udyr input; retain the original tilted input."""
    from .presentation import transform
    inputs = {row['inputName']: row for row in client.get_input_list().inputs}
    missing = (set(SOURCES.values()) - {SOURCES['udyr']}) - inputs.keys()
    if SOURCES['udyr'] not in inputs and ORIGINAL_UDYR not in inputs:
        missing.add(ORIGINAL_UDYR)
    if missing:
        raise ValueError('Missing original display inputs: ' + ', '.join(sorted(missing)))
    SettingsBackups().snapshot()
    indexed = {row['sourceName']: row for row in client.get_scene_item_list(CAPTURE_SCENE).scene_items}
    if SOURCES['udyr'] not in inputs:
        original = client.get_input_settings(ORIGINAL_UDYR).input_settings
        created = client.create_input(CAPTURE_SCENE, SOURCES['udyr'],
                                      inputs[ORIGINAL_UDYR]['inputKind'], dict(original), False)
        identifier = created.scene_item_id
        client.set_scene_item_transform(CAPTURE_SCENE, identifier, transform((0, 0, 1920, 1080)))
        client.set_scene_item_locked(CAPTURE_SCENE, identifier, True)
        # A new input has its own filter chain and decoder. Never copy filters.
        client.set_input_volume(SOURCES['udyr'],
                                vol_db=client.get_input_volume(ORIGINAL_UDYR).input_volume_db)
        client.set_input_mute(SOURCES['udyr'], client.get_input_mute(ORIGINAL_UDYR).input_muted)
        indexed[SOURCES['udyr']] = {'sceneItemId': identifier}
    for name in SOURCES.values():
        if name not in indexed:
            identifier = client.create_scene_item(CAPTURE_SCENE, name, False).scene_item_id
            # The parent scene carries each lobby's personal screen placement.
            client.set_scene_item_transform(CAPTURE_SCENE, identifier, transform((0, 0, 1920, 1080)))
            client.set_scene_item_locked(CAPTURE_SCENE, identifier, True)
    # Keep this reference so the original input cannot be garbage-collected.
    # Only its reference in the shared display is retired; other lobbies retain it.
    legacy = indexed.get(ORIGINAL_UDYR)
    if legacy and legacy['sceneItemEnabled']:
        client.set_scene_item_enabled(CAPTURE_SCENE, legacy['sceneItemId'], False)
    return {'installed': list(SOURCES)}

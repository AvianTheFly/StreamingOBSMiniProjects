"""Standalone, idempotent OBS lobby installation and desktop-scene migration.

Uses the existing transport, snapshots personal settings, retains original
inputs/filters, and never writes the program scene or edits collection JSON.
"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import PROJECT_ROOT, load_project_env, ensure_import_paths
from lib.settings_backups import SettingsBackups
from lib.display_capture import CAPTURE_SCENE, CAPTURE_SOURCE
from lib.json_store import update_json

ART = PROJECT_ROOT / 'mini projects' / 'scene_voice_switcher' / 'art'
PANEL_SCENE = 'Hub Desktop Panel'
CHAT_SOURCE = 'Hub Lobby Chat'
ensure_import_paths()
from scene_voice_switcher.layouts import LAYOUTS, FLAT_LOCATIONS
from scene_voice_switcher.presentation import plan, transform
# The feature owns authored placement. Maintenance only assembles OBS sources.
LOCATIONS = tuple((name, row[0], *row[3:]) for name,row in LAYOUTS.items())

def validate_art(locations):
    for name,stem,*_ in locations:
        if stem is None: continue
        if not (ART/f'{stem}-base.png').is_file():
            raise FileNotFoundError(ART/f'{stem}-base.png')
        if name not in FLAT_LOCATIONS and not any((ART/f'{stem}-{layer}.png').is_file() for layer in ('foreground-cutout','foreground')):
            raise FileNotFoundError(ART/f'{stem}-foreground-cutout.png')


def ensure_scene(client, name):
    if name not in {s['sceneName'] for s in client.get_scene_list().scenes}:
        client.create_scene(name)


def item(client, owner, source, *, kind=None, settings=None, enabled=True):
    rows = client.get_scene_item_list(owner).scene_items
    found = next((r for r in rows if r['sourceName'] == source), None)
    if found:
        return found['sceneItemId']
    if kind and source not in {i['inputName'] for i in client.get_input_list().inputs}:
        return client.create_input(owner, source, kind, settings or {}, enabled).scene_item_id
    return client.create_scene_item(owner, source, enabled).scene_item_id


def place(client, owner, item_id, rect, *, stretch=False, fill=False):
    x, y, w, h = rect
    client.set_scene_item_transform(owner, item_id, dict(positionX=x, positionY=y,
        alignment=5, rotation=0, scaleX=1, scaleY=1, cropTop=0, cropBottom=0, cropLeft=0, cropRight=0,
        cropToBounds=fill,
        boundsType='OBS_BOUNDS_STRETCH' if stretch else 'OBS_BOUNDS_SCALE_OUTER' if fill else 'OBS_BOUNDS_SCALE_INNER',
        boundsWidth=w, boundsHeight=h, boundsAlignment=0))
    client.set_scene_item_locked(owner, item_id, True)


def migrate_capture(client):
    ensure_scene(client, CAPTURE_SCENE)
    capture_exists = any(r['sourceName'] == CAPTURE_SOURCE for r in client.get_scene_item_list(CAPTURE_SCENE).scene_items)
    capture_id = item(client, CAPTURE_SCENE, CAPTURE_SOURCE, enabled=False)
    if not capture_exists:
        place(client, CAPTURE_SCENE, capture_id, (0, 0, 1920, 1080))
    ensure_scene(client, PANEL_SCENE)
    panel_exists = any(r['sourceName'] == CAPTURE_SCENE for r in client.get_scene_item_list(PANEL_SCENE).scene_items)
    panel_id = item(client, PANEL_SCENE, CAPTURE_SCENE)
    if not panel_exists:
        place(client, PANEL_SCENE, panel_id, (0, 0, 1920, 1080))
    # Preserve the user's 3D panel filter on a wrapper, not the shared capture.
    installed = {f['filterName'] for f in client.get_source_filter_list(PANEL_SCENE).filters}
    for f in client.get_source_filter_list('DESKTOP 3D SCREEN').filters:
        if f['filterName'] not in installed:
            client.create_source_filter(PANEL_SCENE, f['filterName'], f['filterKind'], f['filterSettings'])
            client.set_source_filter_enabled(PANEL_SCENE, f['filterName'], f['filterEnabled'])
    owners = [s['sceneName'] for s in client.get_scene_list().scenes]
    # obs-websocket cannot CreateSceneItem inside groups. Those references are
    # migrated separately while OBS is closed, preserving group item IDs.
    changes = []
    for owner in dict.fromkeys(owners):
        if owner in (CAPTURE_SCENE, PANEL_SCENE):
            continue
        rows = client.get_scene_item_list(owner).scene_items
        for row in rows:
            source = row['sourceName']
            if source not in (CAPTURE_SOURCE, 'DESKTOP 3D SCREEN') or (owner == 'Test' and source == CAPTURE_SOURCE):
                continue
            replacement = PANEL_SCENE if source == 'DESKTOP 3D SCREEN' else CAPTURE_SCENE
            new_id = client.create_scene_item(owner, replacement, True).scene_item_id
            transform = {k: v for k, v in row['sceneItemTransform'].items()
                         if k not in ('height', 'width', 'sourceHeight', 'sourceWidth')}
            client.set_scene_item_transform(owner, new_id, transform)
            client.set_scene_item_locked(owner, new_id, row['sceneItemLocked'])
            client.set_scene_item_blend_mode(owner, new_id, row['sceneItemBlendMode'])
            client.remove_scene_item(owner, row['sceneItemId'])
            client.set_scene_item_index(owner, new_id, row['sceneItemIndex'])
            changes.append((owner, source, replacement))
    return changes


def install_locations(client, locations=LOCATIONS):
    """Add missing location layers; retain placements/filters of installed ones.

    The caller snapshots before this settings mutation. Expansion of a running
    personalized collection does not rerun desktop or hotkey migrations.
    """
    # Validate everything before modifying the user's collection.
    validate_art(locations)
    scenes = {s['sceneName'] for s in client.get_scene_list().scenes}
    if not {'Lobbies', CAPTURE_SCENE, 'FaceCamWithProps'} <= scenes:
        raise ValueError('Expected personalized Lobbies/FaceCamWithProps and shared desktop scenes')
    SettingsBackups().snapshot()
    for name, stem, screen, camera, chat in locations:
        if stem is None and name not in scenes:
            continue  # Browser stages are installed by their dedicated owner.
        ensure_scene(client, name)
        existing = {r['sceneItemId'] for r in client.get_scene_item_list(name).scene_items}
        if name in LAYOUTS:
            blueprint = plan(name)
        else:
            # Preserve the standalone installer's tuple contract for personal
            # locations; runtime layout policy covers only the authored catalog.
            blueprint = {'layers':[
                {'source':name+' Base','kind':'image_source','settings':{'file':str(ART/f'{stem}-base.png')},'transform':transform((0,0,1920,1080),stretch=True)},
                {'source':CAPTURE_SCENE,'transform':transform(screen)},
                {'source':'FaceCamWithProps','transform':transform(camera,fill=True)},
                {'source':name+' Foreground','kind':'image_source','settings':{'file':str(ART/f'{stem}-foreground-cutout.png')},'transform':transform((0,0,1920,1080),stretch=True)},
                {'source':CHAT_SOURCE,'kind':'browser_source','settings':{'url':'http://127.0.0.1:7420/chat/overlay.html','width':360,'height':700},'transform':transform(chat,stretch=True)}]}
        for index, layer in enumerate(blueprint['layers']):
            identifier = item(client, name, layer['source'], kind=layer.get('kind'),
                              settings=layer.get('settings'))
            if identifier not in existing:
                client.set_scene_item_transform(name, identifier, layer['transform'])
                client.set_scene_item_locked(name, identifier, True)
                client.set_scene_item_index(name, identifier, index)
        already_linked = any(r['sourceName'] == name for r in client.get_scene_item_list('Lobbies').scene_items)
        linked = item(client, 'Lobbies', name, enabled=False)
        if not already_linked:
            place(client, 'Lobbies', linked, (0, 0, 1920, 1080), stretch=True)
            client.set_scene_item_index('Lobbies', linked, 3)



def install(client):
    validate_art(LOCATIONS)
    scenes = {s['sceneName'] for s in client.get_scene_list().scenes}
    if not {'Lobbies', 'Test', 'FaceCamWithProps'} <= scenes:
        raise ValueError('Expected the personalized Lobbies/Test/FaceCamWithProps collection')
    SettingsBackups().snapshot()
    changes = migrate_capture(client)
    # This unused browser window capture otherwise bypasses desktop privacy.
    for row in client.get_scene_item_list('SpecificSongs').scene_items:
        if row['sourceName'] == 'youtube' and row.get('inputKind') == 'window_capture':
            client.set_scene_item_enabled('SpecificSongs', row['sceneItemId'], False)
    install_locations(client)
    def hotkeys(current):
        if not isinstance(current, dict):
            raise ValueError('Preserve malformed Hub settings; repair them explicitly')
        saved = current.get('hub_hotkeys', {})
        if not isinstance(saved, dict):
            raise ValueError('Preserve malformed Hub hotkeys')
        return {**current, 'hub_hotkeys': {**saved,
            'show_screen': {'enabled': True, 'sequence': '*-', 'max_interval': .8},
            'hide_screen': {'enabled': True, 'sequence': '-*', 'max_interval': .8}}}
    update_json(PROJECT_ROOT / 'hub_settings.json', hotkeys, default={})
    return changes


if __name__ == '__main__':
    load_project_env()
    from obs.client import get_obs
    print('Migrated desktop references:', install(get_obs()))

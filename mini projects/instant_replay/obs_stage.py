"""Feature-owned OBS stage inputs and viewports; reuse actual capture inputs."""
import os
from pathlib import Path

import obs
from lib.display_capture import CAPTURE_SCENE

SCENE = 'InstantReplay'
MEDIA = 'InstantReplayMedia'
BACKDROP = 'ReplayStudioBackdrop'
MOTION = 'ReplayStudioMotion'
COVER = 'ReplayStudioCover'
ART = Path(__file__).with_name('art')
_game_source = None
_camera_source = None
_scale = (1, 1)


def transform(box):
    x, y, width, height = box
    sx, sy = _scale
    return dict(positionX=x*sx, positionY=y*sy, alignment=5,
                boundsType='OBS_BOUNDS_SCALE_INNER', boundsAlignment=0,
                boundsWidth=width*sx, boundsHeight=height*sy, rotation=0)


def art_file(kind, side, camera=False):
    label = kind if kind in ('replay', 'clip', 'highlights') else 'clip'
    suffix = '-live-camera' if side and camera else '-camera' if camera else '-companion' if side else ''
    path = ART / f"{label}{suffix}-v3.png"
    if not path.is_file():
        raise FileNotFoundError(f'Replay studio art missing: {path}')
    return path


def install():
    global _game_source, _camera_source, _scale
    client = obs.get_obs()
    canvas = client.get_video_settings()
    _scale = canvas.base_width / 1920, canvas.base_height / 1080
    inputs = {v['inputName']: v['inputKind'] for v in client.get_input_list().inputs}
    items = obs.list_sources(SCENE)
    # Test owns this checkout's gameplay capture. Add a scene-item reference;
    # do not alter the input, its filters, Test, or the shared desktop gate.
    captures = [i['sourceName'] for i in client.get_scene_item_list('Test').scene_items
                if i.get('inputKind') in ('game_capture', 'monitor_capture', 'window_capture')
                and i.get('sceneItemEnabled')]
    _game_source = captures[0] if captures else None
    if _game_source and _game_source not in items:
        obs.create_scene_item(SCENE, _game_source, False)
    scenes = {s['sceneName'] for s in client.get_scene_list().scenes}
    _camera_source = 'FaceCamWithProps' if 'FaceCamWithProps' in scenes else next(
        (v['inputName'] for v in client.get_input_list().inputs if v['inputKind'] == 'dshow_input'), None)
    if _camera_source and _camera_source not in items:
        obs.create_scene_item(SCENE, _camera_source, False)
    port = int(os.environ.get('HUB_UI_PORT', '7420'))
    props = {
        BACKDROP: ('image_source', {'file': str(art_file('clip', False, True))}),
        COVER: ('color_source_v3', dict(color=0xFF191009, width=1920, height=1080)),
        MOTION: ('browser_source', dict(url=f'http://127.0.0.1:{port}/replay-stage.html?layer=motion',
            width=1920, height=1080, fps=30, fps_custom=True, shutdown=True,
            restart_when_active=False, reroute_audio=False))}
    for name, (kind, settings) in props.items():
        if name in inputs and inputs[name] != kind:
            raise ValueError(f'{name} belongs to another input kind.')
        if name not in inputs:
            client.create_input(SCENE, name, kind, settings, True)
        elif name not in items:
            obs.create_scene_item(SCENE, name, True)
        else:
            current = client.get_input_settings(name).input_settings
            changed = {k: v for k, v in settings.items() if current.get(k) != v}
            if changed:
                client.set_input_settings(name, changed, True)
        obs.set_source_transform(SCENE, name, transform((0, 0, 1920, 1080)))
    items = obs.list_sources(SCENE)
    layers = ['Recording Audio - No Music', BACKDROP, MEDIA, CAPTURE_SCENE, _game_source,
              _camera_source, COVER, MOTION]
    for index, name in enumerate(n for n in layers if n in items):
        client.set_scene_item_index(SCENE, items[name], index)
    for name in ('InstantReplayLogo', 'frameBorder', 'ReplayStage', 'ReplayStageArt', 'ReplayStageTitle'):
        if name in items:
            client.set_scene_item_enabled(SCENE, items[name], False)
    set_cover(False)
    return dict(live_available=bool(_game_source), camera_available=bool(_camera_source),
                live_online=False, camera_online=False)


def apply(value):
    client = obs.get_obs()
    items = obs.list_sources(SCENE)
    if BACKDROP not in items:
        return
    side = value['view'] != 'off'
    art_kind = 'replay' if value['mode'] == 'replay' else 'highlights' if value['kind'] == 'highlights' else 'clip'
    file = str(art_file(art_kind, side, value['camera']))
    if client.get_input_settings(BACKDROP).input_settings.get('file') != file:
        client.set_input_settings(BACKDROP, {'file': file}, True)
    obs.set_source_transform(SCENE, MEDIA, transform(value['layout']['media']))
    obs.set_source_transform(SCENE, COVER, transform(value['layout']['media']))
    if _camera_source in items:
        obs.set_source_transform(SCENE, _camera_source, transform(value['layout']['camera']))
        client.set_scene_item_enabled(SCENE, items[_camera_source], value['active'] and value['camera'])
    if _game_source in items:
        obs.set_source_transform(SCENE, _game_source, transform(value['layout']['live']))
        client.set_scene_item_enabled(SCENE, items[_game_source],
                                     value['active'] and value['view'] == 'live')
    if CAPTURE_SCENE in items:
        obs.set_source_transform(SCENE, CAPTURE_SCENE, transform(value['layout']['live']))
        client.set_scene_item_enabled(SCENE, items[CAPTURE_SCENE],
                                     value['active'] and value['view'] == 'desktop')


def set_cover(enabled):
    client = obs.get_obs()
    items = obs.list_sources(SCENE)
    if COVER in items:
        client.set_scene_item_enabled(SCENE, items[COVER], bool(enabled))


def availability():
    """Sample on the existing playback loop; a closed camera window is offline."""
    client = obs.get_obs()
    items = client.get_scene_item_list(SCENE).scene_items
    game = next((i for i in items if i['sourceName'] == _game_source), {})
    live_online = game.get('sceneItemEnabled', False) and game.get('sceneItemTransform', {}).get('sourceWidth', 0) > 0
    desktop = next((i for i in items if i['sourceName'] == CAPTURE_SCENE), {})
    desktop_visible = False
    if desktop.get('sceneItemEnabled'):
        rows = client.get_scene_item_list(CAPTURE_SCENE).scene_items
        desktop_visible = any(i.get('sceneItemEnabled') for i in rows)
        live_online = any(i.get('sceneItemEnabled') and i['sceneItemTransform'].get('sourceWidth', 0) > 0 for i in rows)
    if _camera_source == 'FaceCamWithProps':
        rows = client.get_scene_item_list(_camera_source).scene_items
        camera_online = any(i.get('sceneItemEnabled') and i.get('inputKind') in
            ('window_capture', 'dshow_input', 'game_capture') and
            i['sceneItemTransform'].get('sourceWidth', 0) > 0 for i in rows)
    else:
        camera = next((i for i in items if i['sourceName'] == _camera_source), {})
        camera_online = camera.get('sceneItemEnabled', False) and camera.get('sceneItemTransform', {}).get('sourceWidth', 0) > 0
    return dict(live_online=bool(live_online), camera_online=bool(camera_online), desktop_visible=desktop_visible)

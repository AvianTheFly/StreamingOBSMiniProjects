"""Standalone additive browser-scene installation for the authored spirit lobby.

Uses shared OBS transport, snapshots settings, preserves personalized reruns and
never writes the program scene. No runtime provider, hook or server is added.
"""
from pathlib import Path
import argparse
import json
import sys
from urllib.parse import urlparse, urlsplit, urlunsplit, parse_qsl, urlencode

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
SCENE = 'Spirit Afterparty'
SOURCE = 'Hub Spirit Afterparty'
DEFAULT_URL = 'http://127.0.0.1:7420/spirit-lobby/index.html'
FOREGROUND = 'Hub Spirit Afterparty Foreground'
CAMERA = 'FaceCamWithProps'
from obs.containers import container_items
from obsws_python.error import OBSSDKRequestError


def installed_group(client, scenes):
    if SCENE in scenes:
        return False
    try:
        container_items(client, SCENE)
    except OBSSDKRequestError as error:
        if error.code != 600:
            raise
        return False
    return True


def layer_url(url, layer):
    validate_url(url)
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if k not in {'layer', 'cameraGuide'}]
    return urlunsplit(parts._replace(query=urlencode(query + [('layer', layer)])))


def install_camera_stage(client):
    """Place the existing camera between scenery and console, on this scene only.

    Existing item transforms and unknown browser settings survive reruns. The
    nested camera's own crop, key, filters and settings are never edited.
    """
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Update the lobby while streaming and recording are stopped.')
    scenes = {s['sceneName'] for s in client.get_scene_list().scenes}
    grouped = installed_group(client, scenes)
    if grouped:
        scenes.add(SCENE)
    inputs = {i['inputName']: i['inputKind'] for i in client.get_input_list().inputs}
    if CAMERA not in scenes or SCENE not in scenes or inputs.get(SOURCE) != 'browser_source':
        raise ValueError('The installed lobby and existing FaceCamWithProps scene are required.')
    if FOREGROUND in scenes or (FOREGROUND in inputs and inputs[FOREGROUND] != 'browser_source'):
        raise ValueError('The foreground name belongs to a different resource.')
    url = client.get_input_settings(SOURCE).input_settings['url']
    back, front = layer_url(url, 'background'), layer_url(url, 'foreground')
    rows = {row['sourceName']: row for row in container_items(client,SCENE).scene_items}
    if grouped and not {SOURCE,CAMERA,FOREGROUND} <= rows.keys():
        raise ValueError('Repair missing Afterparty group layers offline before camera-stage installation.')
    if SOURCE not in rows:
        raise ValueError('The lobby browser must be present in its scene.')
    video = client.get_video_settings()
    if url != back:
        client.set_input_settings(SOURCE, {'url': back}, True)
    if CAMERA not in rows:
        item = client.create_scene_item(SCENE, CAMERA, True).scene_item_id
        sx, sy = video.base_width / 1920, video.base_height / 1080
        client.set_scene_item_transform(SCENE, item, {
            'positionX': 738 * sx, 'positionY': 378 * sy, 'alignment': 5,
            'boundsType': 'OBS_BOUNDS_SCALE_INNER', 'boundsAlignment': 0,
            'boundsWidth': 444 * sx, 'boundsHeight': 420 * sy,
            'cropLeft': 370, 'cropRight': 370, 'cropTop': 0, 'cropBottom': 0,
        })
        client.set_scene_item_locked(SCENE, item, True)
    if FOREGROUND not in rows:
        if FOREGROUND in inputs:
            item = client.create_scene_item(SCENE, FOREGROUND, True).scene_item_id
        else:
            item = client.create_input(SCENE, FOREGROUND, 'browser_source', {
                'url': front, 'width': 1920, 'height': 1080, 'is_local_file': False,
                'shutdown': True, 'restart_when_active': True,
                'fps_custom': True, 'fps': 30, 'reroute_audio': False,
            }, True).scene_item_id
        client.set_scene_item_transform(SCENE, item, {
            'positionX': 0, 'positionY': 0, 'alignment': 5,
            'boundsType': 'OBS_BOUNDS_SCALE_INNER', 'boundsAlignment': 0,
            'boundsWidth': video.base_width, 'boundsHeight': video.base_height,
        })
        client.set_scene_item_locked(SCENE, item, True)
    return {'scene': SCENE, 'camera': CAMERA, 'foreground': FOREGROUND}


def validate_url(url):
    value = urlparse(url)
    if (value.scheme != 'http' or value.hostname not in {'127.0.0.1', 'localhost'}
            or value.username or value.password or value.path != '/spirit-lobby/index.html'):
        raise ValueError('Use the spirit lobby URL served by the local Hub.')
    if not value.port:
        raise ValueError('The local Hub URL must include its port.')
    return url


def install(client, url=DEFAULT_URL):
    """Create only missing resources. A rerun preserves URL and item edits."""
    validate_url(url)
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Install the new lobby while streaming and recording are stopped.')
    scenes = {s['sceneName'] for s in client.get_scene_list().scenes}
    grouped = installed_group(client, scenes)
    if grouped:
        scenes.add(SCENE)
    inputs = {i['inputName']: i['inputKind'] for i in client.get_input_list().inputs}
    if SCENE in inputs or SOURCE in scenes or (SOURCE in inputs and inputs[SOURCE] != 'browser_source'):
        raise ValueError('A spirit lobby name already belongs to a different resource.')
    video = client.get_video_settings()
    new_scene = SCENE not in scenes
    if new_scene:
        client.create_scene(SCENE)
        if 'Recording Audio - No Music' in scenes:
            client.create_scene_item(SCENE, 'Recording Audio - No Music', True)
    rows = container_items(client,SCENE).scene_items
    if any(row['sourceName'] == SOURCE for row in rows):
        return {'scene': SCENE, 'source': SOURCE, 'created': False}
    if grouped:
        raise ValueError('Repair the missing Afterparty browser in the offline collection.')
    if SOURCE in inputs:
        item_id = client.create_scene_item(SCENE, SOURCE, True).scene_item_id
    else:
        item_id = client.create_input(SCENE, SOURCE, 'browser_source', {
            'url': url, 'width': 1920, 'height': 1080,
            'is_local_file': False, 'shutdown': True, 'restart_when_active': True,
            'fps_custom': True, 'fps': 30, 'reroute_audio': False,
        }, True).scene_item_id
    client.set_scene_item_transform(SCENE, item_id, {
        'positionX': 0, 'positionY': 0, 'alignment': 5,
        'boundsType': 'OBS_BOUNDS_SCALE_INNER', 'boundsAlignment': 0,
        'boundsWidth': video.base_width, 'boundsHeight': video.base_height,
    })
    client.set_scene_item_locked(SCENE, item_id, True)
    return {'scene': SCENE, 'source': SOURCE, 'created': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=DEFAULT_URL)
    parser.add_argument('--camera-stage', action='store_true')
    args = parser.parse_args()
    from lib.paths import load_project_env
    from lib.settings_backups import SettingsBackups
    load_project_env()
    import obs
    from urllib.request import urlopen
    validate_url(args.url)
    # Validate readiness before making a settings snapshot or touching OBS.
    with urlopen(args.url, timeout=5) as response:
        if b'id="stage"' not in response.read():
            raise RuntimeError('The running Hub is not serving the lobby overlay.')
    SettingsBackups().snapshot()
    result = install(obs.get_obs(), args.url)
    if args.camera_stage:
        result['camera_stage'] = install_camera_stage(obs.get_obs())
    print(json.dumps({'installed': result, 'program_scene_changed_by_installer': False}))


if __name__ == '__main__':
    main()

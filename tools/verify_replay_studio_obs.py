"""Standalone off-air replay verification through public Hub APIs and OBS queries."""
import base64
import json
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
import obs

BASE = 'http://127.0.0.1:7420'
OUT = ROOT / 'output' / 'replay-studio-v2'


def request(path, body=None):
    req = Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                  headers={'Content-Type': 'application/json'})
    try:
        with urlopen(req, timeout=8) as response:
            return json.load(response)
    except HTTPError as exc:
        raise RuntimeError(f'{path}: {exc.code}: {exc.read().decode()}') from exc


def wait(predicate, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(.15)
    raise TimeoutError('Replay verification did not reach its expected state')


def main():
    client = obs.get_obs()
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Run the isolated browser checks while on air; do not broadcast verification.')
    if request('/api/projects/instant_replay/stage').get('active'):
        raise RuntimeError('Finish the current replay before running verification.')
    current = client.get_current_program_scene().current_program_scene_name
    transition = client.get_current_scene_transition().transition_name
    overrides = {s: (client.get_scene_scene_transition_override(s).transition_name,
                     client.get_scene_scene_transition_override(s).transition_duration)
                 for s in (current, 'InstantReplay')}
    desktop_mute = obs.get_input_mute('Desktop Audio')
    items_before = client.get_scene_item_list('Test').scene_items
    capture_filters = client.get_source_filter_list('Display Capture').filters
    listing = request('/api/projects/instant_replay/clips')
    candidates = [c for c in listing['clips'] if c['path'].lower().endswith('.mkv') and 'clips' in c['path']]
    if not candidates:
        raise RuntimeError('No saved game cut is available for off-air verification.')
    clip = max((c for c in candidates if c.get('game')), key=lambda c: c.get('size_bytes', 0),
               default=candidates[-1])
    screenshots = []
    try:
        for mode in ('replay', 'showcase'):
            request('/api/projects/instant_replay/play', {'path': clip['path'], 'mode': mode})
            state = wait(lambda: (s if (s := request('/api/projects/instant_replay/stage')).get('phase') == 'playing'
                                 and s.get('cursor_ms', 0) > 600 else None))
            assert state['mode'] == mode
            assert state['view'] == state['settings'][mode]['companion']
            assert client.get_current_program_scene().current_program_scene_name == 'InstantReplay'
            cursor = client.get_current_scene_transition_cursor().transition_cursor
            assert cursor <= 0 or cursor >= 1, 'The clip started under a scene transition'
            # Let OBS's browser finish its initial load while media keeps running.
            time.sleep(1)
            image = client.send('GetSourceScreenshot', {'sourceName': 'InstantReplay', 'imageFormat': 'png',
                                'imageWidth': 1920, 'imageHeight': 1080}, raw=True)['imageData']
            file = OUT / f'{mode}-obs.png'
            file.write_bytes(base64.b64decode(image.split(',', 1)[1]))
            screenshots.append(str(file))
            if state['view'] == 'live':
                capture = next(i for i in client.get_scene_item_list('InstantReplay').scene_items
                               if i['sourceName'] == 'Display Capture')
                assert capture['sceneItemEnabled']
                assert capture['sceneItemTransform']['sourceWidth'] > 0
                assert capture['sceneItemTransform']['sourceHeight'] > 0
            request('/api/projects/instant_replay/pause', {})
            wait(lambda: request('/api/projects/instant_replay/stage').get('paused'))
            request('/api/projects/instant_replay/resume', {})
            wait(lambda: not request('/api/projects/instant_replay/stage').get('paused'))
            request('/api/projects/instant_replay/revert', {})
            wait(lambda: not request('/api/projects/instant_replay/stage').get('active'))
            wait(lambda: not request('/api/projects/instant_replay/clips').get('busy'))
            time.sleep(.2)
            assert client.get_current_program_scene().current_program_scene_name == current
    finally:
        request('/api/projects/instant_replay/revert', {})
    assert obs.get_input_mute('Desktop Audio') == desktop_mute
    assert client.get_current_scene_transition().transition_name == transition
    assert client.get_scene_item_list('Test').scene_items == items_before
    assert client.get_source_filter_list('Display Capture').filters == capture_filters
    assert {s: (client.get_scene_scene_transition_override(s).transition_name,
                client.get_scene_scene_transition_override(s).transition_duration) for s in overrides} == overrides
    assert client.get_record_directory().record_directory.replace('\\', '/') == 'C:/StreamingMedia/Replays'
    result = dict(verified=True, modes=['replay', 'showcase'], screenshots=screenshots,
                  return_scene=current, global_transition=transition,
                  capture_filters_transforms_and_desktop_audio_preserved=True)
    (OUT / 'obs-verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()

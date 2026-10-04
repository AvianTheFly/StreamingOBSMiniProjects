"""Offline OBS preview verification; keep the scene and every fader unchanged."""
import base64
import json
from pathlib import Path
import sys
import time
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import load_project_env
load_project_env()
import obs

BASE = 'http://127.0.0.1:7431'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'output'/'match-screens-2026-10-01'


def request(path, body=None):
    req = Request(BASE+path, data=json.dumps(body).encode() if body is not None else None,
                  headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=5) as response:
        return json.load(response)


def main():
    client = obs.get_obs()
    if client.get_stream_status().output_active:
        raise RuntimeError('Skipping on-air previews; use the isolated browser checks instead.')
    before = client.get_current_program_scene().current_program_scene_name
    source = 'League API Alerts'
    settings = client.send('GetInputSettings', {'inputName': source}, raw=True)
    volume = client.send('GetInputVolume', {'inputName': source}, raw=True)
    filters = client.send('GetSourceFilterList', {'sourceName': source}, raw=True)
    items = client.send('GetSceneItemList', {'sceneName': 'League API'}, raw=True)
    # Load the new JS into the existing browser; no URL/transform/audio writes.
    client.send('PressInputPropertiesButton', {'inputName': source, 'propertyName': 'refreshnocache'}, raw=True)
    time.sleep(1)
    try:
        for key in ('game_start', 'defeat', 'victory'):
            request('/production/preview', {'key': key})
            time.sleep(.9)
            state = request('/state')
            assert state['match_screen']['key'] == key
            shot = client.send('GetSourceScreenshot', {'sourceName': source,
                               'imageFormat': 'png', 'imageWidth': 1280, 'imageHeight': 720}, raw=True)
            (OUT/(key+'-obs.png')).write_bytes(base64.b64decode(shot['imageData'].split(',',1)[1]))
            request('/production/clear', {})
    finally:
        request('/production/clear', {})
    assert client.get_current_program_scene().current_program_scene_name == before
    assert client.send('GetInputSettings', {'inputName': source}, raw=True) == settings
    assert client.send('GetInputVolume', {'inputName': source}, raw=True) == volume
    assert client.send('GetSourceFilterList', {'sourceName': source}, raw=True) == filters
    assert client.send('GetSceneItemList', {'sceneName': 'League API'}, raw=True) == items
    print(json.dumps({'verified': True, 'scene': before, 'screens': 3,
                      'settings_filters_transforms_and_volume_preserved': True,
                      'overlay_ready': request('/production/settings')['overlay_ready']}))


if __name__ == '__main__':
    main()

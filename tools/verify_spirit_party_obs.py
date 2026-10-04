"""Finite off-air native accent QA, using only owned Studio preview activation."""
from pathlib import Path
import argparse
import base64
import io
import json
import sys
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.verify_spirit_lobby_obs import snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--automatic', action='store_true', help='Observe only autonomous surprises; send no action cues.')
    args = parser.parse_args()
    from lib.paths import load_project_env
    from lib.settings_backups import SettingsBackups
    load_project_env()
    import obs
    client = obs.get_obs()
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Native QA requires streaming and recording stopped; browser QA remains available.')
    scene = 'Spirit Afterparty'
    output = Path('C:/StreamingMedia/SpiritLobby/2026-10-03/review')
    before = snapshot(client)
    program = client.get_current_program_scene().current_program_scene_name
    SettingsBackups().snapshot()
    studio = client.get_studio_mode_enabled().studio_mode_enabled
    if not studio:
        raise RuntimeError('Native QA needs Studio mode already enabled. Automatic toggling hit an OBS WebSocket scene-query crash; use browser QA while it is disabled.')
    preview = client.get_current_preview_scene().current_preview_scene_name
    recovery = output / 'native-party-preview-recovery.json'
    recovery.write_text(json.dumps({'studio': studio, 'preview': preview, 'program': program,
                                   'owned_preview': scene}), encoding='utf-8')
    cues = []
    try:
        client.set_current_preview_scene(scene)
        sources = ['Hub Spirit Afterparty', 'Hub Spirit Afterparty Foreground']
        for source in sources:
            client.send('PressInputPropertiesButton', dict(inputName=source, propertyName='refreshnocache'), raw=True)
        # Require painted pixels, not just successful cue delivery. A simultaneous
        # Hub restart can otherwise leave CEF documents blank during maintenance.
        from PIL import Image
        for attempt in range(30):
            time.sleep(.6)
            painted = []
            for source in sources:
                shot = client.send('GetSourceScreenshot', dict(sourceName=source, imageFormat='png',
                                   imageWidth=1920, imageHeight=1080), raw=True)
                image = Image.open(io.BytesIO(base64.b64decode(shot['imageData'].split(',', 1)[1]))).convert('RGBA')
                pixel = image.getpixel((960, 825) if 'Foreground' in source else (40, 40))
                painted.append(pixel[3] > 240 and max(pixel[:3]) > 20)
            if all(painted):
                break
        else:
            raise RuntimeError('Native lobby browser did not finish painting both layers.')
        for name in ([] if args.automatic else ['visitor', 'bloom', 'vinyl', 'ducks', 'bubbles', 'meteors', 'confetti', 'confetti']):
            body = json.dumps({'action': name, 'id': str(uuid.uuid4())}).encode()
            request = urllib.request.Request('http://127.0.0.1:7420/api/spirit-lobby/action', data=body,
                                            headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=5) as response:
                cues.append(json.load(response))
            time.sleep(.12)
        time.sleep(2)
        filenames = [(scene, 'obs-autoparty-native-1.png' if args.automatic else 'obs-party-native.png'),
                     ('Hub Spirit Afterparty Foreground', 'obs-autoparty-foreground.png' if args.automatic else 'obs-party-foreground.png')]
        for source, filename in filenames:
            shot = client.send('GetSourceScreenshot', dict(sourceName=source, imageFormat='png',
                               imageWidth=1920, imageHeight=1080), raw=True)
            (output / filename).write_bytes(base64.b64decode(shot['imageData'].split(',', 1)[1]))
        if args.automatic:
            for n in [2, 3]:
                time.sleep(6)
                shot = client.send('GetSourceScreenshot', dict(sourceName=scene, imageFormat='png',
                                   imageWidth=1920, imageHeight=1080), raw=True)
                (output / f'obs-autoparty-native-{n}.png').write_bytes(base64.b64decode(shot['imageData'].split(',', 1)[1]))
    finally:
        try:
            if (client.get_studio_mode_enabled().studio_mode_enabled
                    and client.get_current_preview_scene().current_preview_scene_name == scene):
                client.set_current_preview_scene(preview)
                if not studio:
                    client.set_studio_mode_enabled(False)
            recovery.unlink(missing_ok=True)
        except obs.OBSUnavailable:
            print('OBS went offline before owned preview release. Recovery intent preserved at', recovery)
    assert client.get_current_program_scene().current_program_scene_name == program
    after = snapshot(client)
    assert after == before, 'Native QA changed personal scenes, source settings, filters or faders.'
    from PIL import Image
    foreground = Image.open(output / filenames[1][1]).convert('RGBA')
    assert foreground.getpixel((960, 520))[3] == 0, 'Party accents covered the camera.'
    assert foreground.getpixel((960, 825))[3] > 240, 'Native foreground did not render.'
    report = {'cues': cues, 'program_preserved': program, 'settings_preserved': True,
              'camera_opening_clear': True, 'automatic_only': args.automatic, 'screenshots': [f for _, f in filenames]}
    (output / ('obs-autoparty-qa.json' if args.automatic else 'obs-party-qa.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()

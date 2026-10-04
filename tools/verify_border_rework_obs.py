"""Finite native OBS QA on a private source; no program writes or live auditions."""
import base64
import io
import hashlib
import json
import os
import runpy
from pathlib import Path
import sys
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')
import obs
from obs.client import OBSUnavailable
from PIL import Image, ImageDraw
from lib.settings_backups import SettingsBackups
from border_obs_fixture import Fixture

OUT = Path(os.environ.get('BORDER_QA_ARTIFACT_DIR', str(ROOT / 'tmp_obs_debug')))
SOURCES = ['Hub Soundboard Effects', 'League API Alerts', 'Hub Twitch Celebrations']


def source_settings(client):
    result = {}
    for source in SOURCES:
        result[source] = {}
        for key, method, field in [
            ('settings', 'GetInputSettings', 'inputName'),
            ('volume', 'GetInputVolume', 'inputName'),
            ('mute', 'GetInputMute', 'inputName'),
            ('tracks', 'GetInputAudioTracks', 'inputName'),
            ('filters', 'GetSourceFilterList', 'sourceName'),
        ]:
            result[source][key] = client.send(method, {field: source}, raw=True)
    return result


def capture(client, source, label):
    shot = client.send('GetSourceScreenshot', dict(
        sourceName=source, imageFormat='png', imageWidth=1920, imageHeight=1080), raw=True)
    data = base64.b64decode(shot['imageData'].split(',', 1)[1])
    image = Image.open(io.BytesIO(data)).convert('RGBA')
    image.save(OUT / ('border-native-' + label + '.png'))
    alpha = image.getchannel('A')
    return image, dict(
        visible=alpha.getbbox() is not None,
        center_clear=alpha.crop((240, 170, 1680, 840)).getbbox() is None,
        right_clear=alpha.crop((800, 170, 1680, 840)).getbbox() is None,
        max_alpha=max(alpha.tobytes()),
        pixels=sum(v > 0 for v in alpha.tobytes()),
    )


def wait_ready(client, method, data):
    """Follow the existing connection owner's bounded reconnect after OBS 207."""
    deadline = time.monotonic() + 5
    while True:
        try:
            return client.send(method, data, raw=True)
        except OBSUnavailable:
            if time.monotonic() >= deadline:
                raise
            time.sleep(.25)


def cases():
    sounds = json.loads((ROOT / 'mini projects/soundboard/browser_effects.json').read_text())
    for index, (name, effect) in enumerate(sounds.items()):
        yield 'sound', f'{index:02d}', name, dict(
            family='sound', effect=effect, elapsed=3.9, duration=8)
    settings = json.loads((ROOT / 'mini projects/league_api/production.json').read_text())
    catalog = runpy.run_path(str(ROOT / 'mini projects/league_api/production/catalog.py'))
    saved = json.loads((ROOT / 'mini projects/league_api/alerts.json').read_text())
    custom = {key: value for key, value in saved['events'].items() if key.startswith('custom_')}
    manifest = catalog['manifest'](settings, custom)
    common = {key: settings[key] for key in ['opacity', 'intensity', 'edge_width']}
    common.update(enabled=True, ambient=None, death=None, effect=None)
    for effect in manifest:
        yield 'league', effect['key'], effect['title'], dict(
            family='league', state={**common, 'effect': {
                **effect, 'elapsed': effect['duration'] * .5}})
    for theme in ['earth', 'fire', 'water', 'air', 'hextech', 'chemtech', 'elder']:
        yield 'ambient', theme, theme + ' atmosphere', dict(
            family='league', state={**common, 'ambient': {'theme': theme, 'elapsed': 8}})
    for elapsed in [4, 15]:
        yield 'death', str(elapsed), 'Soul sanctuary / ' + str(elapsed) + 's', dict(
            family='league', state={**common, 'death': {'elapsed': elapsed, 'remaining': 24-elapsed}})
    for family, kind, elapsed, duration in [
        ('supporter', 'subscribe', 1.7, 3.8),
        ('supporter', 'gift', 1.7, 3.8),
        ('supporter', 'follow', 1, 2.2),
        ('raid', 'raid', 3.8, 8),
        ('cheer', 'cheer', 3.9, 7),
    ]:
        for theme in ['crab', 'dragon', 'cat', 'frog']:
            yield kind, theme, kind + ' / ' + theme, dict(
                family=family, kind=kind, theme=theme, id='native-' + kind + '-' + theme,
                name='TheNextLovelyViewer', count=5 if kind == 'gift' else 2645,
                duration=duration, elapsed=elapsed, details={'tier': '2000', 'months': 7,
                                                          'renewal': kind == 'subscribe'})


def contact_sheet(cards, filename):
    columns, width, height = 3, 640, 390
    sheet = Image.new('RGB', (columns * width, ((len(cards)+columns-1)//columns)*height), '#101b24')
    draw = ImageDraw.Draw(sheet)
    for index, (label, image) in enumerate(cards):
        x, y = index % columns * width, index // columns * height
        draw.text((x+10, y+8), label, fill='#d7e7ef')
        background = Image.new('RGB', image.size, '#254042')
        background.paste(image, mask=image.getchannel('A'))
        sheet.paste(background.resize((620, 349)), (x+10, y+29))
    sheet.save(OUT / filename)


def main():
    OUT.mkdir(exist_ok=True)
    bundles = ['lib/browser_effects/web/rave.js', 'mini projects/league_api/production/web/event-relics.js', 'mini projects/twitch_celebrations/raid_art.js', 'lib/browser_effects/web/subtle.js']
    fingerprints = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in bundles}
    (OUT / 'border-rework-obs-verification.json').write_text(json.dumps(dict(passed=False, status='Review started; no complete proof yet', artwork_sha256=fingerprints), indent=2))
    client = obs.get_obs()
    before = source_settings(client)
    program = client.send('GetCurrentProgramScene', {}, raw=True)
    studio_before = client.send('GetStudioModeEnabled', {}, raw=True)['studioModeEnabled']
    preview_before = None
    SettingsBackups().snapshot()
    fixture = Fixture()
    unique = 'Border material QA ' + uuid4().hex[:10]
    source = unique + ' browser'
    scene_created = input_created = False
    results, cards = [], {}
    try:
        client.send('CreateScene', {'sceneName': unique}, raw=True)
        scene_created = True
        client.send('CreateInput', dict(
            sceneName=unique, inputName=source, inputKind='browser_source',
            inputSettings=dict(url=fixture.url, width=1920, height=1080, fps=30,
                               shutdown=False, restart_when_active=False, reroute_audio=True),
            sceneItemEnabled=True), raw=True)
        input_created = True
        if not studio_before:
            client.send('SetStudioModeEnabled', {'studioModeEnabled': True}, raw=True)
        preview_before = client.send('GetCurrentPreviewScene', {}, raw=True)['currentPreviewSceneName']
        (OUT / 'border-qa-recovery.json').write_text(json.dumps(dict(
            scene=unique, source=source, preview_before=preview_before,
            studio_before=studio_before, program=program), indent=2))
        client.send('SetCurrentPreviewScene', {'sceneName': unique}, raw=True)
        # OBS queues the frontend selection. Observe that it has taken effect
        # before treating a different preview as a subsequent ownership loss.
        activated_until = time.monotonic() + 3
        while time.monotonic() < activated_until:
            studio = client.send('GetStudioModeEnabled', {}, raw=True)['studioModeEnabled']
            if studio and client.send('GetCurrentPreviewScene', {}, raw=True)['currentPreviewSceneName'] == unique:
                break
            time.sleep(.1)
        else:
            raise AssertionError('The private OBS preview was not activated')
        # OBS pauses CEF painting for invisible scenes, so use Studio preview.
        # The private scene is never requested as a program scene. The fixture
        # creates no Audio objects and never polls or consumes a live Hub channel.
        for family, key, label, case in cases():
            serial = fixture.set(case)
            deadline = time.monotonic()+12
            readback = 0
            while time.monotonic() < deadline:
                with fixture.lock:
                    painted, errors = fixture.painted, list(fixture.errors)
                assert not errors, errors
                if painted == serial:
                    break
                if time.monotonic() >= readback:
                    assert client.send('GetStudioModeEnabled', {}, raw=True)['studioModeEnabled'] and client.send('GetCurrentPreviewScene', {}, raw=True)['currentPreviewSceneName'] == unique, 'Private preview ownership changed externally; stop without altering the new scene'
                    client.send('GetSourceScreenshot', dict(sourceName=source, imageFormat='png', imageWidth=320, imageHeight=180), raw=True)
                    readback = time.monotonic()+.4
                time.sleep(.1)
            else:
                raise AssertionError('Private OBS browser did not paint ' + label + ': ' + repr(fixture.requests))
            time.sleep(.12)
            assert wait_ready(client,'GetCurrentPreviewScene',{})['currentPreviewSceneName']==unique, 'Private preview ownership changed externally'
            try:
                image, frame = capture(client, source, family + '-' + key)
            except OBSUnavailable:
                assert wait_ready(client,'GetCurrentPreviewScene',{})['currentPreviewSceneName']==unique, 'Private preview ownership changed externally'
                image, frame = capture(client, source, family + '-' + key)
            # CEF's texture handoff may lag its JS acknowledgement under load.
            # Re-read this same confirmed case; never restart or skip its check.
            retry_until = time.monotonic() + 1.5
            while not frame['visible'] and time.monotonic() < retry_until:
                assert client.send('GetCurrentPreviewScene', {}, raw=True)['currentPreviewSceneName'] == unique, 'Private preview ownership changed'
                time.sleep(.15)
                image, frame = capture(client, source, family + '-' + key)
            assert frame['visible'], (label, frame)
            assert frame['right_clear'] if family == 'follow' else frame['center_clear'], (label, frame)
            if family == 'sound':
                assert frame['max_alpha'] >= (150 if case.get('effect', {}).get('scene') else 230), (label, frame)
            results.append(dict(family=family, key=key, label=label, **frame))
            cards.setdefault(family, []).append((label, image))
        serial = fixture.set({})
        deadline = time.monotonic()+5
        while fixture.painted != serial and time.monotonic() < deadline:
            time.sleep(.1)
        time.sleep(.2)
        _, idle = capture(client, source, 'idle')
        assert not idle['visible'], idle
        for family, images in cards.items():
            contact_sheet(images, 'border-native-' + family + '-review.png')
        after = source_settings(client)
        preserved = before == after
        assert preserved, 'Another process changed the original input settings during QA; inspect without restoring.'
        assert client.send('GetCurrentProgramScene', {}, raw=True) == program, 'Program scene changed externally during QA'
        report = dict(passed=True, artwork_sha256=fingerprints, native_obs_cases=len(results), results=results,
                      idle_clear=True, program_scene_unchanged=True,
                      original_source_settings_levels_filters_tracks_preserved=preserved,
                      private_silent_source=True)
        (OUT / 'border-rework-obs-verification.json').write_text(json.dumps(report, indent=2))
        print(json.dumps({key: value for key, value in report.items() if key != 'results'}))
    finally:
        # Remove only the uniquely named resources created by this finite tool.
        try:
            if preview_before is not None and wait_ready(client,'GetStudioModeEnabled',{})['studioModeEnabled']:
                preview_now = wait_ready(client,'GetCurrentPreviewScene',{})['currentPreviewSceneName']
                if preview_now == unique:
                    wait_ready(client,'SetCurrentPreviewScene',{'sceneName': preview_before})
                    if not studio_before:
                        wait_ready(client,'SetStudioModeEnabled',{'studioModeEnabled': False})
            if input_created:
                wait_ready(client,'RemoveInput',{'inputName': source})
            if scene_created:
                wait_ready(client,'RemoveScene',{'sceneName': unique})
        finally:
            fixture.close()


if __name__ == '__main__':
    main()

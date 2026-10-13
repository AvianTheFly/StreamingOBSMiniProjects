"""Finite off-air raid audition. Screenshots only; no recording or replay save."""
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from verify_raid_obs import obs, state, post, capture, SOURCE


def main():
    client = obs.get_obs()
    for request in ('GetStreamStatus', 'GetRecordStatus'):
        assert not client.send(request, {}, raw=True)['outputActive'], 'Use the private preview while on air'
    current = state()
    assert not current['active'] and not current['queue'], 'Leave real incoming events uninterrupted'
    requests = [('settings','GetInputSettings','inputName'), ('volume','GetInputVolume','inputName'), ('mute','GetInputMute','inputName'), ('filters','GetSourceFilterList','sourceName'), ('tracks','GetInputAudioTracks','inputName')]
    def snapshot():
        result = {key: client.send(request, {arg: SOURCE}, raw=True) for key,request,arg in requests}
        result['scenes'] = {}
        for scene in ('Test','Lobbies','just screen','afk'):
            items = client.send('GetSceneItemList', {'sceneName':scene}, raw=True)['sceneItems']
            result['scenes'][scene] = [item for item in items if item['sourceName'] == SOURCE]
        return result
    before = snapshot()
    client.send('PressInputPropertiesButton', {'inputName':SOURCE,'propertyName':'refreshnocache'}, raw=True)
    time.sleep(3)
    assert state()['overlay_ready'], 'Refreshed OBS browser must become ready'
    post('test', {'kind':'raid','theme':'crab','name':'CaptainGoodVibes','count':420})
    deadline = time.monotonic() + 3
    while not state()['active'] and time.monotonic() < deadline:
        time.sleep(.1)
    assert state()['active']
    assert abs(state()['active']['duration'] - 6.550922) < .001
    out = ROOT / 'output/raid-music-sync'
    out.mkdir(parents=True, exist_ok=True)
    time.sleep(1.43)
    first = capture(client, out / 'obs-crossover-snack.png')
    assert first['visible'] and first['center_clear']
    from PIL import Image
    snack_image = Image.open(out / 'obs-crossover-snack.png').convert('RGBA')
    kirby_pixels = sum(a > 150 and r > 175 and 55 < g < 200 and b > 90 for r,g,b,a in snack_image.crop((35,175,170,285)).getdata())
    crew_pixels = sum(a > 150 and r > 135 and g < 105 and b < 130 for r,g,b,a in snack_image.crop((130,790,236,910)).getdata())
    assert kirby_pixels > 800 and crew_pixels > 150, 'Actual Kirby and Crewmate pose images must render in OBS'
    time.sleep(1.25)
    frame = capture(client, out / 'obs-border.png')
    assert frame['visible'] and frame['center_clear'], 'Raid must render around transparent gameplay'
    from PIL import Image
    image = Image.open(out / 'obs-border.png').convert('RGBA')
    left = sum(a > 180 for r,g,b,a in image.crop((0,170,240,840)).getdata())
    right = sum(a > 180 for r,g,b,a in image.crop((1680,170,1920,840)).getdata())
    assert left > 5000 and right > 5000, 'Both edge productions must render in OBS'
    headline = sum(a > 180 and r > 170 and g > 150 for r,g,b,a in image.crop((420,15,1500,158)).getdata())
    assert headline > 2500, 'The actual raider announcement must render in OBS'
    deadline = time.monotonic() + 6
    while state()['active'] and time.monotonic() < deadline:
        time.sleep(.2)
    time.sleep(.7)
    idle = capture(client, out / 'obs-idle.png')
    assert not idle['visible'], 'Expired raid must fully clear'
    assert snapshot() == before, 'Personal OBS settings, faders, filters, tracks and placements must stay intact'
    current = state()
    assert current['connected'] and current['subscriptions']['raid']['enabled']
    report = dict(passed=True, center_clear=True, puppet_pixels=dict(left=left,right=right), announcement_pixels=headline, sprite_pixels=dict(kirby=kirby_pixels,crewmate=crew_pixels), expiry_clear=True, personal_obs_settings_preserved=True, raid_subscription_enabled=True)
    (out / 'obs-verification.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == '__main__':
    main()

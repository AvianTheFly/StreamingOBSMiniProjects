"""Verify the configured shared source; --play auditions four local raids off air."""
import base64
import io
import json
from pathlib import Path
import re
import sys
import time
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from dotenv import load_dotenv
load_dotenv(ROOT/'.env')
import obs
from lib.settings_backups import SettingsBackups
BASE='http://127.0.0.1:7443'
SOURCE='Hub Twitch Celebrations'

def state():
    with urlopen(BASE+'/api/state',timeout=5) as r:return json.load(r)

def post(action,body):
    with urlopen(BASE,timeout=5) as r:html=r.read().decode()
    csrf=re.search(r"window.CSRF='([^']+)'",html).group(1)
    req=Request(BASE+'/api/'+action,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','X-Hub-CSRF':csrf})
    with urlopen(req,timeout=10) as r:return json.load(r)

def capture(client,path):
    from PIL import Image
    encoded=client.send('GetSourceScreenshot',dict(sourceName=SOURCE,imageFormat='png',imageWidth=1920,imageHeight=1080),raw=True)['imageData']
    data=base64.b64decode(encoded.split(',',1)[1]);path.write_bytes(data)
    image=Image.open(io.BytesIO(data)).convert('RGBA')
    alpha=image.getchannel('A')
    return {'visible':alpha.getbbox() is not None,'center_clear':alpha.crop((240,170,1680,840)).getbbox() is None}

def main():
    c=obs.get_obs()
    before=json.loads((ROOT/'tmp_obs_debug/raid-obs-before.json').read_text())
    SettingsBackups().snapshot()
    post('obs',{})
    settings=c.send('GetInputSettings',dict(inputName=SOURCE),raw=True)['inputSettings']
    for key,value in dict(url=BASE+'/overlay',width=1920,height=1080,fps=30,fps_custom=True,reroute_audio=True,shutdown=False,restart_when_active=False).items():assert settings.get(key)==value,(key,settings)
    for name,method,key in [('volume','GetInputVolume','inputName'),('mute','GetInputMute','inputName'),('filters','GetSourceFilterList','sourceName')]:
        assert c.send(method,{key:SOURCE},raw=True)==before[name],name+' changed'
    scenes=[]
    for scene in ['Test','Lobbies','just screen','afk']:
        items=c.send('GetSceneItemList',dict(sceneName=scene),raw=True)['sceneItems']
        entries=[i for i in items if i['sourceName']==SOURCE]
        assert len(entries)==1 and entries[0]['sceneItemEnabled'],scene
        assert entries[0]['sceneItemTransform']==before['scenes'][scene][0]['sceneItemTransform'],scene+' transform changed'
        scenes.append(scene)
    stream_track=obs.ensure_input_on_stream_track(SOURCE)
    assert c.send('GetInputAudioTracks',dict(inputName=SOURCE),raw=True)['inputAudioTracks'][str(stream_track)]
    current=state();assert current['overlay_ready'];assert current['connected'] and current['subscriptions']['raid']['enabled'],current['message']
    checks=[]
    if '--play' in sys.argv:
        assert not c.send('GetStreamStatus',{},raw=True)['outputActive'],'Use the private preview while live'
        assert not c.send('GetRecordStatus',{},raw=True)['outputActive'],'Use the private preview while recording'
        assert not current['active'] and not current['queue'],'Leave an incoming live event uninterrupted'
        out=ROOT/'tmp_obs_debug'
        for theme in ['crab','dragon','cat','frog']:
            post('test',dict(kind='raid',theme=theme,name='Raid preview • welcome, friends!',count=123))
            deadline=time.monotonic()+3
            while not state()['active'] and time.monotonic()<deadline:time.sleep(.1)
            start=time.monotonic();time.sleep(3.4)
            frame=capture(c,out/('raid-obs-'+theme+'.png'));assert frame['visible'] and frame['center_clear'],frame
            while state()['active'] and time.monotonic()-start<10:time.sleep(.3)
            time.sleep(.7)
            idle=capture(c,out/'raid-obs-idle.png');assert not idle['visible'],idle
            checks.append(dict(theme=theme,frame=frame,idle_clear=True))
    result=dict(passed=True,scenes=scenes,stream_track=stream_track,twitch_raid_enabled=True,obs_browser_ready=True,saved_levels_filters_transforms_preserved=True,actual_obs_renders=checks)
    (ROOT/'tmp_obs_debug/raid-obs-verification.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))

if __name__=='__main__':main()

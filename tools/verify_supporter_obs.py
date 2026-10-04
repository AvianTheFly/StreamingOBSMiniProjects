"""Read-only OBS checks, with explicit --play off-air local alert auditions."""
import base64
import io
import json
from pathlib import Path
import sys
import time
from PIL import Image
from verify_raid_obs import ROOT,SOURCE,obs,state,post,capture

def main():
    c=obs.get_obs()
    before=json.loads((ROOT/'tmp_obs_debug/supporter-obs-before.json').read_text())
    post('obs',{})
    for key,request,field in [('volume','GetInputVolume','inputName'),('mute','GetInputMute','inputName'),('filters','GetSourceFilterList','sourceName'),('tracks','GetInputAudioTracks','inputName')]:
        assert c.send(request,{field:SOURCE},raw=True)==before[key],key+' changed'
    for scene,old in before['scenes'].items():
        matches=[i for i in c.send('GetSceneItemList',dict(sceneName=scene),raw=True)['sceneItems'] if i['sourceName']==SOURCE]
        assert len(matches)==1 and matches[0]['sceneItemEnabled']
        assert matches[0]['sceneItemTransform']==old[0]['sceneItemTransform']
    deadline=time.monotonic()+40
    while not state()['connected'] and time.monotonic()<deadline:time.sleep(1)
    s=state();assert s['connected'] and s['overlay_ready'],s['message']
    for key in ('subscribe','resub','follow','raid','gift'):assert s['subscriptions'][key]['enabled'],key
    checks=[]
    if '--play' in sys.argv:
        assert not c.send('GetStreamStatus',{},raw=True)['outputActive']
        assert not c.send('GetRecordStatus',{},raw=True)['outputActive']
        assert not s['active'] and not s['queue']
        for kind,theme in [(k,t) for k in ('subscribe','follow') for t in ('crab','dragon','cat','frog')]+[('gift','cat')]:
            expected=2.2 if kind=='follow' else 3.8
            details={} if kind in ('follow','gift') else {'crab':dict(tier='1000'),'dragon':dict(tier='2000',months=24,renewal=True),'cat':dict(tier='3000',months=7,renewal=True),'frog':dict(months=1,renewal=True)}[theme]
            name={'crab':'PixelPaws','dragon':'MoonlitMoss','cat':'GoldenGoose','frog':'EmberWanderer'}[theme]
            post('test',dict(kind=kind,theme=theme,name=name,count=5,details=details))
            deadline=time.monotonic()+3
            while not state()['active'] and time.monotonic()<deadline:time.sleep(.1)
            active=state()['active'];assert active and active['duration']==expected
            time.sleep(.65 if kind=='follow' else 1.45)
            file=ROOT/'tmp_obs_debug'/f'{kind}-obs-{theme}.png'
            result=capture(c,file);assert result['visible']
            alpha=Image.open(file).convert('RGBA').getchannel('A')
            painted=sum(v>0 for v in alpha.tobytes())
            if kind=='follow':assert alpha.crop((800,0,1920,1080)).getbbox() is None
            else:
                assert result['center_clear'],'Subscriber show must leave gameplay center clear'
                assert max(alpha.crop((0,180,1920,830)).tobytes())>150,'Peripheral light heads must remain visible'
            deadline=time.monotonic()+5
            while state()['active'] and time.monotonic()<deadline:time.sleep(.2)
            time.sleep(.7)
            assert not capture(c,ROOT/'tmp_obs_debug/supporter-obs-idle.png')['visible']
            checks.append(dict(kind=kind,theme=theme,duration=expected,painted_pixels=painted,idle_clear=True))
    result=dict(passed=True,subscriptions=s['subscriptions'],overlay_ready=True,saved_levels_filters_transforms_tracks_preserved=True,actual_obs_renders=checks)
    (ROOT/'tmp_obs_debug/supporter-obs-verification.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))

if __name__=='__main__':main()

"""Finite off-air subscription audition. No recording, replay, or settings writes."""
import json
from pathlib import Path
import sys
import time
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from verify_raid_obs import obs,state,post,capture,SOURCE


def main():
    c=obs.get_obs()
    for request in ('GetStreamStatus','GetRecordStatus'):
        assert not c.send(request,{},raw=True)['outputActive'], 'Use private preview while on air'
    s=state();assert not s['active'] and not s['queue']
    def snapshot():
        requests=[('settings','GetInputSettings','inputName'),('volume','GetInputVolume','inputName'),('mute','GetInputMute','inputName'),('filters','GetSourceFilterList','sourceName'),('tracks','GetInputAudioTracks','inputName')]
        result={k:c.send(request,{field:SOURCE},raw=True) for k,request,field in requests}
        result['scenes']={scene:[i for i in c.send('GetSceneItemList',{'sceneName':scene},raw=True)['sceneItems'] if i['sourceName']==SOURCE] for scene in ('Test','Lobbies','just screen','afk')}
        result['celebration_settings']=state()['settings']
        return result
    before=snapshot()
    c.send('PressInputPropertiesButton',{'inputName':SOURCE,'propertyName':'refreshnocache'},raw=True)
    time.sleep(3)
    assert state()['overlay_ready']
    out=ROOT/'output/subscriber-party';out.mkdir(parents=True,exist_ok=True)
    rows=[]
    for months in (1,6):
        assert not state()['active'] and not state()['queue']
        post('test',{'kind':'subscribe','theme':'crab','name':'CaptainGoodVibes','count':1,'details':{'months':months,'renewal':months>1}})
        deadline=time.monotonic()+3
        while not state()['active'] and time.monotonic()<deadline:time.sleep(.05)
        active=state()['active'];assert active and active['duration']==4.8
        # Wait on the actual event position, so HTTP setup time does not move the capture.
        while state()['active'] and state()['active']['elapsed']<3.9:time.sleep(.03)
        file=out/f'obs-{months}-months.png';result=capture(c,file)
        assert result['visible'] and result['center_clear']
        im=Image.open(file).convert('RGBA')
        header=sum(a>180 and r>150 and g>130 for r,g,b,a in im.crop((460,15,1460,160)).getdata())
        assert header>2000,'Actual name/thank-you must render'
        extras=sum(a>100 for r,g,b,a in im.crop((0,350,240,650)).getdata())
        if months==6:assert extras>2000,'Six months must visibly add the cauldron guest'
        else:assert extras==0,'One month stays light'
        rows.append(dict(months=months,duration=active['duration'],center_clear=True,header_pixels=header,extra_guest_pixels=extras))
        deadline=time.monotonic()+4
        while state()['active'] and time.monotonic()<deadline:time.sleep(.1)
        time.sleep(.6);assert not capture(c,out/'obs-idle.png')['visible']
    assert snapshot()==before,'Preserve personal settings/faders/filters/tracks/placements'
    s=state();assert s['connected'] and s['subscriptions']['subscribe']['enabled'] and s['subscriptions']['resub']['enabled']
    report=dict(passed=True,variants=rows,expiry_clear=True,personal_settings_preserved=True,subscriptions_ready=True)
    (out/'obs-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))


if __name__=='__main__':main()

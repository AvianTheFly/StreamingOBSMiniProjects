"""Off-air verification of the installed waiting room via its public Hub API."""
import base64
import json
import time
from pathlib import Path
from urllib.request import Request, urlopen
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.paths import load_project_env
load_project_env()
import obs

BASE='http://127.0.0.1:7420'
OUT=Path(__file__).resolve().parents[1]/'output'/'starting-soon-v2'


def request(path,body=None):
    req=Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,
                headers={'Content-Type':'application/json'})
    with urlopen(req,timeout=8) as response:
        return json.load(response)


def wait(predicate,timeout=12):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        state=request('/api/starting-soon')
        if predicate(state):
            return state
        if state.get('error'):
            raise RuntimeError(state['error'])
        time.sleep(.2)
    raise TimeoutError('Starting Soon state did not settle')


def screenshot(client,name):
    shot=client.send('GetSourceScreenshot',dict(sourceName='Starting Soon',imageFormat='png',imageWidth=1920,imageHeight=1080),raw=True)
    (OUT/name).write_bytes(base64.b64decode(shot['imageData'].split(',',1)[1]))


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    client=obs.get_obs()
    if client.get_stream_status().output_active or client.get_record_status().output_active:
        raise RuntimeError('Live output active; use isolated browser verification.')
    before=obs.get_current_scene()
    originals={i['inputName']:client.get_input_volume(i['inputName']).input_volume_db for i in client.get_input_list().inputs
               if i['inputName'] in {'InstantReplayMedia','SoundboardMedia','Desktop Audio'}}
    request('/api/starting-soon/install',{});wait(lambda s:s['ready'])
    items=client.send('GetSceneItemList',dict(sceneName='Starting Soon'),raw=True)
    assert obs.get_current_scene()==before
    request('/api/starting-soon/start',{});wait(lambda s:s['active'])
    config=request('/api/starting-soon')
    changed=False
    try:
        assert obs.get_current_scene()=='Starting Soon'
        time.sleep(3);screenshot(client,'obs-idle.png')
        rows=request('/api/projects/instant_replay/clips')['clips']
        assert rows,'Need a saved clip to verify actual playback'
        clip=min((r for r in rows if r['path'].lower().endswith(('.mp4','.mkv'))),key=lambda r:r['size_bytes'])
        request('/api/starting-soon/settings',dict(revision=config['revision'],
            clip_layouts={**config['clip_layouts'],clip['path']:{'layout':'corner'}}))
        changed=True
        request('/api/starting-soon/play',{'paths':[clip['path']]})
        wait(lambda s:s['playing'] and s['clip_box']==[1020,530,800,450],20)
        time.sleep(1.2)
        status=obs.get_media_status('Hub Starting Soon Clips')
        assert status['state']=='OBS_MEDIA_STATE_PLAYING' and status['cursor_ms']>0,status
        assert client.send('GetSourceActive',{'sourceName':'Hub Starting Soon Clips'},raw=True)['videoActive']
        stage_item=client.get_scene_item_id('Hub Starting Soon Stage','Hub Starting Soon Clips').scene_item_id
        native_box=client.get_scene_item_transform('Hub Starting Soon Stage',stage_item).scene_item_transform
        canvas=client.get_video_settings()
        assert native_box['positionX']==1020*canvas.base_width/1920
        assert native_box['boundsWidth']==800*canvas.base_width/1920
        state=wait(lambda s:s.get('position_ms',0)>0 and s.get('duration_ms',0)>0)
        request('/api/starting-soon/pause',{})
        wait(lambda s:s['session_queue']['paused'])
        time.sleep(.5)
        assert obs.get_media_status('Hub Starting Soon Clips')['state']=='OBS_MEDIA_STATE_PAUSED'
        request('/api/starting-soon/queue-next',{'paths':[clip['path']]})
        state=wait(lambda s:len(s['session_queue']['upcoming'])>=2)
        queued=state['session_queue']['upcoming'][0]['entry_id']
        request('/api/starting-soon/queue-remove',{'entry_id':queued})
        wait(lambda s:all(r['entry_id']!=queued for r in s['session_queue']['upcoming']))
        request('/api/starting-soon/resume',{})
        wait(lambda s:not s['session_queue']['paused'])
        request('/api/starting-soon/skip',{})
        if config['gap_seconds']:
            wait(lambda s:s.get('gap_remaining',0)>0)
            assert not request('/api/starting-soon')['playing']
            request('/api/starting-soon/skip',{})
        wait(lambda s:s['playing'] and s['session_queue']['played']>=1)
        screenshot(client,'obs-playing.png')
        request('/api/starting-soon/stop',{});wait(lambda s:not s['playing'])
        assert obs.get_current_scene()=='Starting Soon'
    finally:
        request('/api/starting-soon/resume',{})
        if changed:
            current=request('/api/starting-soon')
            overrides=dict(current['clip_layouts'])
            if overrides.get(clip['path'])=={'layout':'corner'}:
                if clip['path'] in config['clip_layouts']:
                    overrides[clip['path']]=config['clip_layouts'][clip['path']]
                else:
                    overrides.pop(clip['path'],None)
                request('/api/starting-soon/settings',dict(revision=current['revision'],clip_layouts=overrides))
        request('/api/starting-soon/finish',{})
        for _ in range(60):
            if not request('/api/starting-soon')['active']:
                break
            time.sleep(.2)
        else:
            raise TimeoutError('Waiting room did not finish cleanup')
    assert obs.get_current_scene()==before
    assert client.send('GetSceneItemList',dict(sceneName='Starting Soon'),raw=True)['sceneItems'][0]['sceneItemTransform']==items['sceneItems'][0]['sceneItemTransform']
    for name,volume in originals.items():
        assert client.get_input_volume(name).input_volume_db==volume,(name,volume)
    print(json.dumps(dict(verified=True,previous_scene=before,clips=len(rows),played=clip['name'],media_status=status,
                         restored_scene=True,existing_faders_preserved=True)))


if __name__=='__main__':
    main()

"""Off-air check of the public quick capture API, real buffer, pool and fast entry."""
import json
import time
from pathlib import Path
from tools.verify_replay_studio_obs import request, wait, obs, ROOT


def main():
    c=obs.get_obs()
    assert not c.get_stream_status().output_active and not c.get_record_status().output_active
    assert not request('/api/projects/instant_replay/stage')['active']
    original=c.get_current_program_scene().current_program_scene_name
    global_transition=c.get_current_scene_transition().transition_name
    overrides={s:(c.get_scene_scene_transition_override(s).transition_name,c.get_scene_scene_transition_override(s).transition_duration) for s in [original,'InstantReplay']}
    was_running=c.get_replay_buffer_status().output_active
    twitch=request('/api/projects/instant_replay/clips')['twitch_clip']
    entered=None;started=None;held=False;samples=[]
    try:
        if not was_running:
            c.start_replay_buffer()
            time.sleep(7)
        request('/api/projects/instant_replay/capture',{'seconds':5})
        deadline=time.monotonic()+35
        capture=None
        while time.monotonic()<deadline:
            s=request('/api/projects/instant_replay/stage')
            if s['capture']['status']=='error':raise RuntimeError(s['capture']['message'])
            if s['capture']['status']=='ready':capture=s['capture']
            scene=c.get_current_program_scene().current_program_scene_name
            if scene=='InstantReplay' and entered is None:entered=time.monotonic()
            if entered is not None:
                media=obs.get_media_status('InstantReplayMedia')
                cursor=c.get_current_scene_transition_cursor().transition_cursor
                samples.append(dict(phase=s['phase'],elapsed=round(time.monotonic()-entered,3),media=media,transition_cursor=cursor))
                paused=[x['media']['cursor_ms'] for x in samples if x['media']['state']=='OBS_MEDIA_STATE_PAUSED']
                # Stream-copied buffer tracks can start with a small encoded PTS
                # offset. Require the same initial frame, with no advancement.
                held=len(paused)>=3 and len(set(paused))==1 and 0<=paused[0]<=150
            if s['phase']=='playing' and s['cursor_ms']>300:
                started=time.monotonic();assert s['mode']=='replay';break
            time.sleep(.025)
        assert capture and entered and started
        assert held,'The real decoder must hold the initial frame during the entry transition: '+json.dumps(samples)
        assert started-entered<1.5,'Quick entry must not run the full spirit performance'
        library=json.loads((ROOT/'mini projects/instant_replay/replay_library.json').read_text(encoding='utf-8'))
        path=capture['path'];meta=next(m for m in library['clips'].values() if m.get('path')==path)
        raw=meta['capture_source']
        assert meta['purpose']=='replay_only'
        assert next(m for m in library['clips'].values() if m.get('path')==raw)['purpose']=='replay_only'
        assert not any(row['path'] in [path,raw] for row in request('/api/projects/instant_replay/clips?purpose=highlight')['clips'])
        assert any(row['path']==path for row in request('/api/projects/instant_replay/clips?purpose=replay_only')['clips'])
        assert request('/api/projects/instant_replay/clips')['twitch_clip']==twitch
        request('/api/projects/instant_replay/revert',{})
        wait(lambda:not request('/api/projects/instant_replay/clips')['busy'])
        wait(lambda:c.get_current_program_scene().current_program_scene_name==original)
        assert c.get_current_scene_transition().transition_name==global_transition
        assert overrides=={s:(c.get_scene_scene_transition_override(s).transition_name,c.get_scene_scene_transition_override(s).transition_duration) for s in overrides}
        result=dict(verified=True,cut=path,original=raw,mode='replay',first_frame_held=held,entry_to_playing_seconds=round(started-entered,3),twitch_unchanged=True,excluded_from_highlight_pool=True,return_scene=original,global_transition_preserved=True)
        (ROOT/'output/replay-studio-v3/capture-intent-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps(result))
    finally:
        request('/api/projects/instant_replay/revert',{})
        if not was_running:c.stop_replay_buffer()


if __name__=='__main__':main()

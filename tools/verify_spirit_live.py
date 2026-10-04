"""Finite native OBS QA over synthetic scenes, held by an observed SceneSession.

Run with this checkout's Hub stopped and no active stream/recording. This tool
owns its event subscription, capture and temporary scenes through cleanup.
"""
from pathlib import Path
import json
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
MEDIA = Path('C:/StreamingMedia/Transitions/udyr-spirits-v10')
EXPECTED = {s + suffix for s in ('bear', 'turtle', 'ram', 'phoenix') for suffix in ('', '-alt')}


def verify():
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
    import obs
    from lib.coordination.scenes import scene_director
    from lib.coordination.scene_session import SceneSession
    from lib.coordination.scene_events import start_scene_events, join_scene_events
    from lib.coordination.playback import coordinator
    from lib.settings_backups import SettingsBackups

    client = obs.get_obs()
    def call(name, **args):
        return client.send(name, args, raw=True)
    def state():
        response = call('GetCurrentSceneTransition')
        assert response['transitionKind'] == 'hub_spirit_transition'
        return response['transitionSettings']

    assert not call('GetStreamStatus')['outputActive']
    assert not call('GetRecordStatus')['outputActive']
    original_studio_mode = call('GetStudioModeEnabled')['studioModeEnabled']
    if '--studio' in sys.argv and '--normal' in sys.argv:
        raise ValueError('Choose either --studio or --normal')
    studio_mode = True if '--studio' in sys.argv else False if '--normal' in sys.argv else original_studio_mode
    SettingsBackups().snapshot()
    changed_mode=studio_mode != original_studio_mode
    if changed_mode:
        call('SetStudioModeEnabled',studioModeEnabled=studio_mode)
    run_id=time.time_ns()
    names = [f'Hub Spirit QA {run_id} {i}' for i in range(2)]
    colors = [(16, 216, 88), (216, 16, 168)]
    made, events, starts = [], [], []
    session, recording = None, False
    cleanup = {}
    stop = threading.Event()
    output = MEDIA / 'qa-native'
    output.mkdir(exist_ok=True)
    start_scene_events(stop)
    try:
        for _ in range(40):
            if scene_director.snapshot()['observing']:
                break
            time.sleep(.1)
        assert scene_director.snapshot()['observing'], 'Scene observation must be ready'
        for name, (r, g, b) in zip(names, colors):
            call('CreateScene', sceneName=name)
            made.append(name)
            call('CreateInput', sceneName=name, inputName=name+' color', inputKind='color_source_v3',
                 inputSettings={'width':1920, 'height':1080, 'color':0xff000000|(b<<16)|(g<<8)|r},
                 sceneItemEnabled=True)
        session = SceneSession('spirit_native_qa', names[0], names[0])
        assert session.activate()
        time.sleep(7.2)
        call('StartRecord')
        recording = True
        # StartRecord acknowledges before the encoder has started. Its response
        # is not the recording's frame-zero clock. Wait for captured frames and
        # timestamp each take from OBS's frame-count-based outputDuration.
        for _ in range(100):
            capture_status = call('GetRecordStatus')
            if capture_status['outputActive'] and capture_status['outputDuration'] >= 1000:
                break
            time.sleep(.1)
        else:
            raise RuntimeError('Recording did not begin capturing frames')
        stats_before=call('GetStats')
        current, seen = 0, set()
        for _ in range(12):
            old = state()
            current = 1-current
            capture_status = call('GetRecordStatus')
            assert capture_status['outputActive'] and not capture_status['outputPaused']
            begin = capture_status['outputDuration']/1000
            assert session.present(names[current]), 'A newer scene choice cancelled QA'
            time.sleep(.1)
            selected = state()
            assert selected['runtime_serial'] == old['runtime_serial']+1
            assert selected['runtime_spirit'] != old['runtime_spirit']
            assert selected['runtime_playing']
            seen.add(selected['runtime_clip'])
            events.append({'begin':begin, 'destination':colors[current], 'clip':selected['runtime_clip'],
                           'spirit':selected['runtime_spirit'], 'serial':selected['runtime_serial'],
                           'cut_ms':selected['runtime_cut_ms']})
            time.sleep(7.1)
            idle = state()
            assert idle['runtime_serial'] == selected['runtime_serial'] and not idle['runtime_playing']
            assert session.owns_scene(), 'External selection cancelled QA'
            print(f"{selected['runtime_clip']}: completed, no tail replay", flush=True)
            if seen == EXPECTED:
                break
        assert seen == EXPECTED, seen
        stats_after=call('GetStats')
        performance={key:stats_after[key]-stats_before[key] for key in
                     ('renderSkippedFrames','renderTotalFrames','outputSkippedFrames','outputTotalFrames')}
        performance['activeFps']=stats_after['activeFps']
        capture = call('StopRecord')['outputPath']
        recording = False
        target = output / f'timing-{run_id}.mp4'
        for _ in range(50):
            try:
                Path(capture).replace(target)
                break
            except PermissionError:
                time.sleep(.1)
        else:
            raise RuntimeError('Recording did not finish closing')
        # Studio Mode may coalesce in-flight program requests before a native
        # start. Exercise one-to-one interruption starts in regular mode only.
        for _ in range(0 if studio_mode else 8):
            old = state()
            current = 1-current
            assert session.present(names[current])
            time.sleep(.22)
            selected = state()
            assert selected['runtime_serial'] == old['runtime_serial']+1
            assert selected['runtime_spirit'] != old['runtime_spirit']
            starts.append({'serial':selected['runtime_serial'], 'spirit':selected['runtime_spirit'],
                           'clip':selected['runtime_clip']})
        # Finish the interruption series while its scene lease still owns the
        # return, before delayed OBS completion echoes arrive for rapid takes.
        if starts:
            owned=session.owns_scene()
            cleanup={'previous_scene':session.previous,'returned_while_owned':owned,
                     'ownership':scene_director.snapshot()}
            session.finish()
        time.sleep(7.2)
        idle = state()
        assert not idle['runtime_playing']
        time.sleep(1)
        assert state() == idle, 'Interrupted playback caused a phantom tail start'
        bags = {}
        for entry in events+starts:
            bags.setdefault((entry['serial']-1)//4, []).append(entry['spirit'])
        assert all(len(bag) == len(set(bag)) for bag in bags.values())
    finally:
        if recording:
            call('StopRecord')
        if session is not None and not session.finished:
            owned = session.owns_scene()
            cleanup={'previous_scene':session.previous,'returned_while_owned':owned,
                     'ownership':scene_director.snapshot()}
            session.finish()
            if owned:
                time.sleep(7.2)
        if changed_mode and call('GetStudioModeEnabled')['studioModeEnabled']==studio_mode:
            call('SetStudioModeEnabled',studioModeEnabled=original_studio_mode)
        current_scene = call('GetSceneList')['currentProgramSceneName']
        # A user-selected QA scene is preserved, including its active source.
        if current_scene not in made:
            for name in made:
                call('RemoveScene', sceneName=name)
        stop.set()
        join_scene_events()
        coordinator.shutdown()
        print('QA session released; newer user selections preserved.', flush=True)
    # Expensive offline decoding must not retain a temporary scene or pause claim.
    from lib.json_store import write_json
    report={'passed':False,'studio_mode':studio_mode,'events':events,'rapid_starts':starts,
            'recording':str(target),'cleanup':cleanup,'performance':performance}
    try:
        for kind in ('render','output'):
            assert performance[kind+'TotalFrames']>0
            assert performance[kind+'SkippedFrames']/performance[kind+'TotalFrames'] <= .005, f'OBS {kind} missed more than 0.5% of frames: {performance}'
        validate_capture(target, events)
        report['passed']=True
    except Exception as error:
        report['error']=str(error)
        raise
    finally:
        write_json(output/f'validation-{run_id}.json',report)
        write_json(MEDIA/'live-validation.json',report)


def validate_capture(file, events):
    probe = json.loads(subprocess.check_output(
        ['ffprobe','-v','error','-show_streams','-of','json',str(file)]))
    rate = next(s['r_frame_rate'] for s in probe['streams'] if s['codec_type']=='video')
    a, b = map(int, rate.split('/'))
    fps = a/b
    assert fps == 60, f'Live OBS output was {fps} fps'
    raw = subprocess.check_output(['ffmpeg','-v','error','-threads','4','-i',str(file),
        '-filter_threads','2',
        '-vf','scale=32:18:flags=neighbor','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
    frames = [raw[n:n+1728] for n in range(0,len(raw),1728)]
    corners = [0,31*3,17*32*3,(18*32-1)*3]
    def matches(frame, rgb):
        return any(max(abs(frame[p+j]-rgb[j]) for j in range(3)) < 10 for p in corners)
    colors = [(16,216,88),(216,16,168)]
    for event in events:
        start = round((event['begin']+.25)*fps)
        end = min(len(frames),round((event['begin']+6.7)*fps))
        first = next(i for i in range(start,end) if matches(frames[i],event['destination']))
        elapsed = first/fps-event['begin']
        assert elapsed >= 4.15, f"{event['clip']}: destination leaked after {elapsed:.3f}s"
        old = colors[1-colors.index(tuple(event['destination']))]
        assert all(not matches(frames[i],old) for i in range(first,end)), 'Old scene flashed back after reveal'
        covered = 0
        for i in range(first-1,start-1,-1):
            if matches(frames[i],old) or matches(frames[i],event['destination']):
                break
            covered += 1
        assert covered >= 6, (event, covered)
        assert matches(frames[end-1],event['destination']), 'Final destination did not remain visible'
        event.update(first_destination_seconds=elapsed, covered_frames_before_reveal=covered)
        print(f"{event['clip']}: first destination {elapsed:.3f}s; {covered} covered frames before reveal",flush=True)


if __name__ == '__main__':
    verify()


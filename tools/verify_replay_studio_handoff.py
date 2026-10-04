"""Off-air integration check: two real cuts, browser handoff and preserved sources."""
import base64
import json
import time
from pathlib import Path

from tools.verify_replay_studio_obs import request, wait, obs, ROOT

OUT = ROOT / 'output' / 'replay-studio-v3'


def screenshot(client, name):
    value = client.send('GetSourceScreenshot', {'sourceName': 'InstantReplay', 'imageFormat': 'png',
                        'imageWidth': 1920, 'imageHeight': 1080}, raw=True)['imageData']
    path = OUT / name
    path.write_bytes(base64.b64decode(value.split(',', 1)[1]))
    return str(path)


def placements(client, scene):
    derived = {'width', 'height', 'sourceWidth', 'sourceHeight'}
    return [{**i, 'sceneItemTransform': {k: v for k, v in i['sceneItemTransform'].items() if k not in derived}}
            for i in client.get_scene_item_list(scene).scene_items]


def main():
    client = obs.get_obs()
    assert not client.get_stream_status().output_active and not client.get_record_status().output_active
    assert not request('/api/projects/instant_replay/stage')['active']
    OUT.mkdir(parents=True, exist_ok=True)
    current = client.get_current_program_scene().current_program_scene_name
    transition = client.get_current_scene_transition().transition_name
    originals = {scene: placements(client, scene) for scene in ('Test', 'FaceCamWithProps')}
    inputs = {name: (client.get_input_settings(name).input_settings,
                     client.get_source_filter_list(name).filters) for name in ('Display Capture', 'lens studio')}
    desktop_mute = obs.get_input_mute('Desktop Audio')
    listing = request('/api/projects/instant_replay/clips')
    candidates = [c for c in listing['clips'] if c.get('game') and c['path'].lower().endswith('.mkv')]
    selected = sorted(candidates, key=lambda c: c.get('size_bytes', 0), reverse=True)[:2]
    assert len(selected) == 2
    results = []
    try:
        for mode in ('replay', 'showcase'):
            request('/api/projects/instant_replay/play', {'paths': [c['path'] for c in selected], 'mode': mode})
            first = wait(lambda: (s if (s := request('/api/projects/instant_replay/stage'))['phase'] == 'playing'
                                  and s['cursor_ms'] > 600 else None), timeout=20)
            assert first['index'] == 1 and first['camera'], json.dumps(first)
            # OBS's browser can still be finishing its idle poll and loading fade
            # when the worker first reports playback. Capture the settled stage.
            time.sleep(1.8)
            frame = screenshot(client, f'{mode}-obs.png')
            refs = client.get_scene_item_list('InstantReplay').scene_items
            camera = next(i for i in refs if i['sourceName'] == 'FaceCamWithProps')
            assert camera['sceneItemEnabled'] and camera['sceneItemTransform']['boundsWidth'] == 384
            if first['view'] == 'live':
                live = next(i for i in refs if i['sourceName'] == 'Display Capture')
                assert live['sceneItemEnabled'] and live['sceneItemTransform']['sourceWidth'] > 0
                assert camera['sceneItemTransform']['positionY'] > live['sceneItemTransform']['positionY'] + 216
            request('/api/projects/instant_replay/skip', {})
            phases, held, reveal_samples = [], False, []
            deadline = time.monotonic() + 20
            transition_image = None
            while time.monotonic() < deadline:
                s = request('/api/projects/instant_replay/stage')
                if s['index'] == 2:
                    if s['phase'] not in phases:
                        phases.append(s['phase'])
                    if s['phase'] == 'loading':
                        cover = next(i for i in client.get_scene_item_list('InstantReplay').scene_items
                                     if i['sourceName'] == 'ReplayStudioCover')
                        after = request('/api/projects/instant_replay/stage')
                        assert cover['sceneItemEnabled'] or after['phase'] != 'loading'
                    if s['phase'] == 'revealing':
                        media = obs.get_media_status('InstantReplayMedia')
                        if media['state'] == 'OBS_MEDIA_STATE_PAUSED':
                            reveal_samples.append(media)
                        # Native decoding reports the first encoded frame at 16–33 ms,
                        # even after SetMediaInputCursor(0). Require that frame to stay held.
                        held = len(reveal_samples) >= 3 and all(0 <= sample['cursor_ms'] <= 33 for sample in reveal_samples)
                        if held and not transition_image:
                            transition_image = screenshot(client, f'{mode}-handoff-obs.png')
                    if s['phase'] == 'playing' and s['cursor_ms'] > 600:
                        assert s['cue']['covered'] and s['cue']['revealed'], 'Actual OBS browser must acknowledge both frames'
                        assert held, 'The new clip must stay at its first frame throughout reveal: ' + json.dumps(reveal_samples)
                        break
                time.sleep(.04)
            else:
                raise TimeoutError(f'{mode}: handoff did not finish; observed {phases}')
            assert 'covering' in phases and 'loading' in phases and 'revealing' in phases
            request('/api/projects/instant_replay/pause', {})
            wait(lambda: request('/api/projects/instant_replay/stage')['paused'])
            request('/api/projects/instant_replay/resume', {})
            wait(lambda: not request('/api/projects/instant_replay/stage')['paused'])
            request('/api/projects/instant_replay/revert', {})
            wait(lambda: not request('/api/projects/instant_replay/clips')['busy'])
            assert client.get_current_program_scene().current_program_scene_name == current
            results.append(dict(mode=mode, style=first['clip_transition'], phases=phases,
                                cover_and_reveal_acknowledged=True, first_frame_held=True,
                                reveal_samples=reveal_samples, screenshot=frame, handoff_screenshot=transition_image))
    finally:
        request('/api/projects/instant_replay/revert', {})
    assert {scene: placements(client, scene) for scene in originals} == originals
    assert {name: (client.get_input_settings(name).input_settings,
                   client.get_source_filter_list(name).filters) for name in inputs} == inputs
    assert obs.get_input_mute('Desktop Audio') == desktop_mute
    assert client.get_current_scene_transition().transition_name == transition
    assert client.get_record_directory().record_directory.replace('\\', '/') == 'C:/StreamingMedia/Replays'
    result = dict(verified=True, modes=results, original_capture_camera_filters_placements_preserved=True,
                  return_scene=current, global_transition=transition)
    (OUT / 'obs-verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()

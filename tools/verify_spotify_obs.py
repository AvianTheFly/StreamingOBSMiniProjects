"""Finite native-OBS rendering QA with silent production-DSP fixture data.

Owns one uniquely named temporary scene/input and one bounded loopback server.
Never changes the program scene, Spotify playback, or an existing source.
"""
import base64
import hashlib
import io
from PIL import Image
import json
import os
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths()
load_project_env()
import obs
from lib.settings_backups import SettingsBackups
from spotify.http_server import WEB as PRODUCTION_WEB
WEB = Path(os.environ.get("SPOTIFY_NATIVE_WEB", PRODUCTION_WEB))


def main():
    SettingsBackups().snapshot()
    study = Path(os.environ.get('SPOTIFY_NATIVE_AUDIO_STUDY', ROOT / 'output/spotify/audio-study.json'))
    live = os.environ.get("SPOTIFY_NATIVE_LIVE") == "1"
    frames = [] if live else json.loads(study.read_text())
    start_frame = int(float(os.environ.get('SPOTIFY_NATIVE_AUDIO_START', '50'))*30)
    begun = time.monotonic()
    evidence = {'errors': [], 'qa_clock': 'native requestAnimationFrame', 'audio_source': 'Actual live Spotify capture over production HTTP' if live else 'Silent production-DSP fixture'}
    native_timings = []
    native_views = []
    selected_stage = [0]
    lock = threading.Lock()
    probe = b'<script>' + (ROOT / 'tools/fixtures/spotify_native_probe.js').read_bytes() + b'</script>'

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            url = urlsplit(self.path)
            if url.path == '/api/state':
                if live:
                    from urllib.request import urlopen
                    with urlopen('http://127.0.0.1:7447'+self.path, timeout=2) as upstream:
                        data = json.load(upstream)
                    data['qa_stage'] = selected_stage[0]
                else:
                    index = (start_frame + int((time.monotonic() - begun) * 30)) % len(frames)
                    data = dict(frames[index], playing=True, title='Journey visual study', artist='Silent native OBS QA', qa_stage=selected_stage[0])
                payload, mime = json.dumps(data).encode(), 'application/json'
            elif url.path == '/diagnostics':
                query = parse_qs(url.query)
                with lock:
                    if 'error' in query:
                        evidence['errors'].append(query['error'][0])
                    if 'state' in query:
                        evidence.update(json.loads(query['state'][0]))
                        if len(native_timings) < 160:
                            native_timings.append((evidence.get('nativeNow', 0), evidence.get('graphics', {}).get('frames', 0), evidence.get('paintMs', 0)))
                        if len(native_views) < 160 and evidence.get('view'):
                            native_views.append({axis: evidence['view'][axis] for axis in ('yaw', 'tilt', 'roll')})
                payload, mime = b'{}', 'application/json'
            elif url.path in ('/overlay', '/overlay.css', '/overlay.js', '/surface.js', '/filament.js', '/reactive.js', '/forms.js', '/performance.js', '/radiance.js', '/music_strings.js', '/music_pacing.js', '/music_motion.js', '/music_space.js', '/journey.js', '/music_feed.js', '/stage_palette.js', '/stage_spirits.js', '/stage_geometry.js', '/stage_morph.js', '/stage_depth.js', '/stage_renderer.js'):
                name = 'overlay.html' if url.path == '/overlay' else url.path[1:]
                payload = (WEB / name).read_bytes()
                if name == 'overlay.html':
                    payload = payload.replace(b'</body>', probe + b'</body>')
                mime = {'html': 'text/html', 'css': 'text/css', 'js': 'application/javascript'}[name.rsplit('.', 1)[1]]
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            try:
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    worker = threading.Thread(target=server.serve_forever, name='finite-spotify-obs-qa', daemon=True)
    worker.start()
    client = obs.get_obs()
    scene = '__Visualizer QA ' + uuid.uuid4().hex[:12]
    source = scene + ' browser'
    created_scene = created_source = False
    out = ROOT / os.environ.get('SPOTIFY_STILL_OUTPUT', 'output/spotify/radiance')
    out.mkdir(parents=True, exist_ok=True)
    before = dict(settings=client.send('GetInputSettings', {'inputName': 'Hub Spotify Visualizer'}, raw=True),
                  items=client.send('GetSceneItemList', {'sceneName': 'Spotify Overlay'}, raw=True),
                  filters=client.send('GetSourceFilterList', {'sourceName': 'Hub Spotify Visualizer'}, raw=True))
    files = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in SettingsBackups().paths() if p.exists() and not p.name.endswith('workflows.json')}
    try:
        client.send('CreateScene', {'sceneName': scene}, raw=True)
        created_scene = True
        # Keep this owned scene fully transparent while allowing OBS to render
        # its on-canvas children. Off-canvas culling suspends browser textures.
        client.send('CreateSourceFilter', dict(sourceName=scene, filterName='Invisible QA wrapper',
                    filterKind='color_filter', filterSettings={'opacity': 0}), raw=True)
        client.send('CreateInput', dict(sceneName=scene, inputName=source, inputKind='browser_source',
                    inputSettings=dict(url=f'http://127.0.0.1:{server.server_port}/overlay', width=1200, height=900,
                                       fps=before['settings']['inputSettings'].get('fps', 30), fps_custom=True,
                                       shutdown=False), sceneItemEnabled=True), raw=True)
        created_source = True
        # OBS suspends animation callbacks for sources outside the active graph.
        # Render the transparent QA wrapper without a program-scene write.
        program = client.send('GetCurrentProgramScene', {}, raw=True)['currentProgramSceneName']
        video = client.send('GetVideoSettings', {}, raw=True)
        item = client.send('CreateSceneItem', dict(sceneName=program, sourceName=scene,
                           sceneItemEnabled=False), raw=True)['sceneItemId']
        client.send('SetSceneItemTransform', dict(sceneName=program, sceneItemId=item,
                    sceneItemTransform=dict(positionX=0, positionY=0)), raw=True)
        client.send('SetSceneItemEnabled', dict(sceneName=program, sceneItemId=item,
                    sceneItemEnabled=True), raw=True)
        if os.environ.get('SPOTIFY_NATIVE_PROJECTOR') == '1':
            # A source projector supplies a native active graph when the host's
            # nested program scene suppresses invisible child browser callbacks.
            # It is exclusively this owned disposable input, never a user source.
            client.send('OpenSourceProjector', dict(sourceName=source, monitorIndex=-1), raw=True)
        def follow_active_graph():
            # Other Hub work may legitimately select a scene during finite QA.
            # Move only our transparent wrapper; never select a program scene.
            nonlocal program, item
            current = client.send('GetCurrentProgramScene', {}, raw=True)['currentProgramSceneName']
            if current == program:
                return
            old_program, old_item = program, item
            item = client.send('CreateSceneItem', dict(sceneName=current, sourceName=scene,
                               sceneItemEnabled=True), raw=True)['sceneItemId']
            program = current
            client.send('RemoveSceneItem', dict(sceneName=old_program, sceneItemId=old_item), raw=True)
        deadline = time.monotonic() + 20
        next_render_probe = 0
        while time.monotonic() < deadline:
            with lock:
                if evidence.get('graphics', {}).get('frames', 0) > 20:
                    break
                if evidence['errors']:
                    raise AssertionError(evidence['errors'])
            if time.monotonic() >= next_render_probe:
                follow_active_graph()
                # Pull an actual source render while OBS preview/output is idle.
                # This does not change scenes or substitute a browser clock.
                client.send('GetSourceScreenshot', dict(sourceName=source, imageFormat='png',
                            imageWidth=400, imageHeight=300), raw=True)
                next_render_probe = time.monotonic() + .5
            time.sleep(.1)
        with lock:
            assert evidence.get('renderer') == 'webgl2', evidence
            assert evidence.get('glError') == 0, evidence
            assert not evidence['errors'], evidence
        scene_names = evidence['catalog']
        assert scene_names and len(set(scene_names)) == len(scene_names), evidence
        rendered_scenes = []
        for i, name in enumerate(scene_names):
            follow_active_graph()
            selected_stage[0] = i
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                with lock:
                    if evidence.get('name') == name:
                        break
                time.sleep(.1)
            assert evidence.get('name') == name, evidence
            if live:
                # Silence intentionally clears the production sculpture. Wait
                # for actual audible playback, rather than scoring that correct
                # empty frame as a failed stage or synthesizing a signal.
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    with lock:
                        audible = evidence.get('playing') and evidence.get('energy', 0) > .04 and evidence.get('age', 1000) < 750
                    if audible:
                        break
                    time.sleep(.1)
                assert audible, 'Live stage QA requires audible Spotify playback'
            time.sleep(.2)
            # Live music has sparse instants as well as sustained passages.
            # Observe at most one second. Strong passages retain the original
            # 600-pixel floor; quiet passages deliberately dim their contour
            # ink, but still must paint substantial geometry. Never amplify
            # the input or count the metadata as geometry.
            visible = -1
            required = 600
            for attempt in range(5 if live else 1):
                response = client.send('GetSourceScreenshot', dict(sourceName=source, imageFormat='png',
                                       imageWidth=540, imageHeight=405), raw=True)
                candidate = base64.b64decode(response['imageData'].split(',', 1)[1])
                rendered = Image.open(io.BytesIO(candidate)).convert('RGBA').crop((0, 0, 540, 297))
                count = sum(1 for r, g, b, a in rendered.getdata() if a > 20 and max(r, g, b) > 30)
                if count > visible:
                    visible, pixels = count, candidate
                required = 200 if live and evidence.get('energy', 0) < .22 else 600
                if visible > required:
                    break
                time.sleep(.2)
            (out / f'obs-{i}.png').write_bytes(pixels)
            assert visible > required, f'Native stage {i} ({name}) has insufficient geometry: {visible}; view={evidence.get("view")}, energy={evidence.get("energy")}'
            rendered_scenes.append({'name': name, 'visible_pixels': visible, 'required_pixels': required, 'energy': evidence.get('energy')})
            evidence['rendered_scenes'] = rendered_scenes
            time.sleep(.35)
    finally:
        try:
            if created_source:
                # Native projectors/undo references can outlive removal. Unload
                # the owned page before closing its diagnostic server so no
                # intervals or error handlers remain alive in CEF.
                client.send('SetInputSettings', dict(inputName=source,
                            inputSettings=dict(url='about:blank', shutdown=True), overlay=True), raw=True)
                client.send('RemoveInput', {'inputName': source}, raw=True)
        finally:
            try:
                if created_scene:
                    client.send('RemoveScene', {'sceneName': scene}, raw=True)
            finally:
                server.shutdown()
                server.server_close()
                worker.join(3)
    # OBS can release a removed scene on a later UI tick. Observe removal rather
    # than comparing the user's graph while our own wrapper is still present.
    deadline = time.monotonic() + 3
    while True:
        after = dict(settings=client.send('GetInputSettings', {'inputName': 'Hub Spotify Visualizer'}, raw=True),
                     items=client.send('GetSceneItemList', {'sceneName': 'Spotify Overlay'}, raw=True),
                     filters=client.send('GetSourceFilterList', {'sourceName': 'Hub Spotify Visualizer'}, raw=True))
        if not any(i['sourceName'] == scene for i in after['items']['sceneItems']):
            break
        assert time.monotonic() < deadline, 'Owned QA wrapper did not leave the source graph'
        time.sleep(.1)
    (out / 'presentation-comparison.json').write_text(json.dumps(dict(before=before, after=after), indent=2))
    changed = [name for name, digest in files.items() if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest]
    # Workflow manifests are developer descriptions, not personal profiles.
    # Keep all actual setting maps under the strict preservation comparison.
    evidence['source_preserved'] = before == after
    evidence['personal_settings_preserved'] = not changed
    evidence['changed_personal_files'] = changed
    evidence['temporary_scene_removed'] = True
    if len(native_timings) > 10:
        import statistics
        first, last = native_timings[4], native_timings[-1]
        evidence['observed_native_fps'] = (last[1]-first[1])*1000/(last[0]-first[0])
        costs = sorted(v[2] for v in native_timings[4:])
        evidence['native_paint_ms'] = dict(median=statistics.median(costs), p90=costs[int(len(costs)*.9)], maximum=costs[-1])
    evidence['configured_fps'] = before['settings']['inputSettings'].get('fps', 30)
    if native_views:
        evidence['observed_view_ranges'] = {
            axis: [min(v[axis] for v in native_views), max(v[axis] for v in native_views)]
            for axis in ('yaw', 'tilt', 'roll')
        }
    (out / 'obs-verification.json').write_text(json.dumps(evidence, indent=2))
    assert before == after, 'Existing Spotify source presentation changed during QA'
    assert not changed, f'Personal settings changed during QA: {changed}'
    print(json.dumps(evidence))


if __name__ == '__main__':
    main()

"""Compare reusable native/browser inputs using muted assets off the canvas.

Temporary sources never replace personal sources or change the scene/output.
Off-canvas results measure startup and decoder/browser work, not visible
composition, effects, filtering, layering or game contention. The same browser
is reused across swaps; native inputs also reuse their physical source.
"""
from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import statistics
import sys
import threading
import time
from urllib.parse import urlparse, parse_qs
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import load_project_env
from lib.settings_backups import SettingsBackups
from lib.performance_monitor import find_obs_process
from tools.profile_media_startup import output_state, gpu_sample

PAGE = b'''<!doctype html><html><body style="margin:0;background:transparent">
<video id="video" muted playsinline style="width:100%;height:100%;object-fit:contain"></video>
<script>
let seq=-1; const v=document.querySelector('video');
function ack(type){fetch('/ack?seq='+seq+'&type='+type).catch(()=>{});}
v.addEventListener('playing',()=>ack('playing'));
v.addEventListener('error',()=>ack('error'));
async function poll(){try{
 const c=await (await fetch('/command',{cache:'no-store'})).json();
 if(c.seq!==seq){seq=c.seq;v.pause();v.removeAttribute('src');v.load();
  if(c.asset!==null){v.src='/media/'+c.asset;v.play().catch(()=>ack('error'));}}
 }catch(e){} setTimeout(poll,50);}
fetch('/ready').then(poll);
</script></body></html>'''


class BrowserHarness:
    def __init__(self, paths):
        self.paths = paths
        self.lock = threading.Lock()
        self.command = dict(seq=0, asset=None)
        self.ready = threading.Event()
        self.ack = None
        self.requests = []
        harness = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                parsed = urlparse(self.path)
                with harness.lock:
                    if len(harness.requests) < 32:
                        harness.requests.append(parsed.path)
                if parsed.path.startswith('/media/'):
                    try:
                        path = harness.paths[int(parsed.path.removeprefix('/media/'))]
                    except (ValueError, IndexError):
                        self.send_error(404); return
                    size = path.stat().st_size
                    start, end = 0, size - 1
                    requested = self.headers.get('Range')
                    if requested:
                        try:
                            left, right = requested.removeprefix('bytes=').split('-')
                            if left:
                                start=int(left);end=min(int(right),end) if right else end
                            else:
                                start=max(0,size-int(right))
                            if not 0 <= start <= end < size: raise ValueError()
                        except ValueError:
                            self.send_error(416); return
                    self.send_response(206 if requested else 200)
                    self.send_header('Content-Type', mimetypes.guess_type(path)[0] or 'application/octet-stream')
                    self.send_header('Content-Length',str(end-start+1))
                    self.send_header('Accept-Ranges','bytes')
                    if requested:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
                    self.end_headers()
                    try:
                        with path.open('rb') as stream:
                            stream.seek(start);remaining=end-start+1
                            while remaining:
                                chunk=stream.read(min(256*1024,remaining))
                                if not chunk:break
                                self.wfile.write(chunk);remaining-=len(chunk)
                    except (ConnectionError, OSError):pass
                    return
                if parsed.path=='/ready':
                    harness.ready.set(); payload=b'{}'
                elif parsed.path=='/command':
                    with harness.lock:payload=json.dumps(harness.command).encode()
                elif parsed.path=='/ack':
                    query=parse_qs(parsed.query)
                    with harness.lock:
                        if query.get('seq',[''])[0]==str(harness.command['seq']):
                            harness.ack=dict(type=query.get('type',[''])[0], at=time.monotonic())
                    payload=b'{}'
                else:payload=PAGE
                self.send_response(200)
                self.send_header('Content-Type','text/html' if payload==PAGE else 'application/json')
                self.send_header('Content-Length',str(len(payload)))
                self.send_header('Cache-Control','no-store')
                self.end_headers()
                self.wfile.write(payload)
        self.server = ThreadingHTTPServer(('127.0.0.1',0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def select(self, asset):
        with self.lock:
            self.command = dict(seq=self.command['seq']+1,asset=asset)
            self.ack = None

    def close(self):
        self.server.shutdown();self.server.server_close();self.thread.join(2)


class Samples:
    def __init__(self, client, process):
        self.client, self.process = client, process
        self.processes = {}
        self.take()

    def take(self):
        import psutil
        cpu = rss = 0
        for process in [self.process, *self.process.children(recursive=True)]:
            try:
                tracked=self.processes.get(process.pid)
                if tracked is None:
                    self.processes[process.pid]=process;process.cpu_percent()
                else:cpu+=tracked.cpu_percent()
                rss+=process.memory_info().rss/1048576
            except (psutil.NoSuchProcess,psutil.AccessDenied):pass
        stats=self.client.get_stats()
        return dict(at=time.monotonic(), gpu=gpu_sample(), obs_tree_cpu=round(cpu,1),
                    obs_tree_rss_mb=round(rss,1), obs_threads=self.process.num_threads(),
                    render_ms=stats.average_frame_render_time,
                    render_skipped=stats.render_skipped_frames,
                    output_skipped=stats.output_skipped_frames)


BACKENDS = ('native-hardware', 'native-software', 'browser')


def run(paths, seconds=3, repeats=2, backends=BACKENDS, *, browser_fps=30):
    load_project_env()
    import obs, psutil
    from obs.obs_config import OBS_PORT
    client=obs.get_obs();before=output_state(client)
    process=find_obs_process(psutil,int(OBS_PORT))
    if process is None:raise RuntimeError('No OBS process')
    SettingsBackups().snapshot()
    harness=BrowserHarness(paths)
    sources=[];rows=[];failure=None
    sampler=Samples(client,process)
    try:
        for backend in backends:
            name='Hub backend measurement '+uuid.uuid4().hex
            browser=backend=='browser'
            settings=(dict(is_local_file=False, url=f'http://127.0.0.1:{harness.server.server_port}/',width=1920,
                height=1080,fps=browser_fps,fps_custom=True,reroute_audio=True,shutdown=False,
                restart_when_active=False) if browser else dict(is_local_file=True,
                restart_on_activate=False,close_when_inactive=False,looping=False,
                hw_decode=backend=='native-hardware'))
            client.create_input(before['scene'],name,'browser_source' if browser else 'ffmpeg_source',settings,False)
            sources.append(name)
            client.set_input_mute(name,True)
            client.set_input_audio_monitor_type(name,'OBS_MONITORING_TYPE_NONE')
            client.set_input_audio_tracks(name,{str(i):False for i in range(1,7)})
            # Give every backend the same active, off-canvas arrangement.
            # Activate only after muting and moving the temporary item.
            item=client.get_scene_item_id(before['scene'],name).scene_item_id
            canvas=client.get_video_settings()
            client.set_scene_item_transform(before['scene'],item,
                dict(positionX=canvas.base_width*2,positionY=canvas.base_height*2))
            client.set_scene_item_enabled(before['scene'],item,True)
            if browser and not harness.ready.wait(10):
                raise RuntimeError('Browser harness did not load; requests: ' + repr(harness.requests))
            time.sleep(.5)
            idle=[sampler.take()]
            time.sleep(.5);idle.append(sampler.take())
            for repeat in range(repeats):
                for index,path in enumerate(paths):
                    started=time.monotonic();progress=None;samples=[]
                    if browser:harness.select(index)
                    else:
                        client.set_input_settings(name,{'local_file':str(path)},overlay=True)
                    while time.monotonic()-started<seconds:
                        if browser:
                            with harness.lock:ack=harness.ack
                            if ack and ack['type']=='error':raise RuntimeError('Browser cannot play '+path.name)
                            if progress is None and ack:progress=ack['at']-started
                        else:
                            status=client.get_media_input_status(name)
                            if progress is None and (status.media_cursor or 0)>0:progress=time.monotonic()-started
                        samples.append(sampler.take());time.sleep(.1)
                    rows.append(dict(backend=backend,repeat=repeat,asset=path.name,
                        first_progress_seconds=round(progress,3) if progress is not None else None,
                        idle=idle,samples=samples))
                    if browser:harness.select(None)
                    else:client.trigger_media_input_action(name,'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP')
                    time.sleep(.25)
            client.remove_input(name);sources.remove(name)
    except Exception as exc:
        failure = dict(type=type(exc).__name__, message=str(exc))
        raise
    finally:
        for name in sources:
            try:client.remove_input(name)
            except Exception as exc:print('Could not remove temporary input',name,type(exc).__name__)
        harness.close()
        after=output_state(client)
        folder=Path(os.environ.get('LOCALAPPDATA',Path.home()))/'StreamingHub/diagnostics'
        folder.mkdir(parents=True,exist_ok=True)
        target=folder/('backend-comparison-'+time.strftime('%Y%m%d-%H%M%S')+'.json')
        target.write_text(json.dumps(dict(before=before,after=after,browser_fps=browser_fps,measurements=rows,
            failure=failure, browser_requests=harness.requests),indent=2),encoding='utf-8')
        print('Saved',target,flush=True)
        print('Output state',before,after,flush=True)
    for row in rows:
        print(row['backend'],row['asset'],'repeat',row['repeat'],
              'progress',row['first_progress_seconds'],
              'CPU median/peak',statistics.median(s['obs_tree_cpu'] for s in row['samples']),max(s['obs_tree_cpu'] for s in row['samples']),
              'GPU peak',max(s['gpu'].get('utilization.gpu',0) for s in row['samples']),
              'VRAM peak',max(s['gpu'].get('memory.used',0) for s in row['samples']),flush=True)
    return target


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('assets',nargs='+',type=Path)
    parser.add_argument('--seconds',type=float,default=3)
    parser.add_argument('--repeats',type=int,default=2)
    parser.add_argument('--browser-fps',type=int,choices=(30,60),default=30,
                        help='Match browser frame rate to the tested playback workload')
    parser.add_argument('--backend', action='append', choices=BACKENDS,
                        help='Measure only this backend; repeat for multiple backends')
    args=parser.parse_args()
    if not 1<=args.seconds<=10 or not 1<=args.repeats<=3:parser.error('Use 1–10 seconds and 1–3 repeats')
    run([p.resolve(strict=True) for p in args.assets],args.seconds,args.repeats,
        args.backend or BACKENDS,browser_fps=args.browser_fps)

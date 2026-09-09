"""League alert service and Hub lifecycle.

Service owns game polling, synchronized alert state, saved settings and OBS audio.
HTTP routing lives in http_server.py; detection and scheduling live in engine.py.
Importing this module does not start a server; the Hub calls run().
"""
from __future__ import annotations
import argparse
import json
import copy
import uuid
from pathlib import Path
import ssl
import shutil
import subprocess
import threading
import time
from http.server import ThreadingHTTPServer
from urllib.request import build_opener, HTTPSHandler, ProxyHandler
from urllib.parse import quote

from .http_server import make_handler
from .engine import Engine, defaults
from .presentation import initialize, switch, LAYOUT
from .editor import SettingsStore, validate_rule, number, describe, FIELDS, EVENT_NAMES

ROOT=Path(__file__).resolve().parent
PORT=7431
LIVE_URL='https://127.0.0.1:2999/liveclientdata/allgamedata'

def load_config():
    config=SettingsStore(ROOT/'alerts.json').load()
    personal=ROOT/'personal_presentation.json'
    initialize(config,json.loads(personal.read_text(encoding='utf-8')) if personal.exists() else {'events':{}})
    return config

class Service:
    def __init__(self, stop_event):
        self.parent_stop=stop_event; self.stop_event=threading.Event(); self.lock=threading.RLock()
        self.engine=Engine(load_config()); self.status='Waiting for a League game'
        self.last_success=None; self.error=None; self.clients=0; self.media_errors=[]
        self.store=SettingsStore(ROOT/'alerts.json'); self.audio_lock=threading.Lock()

    def settings(self):
        with self.lock:
            config=copy.deepcopy(self.engine.config)
            return {'config':config,'descriptions':{k:describe(k,v) for k,v in config['events'].items()},
                    'fields':FIELDS,'event_names':EVENT_NAMES,'library':self.library()}

    def library(self):
        folder=ROOT/'media'; folder.mkdir(exist_ok=True)
        return [{'path':'media/'+p.name,'name':p.name[9:] if len(p.name)>9 and p.name[8]=='_' else p.name,
                 'bytes':p.stat().st_size} for p in folder.iterdir() if self.media_path(str(p))]

    def save_edit(self,path,body):
        with self.lock:
            config=copy.deepcopy(self.engine.config)
            if body.get('revision')!=config.get('revision',0): raise ValueError('Settings changed in another window. Reload before saving.')
            if path=='/options':
                if 'overlay_enabled' in body:
                    if not isinstance(body['overlay_enabled'],bool): raise ValueError('Invalid enabled flag')
                    config['overlay_enabled']=body['overlay_enabled']
                if 'layout' in body:
                    layout=body['layout']
                    if not isinstance(layout,dict) or set(layout)!=set(LAYOUT): raise ValueError('Invalid layout')
                    config['layout']={k:number(layout[k],0 if k in {'x','y'} else 32,1920 if k in {'x','width'} else 1080,k) for k in LAYOUT}
                    if config['layout']['x']+config['layout']['width']>1920 or config['layout']['y']+config['layout']['height']>1080: raise ValueError('Keep the alert inside the canvas')
                if 'presentation' in body: switch(config,body['presentation'])
                if 'max_alerts' in body: config['max_alerts']=int(number(body['max_alerts'],1,3,'Slots'))
                if 'poll_seconds' in body: config['poll_seconds']=number(body['poll_seconds'],.25,5,'Poll interval')
                if 'paused' in body:
                    if not isinstance(body['paused'],bool): raise ValueError('Invalid pause flag')
                    config['paused']=body['paused']
            elif path=='/delete':
                key=body.get('key','')
                if not key.startswith('custom_') or key not in config['events']: raise ValueError('Only custom alerts can be removed. Disable built-in alerts instead.')
                del config['events'][key]
            else:
                key=body.get('key') if path=='/event' else 'custom_'+uuid.uuid4().hex[:12]
                if path=='/event' and key not in config['events']: raise ValueError('Unknown event')
                old=config['events'].get(key,{'enabled':True,'priority':50,'duration':6,'cooldown':10,'volume':.7,'media':''})
                allowed={'enabled','priority','duration','cooldown','volume','media','title','start_time','loop','trigger','audio'}
                patch=body.get('rule',{})
                if not isinstance(patch,dict) or set(patch)-allowed: raise ValueError('Unknown event setting')
                rule=validate_rule({**old,**patch},custom=key.startswith('custom_'))
                if rule['media'] and rule['media']!=old.get('media') and not self.media_path(rule['media']): raise ValueError('Choose an existing supported media file')
                if rule.get('audio') and rule['audio']!=old.get('audio'):
                    audio=self.media_path(rule['audio'])
                    if not audio or audio.suffix.lower() not in {'.mp3','.wav','.ogg','.m4a'}: raise ValueError('Choose an existing audio file')
                config['events'][key]=rule
            from lib.settings_backups import SettingsBackups
            SettingsBackups().snapshot()
            self.engine.config=self.store.save(config)
            if config.get('paused') or not config.get('overlay_enabled',True) or 'presentation' in body: self.engine.clear()
            # Apply volume changes to currently playing clips without restarting them.
            for a in self.engine.slots:
                if a['key'] in config['events']: a['volume']=config['events'][a['key']]['volume']
            return self.settings()

    def volume(self,body=None):
        import obs
        with self.audio_lock:
            client=obs.get_obs()
            if body is not None:
                if 'db' in body: client.set_input_volume('League API Alerts',None,number(body['db'],-60,6,'Volume'))
                if 'muted' in body:
                    if not isinstance(body['muted'],bool): raise ValueError('Mute must be true or false')
                    client.set_input_mute('League API Alerts',body['muted'])
            v=client.get_input_volume('League API Alerts')
            return {'db':max(-100,float(v.input_volume_db)), 'muted':client.get_input_mute('League API Alerts').input_muted,'source':'League API Alerts'}

    def snapshot(self):
        with self.lock:
            alerts=self.engine.active()
            for alert in alerts:
                alert['remaining']=max(0,alert['expires']-self.engine.clock())
                path=self.media_path(alert['media']) if alert['media'] else None
                if path:
                    alert['media']='/media/'+alert['key']+'?alert='+str(alert['id'])
                    alert['media_kind']=('image' if path.suffix.lower() in {'.png','.jpg','.jpeg','.gif','.webp'} else 'audio' if path.suffix.lower() in {'.mp3','.wav','.ogg','.m4a'} else 'video')
                else: alert['media']=''
                audio=self.media_path(alert.get('audio',''))
                alert['audio']='/asset?path='+quote(alert['audio']) if audio else ''
            return {'overlay_enabled':self.engine.config.get('overlay_enabled',True),'layout':self.engine.config.get('layout',LAYOUT),'status':self.status,'alerts':alerts,'metrics':self.engine.metrics,
                    'history':self.engine.history[-20:],'error':self.error,'media_errors':self.media_errors[-10:],
                    'paused':self.engine.config.get('paused',False),'revision':self.engine.config.get('revision',0)}

    def media_path(self, value):
        # Only explicitly configured files are served, never arbitrary filesystem URLs.
        if not value: return None
        p=Path(value)
        if not p.is_absolute(): p=ROOT/p
        return p if p.is_file() and p.suffix.lower() in {'.png','.jpg','.jpeg','.gif','.webp','.mp3','.wav','.ogg','.m4a','.mp4','.webm','.mov'} else None

    def poll(self):
        # Riot's local game endpoint uses a self-signed certificate. This context
        # and disabled proxies are scoped exclusively to the fixed loopback URL.
        opener=build_opener(ProxyHandler({}),HTTPSHandler(context=ssl._create_unverified_context()))
        while not self.stop_event.is_set() and not self.parent_stop.is_set():
            try:
                with opener.open(LIVE_URL,timeout=2) as response: data=json.load(response)
                if not isinstance(data.get('gameData',{}).get('gameTime'),(float,int)):
                    raise ValueError('Live API response is missing gameTime')
                now=time.monotonic()
                with self.lock:
                    gap=self.last_success is not None and now-self.last_success>3
                    self.engine.ingest(data,baseline=gap)
                    self.status='Connected to League'; self.error=None; self.last_success=now
            except Exception as exc:
                with self.lock:
                    self.status='Waiting for a League game'
                    if self.last_success and time.monotonic()-self.last_success>10: self.engine.clear()
                    # Connection refusal is normal outside a game; don't flood logs.
                    self.error=str(exc) if isinstance(exc,(ValueError,KeyError,TypeError)) else None
            self.stop_event.wait(max(.25,min(5,float(self.engine.config.get('poll_seconds',.5)))))

    def handler(self):
        return make_handler(self, root=ROOT, port=PORT, load_config=load_config)


def run(input_queue,stop_event,*,startup_event=None):
    service=Service(stop_event)
    try: server=ThreadingHTTPServer(('127.0.0.1',PORT),service.handler())
    except OSError:
        print(f'[league_api] Port {PORT} is already in use.',flush=True)
        if startup_event: startup_event.set()
        return
    try:
        try:
            from .interface import _live
            _live['service']=service
        except ImportError: pass
        server.daemon_threads=True
        web=threading.Thread(target=server.serve_forever,daemon=True); web.start()
        # Recover a browser source that OBS loaded before the HTTP service existed.
        def refresh_obs():
            node=shutil.which('node')
            if node:
                try:
                    subprocess.run([node,str(ROOT.parents[1]/'obs'/'league_api_setup.mjs'),'--refresh'],
                                   timeout=20,capture_output=True,
                                   creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                except (OSError,subprocess.TimeoutExpired): pass
        threading.Thread(target=refresh_obs,daemon=True).start()
        if startup_event: startup_event.set()
        print(f'[league_api] Ready: http://127.0.0.1:{PORT} · one OBS source, maximum three alerts',flush=True)
        service.poll()
    finally:
        service.engine.clear(); server.shutdown(); server.server_close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--write-defaults',action='store_true'); args=parser.parse_args()
    if args.write_defaults:
        target=ROOT/'alerts.json'
        if not target.exists(): target.write_text(json.dumps(defaults(),indent=2)+'\n',encoding='utf-8')
    else:
        stop=threading.Event()
        try: run(None,stop)
        except KeyboardInterrupt: stop.set()

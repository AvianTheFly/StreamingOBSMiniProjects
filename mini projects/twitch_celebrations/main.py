"""Hub lifecycle and synchronized service state. HTTP, scheduling and Twitch are separate."""
import json
from pathlib import Path
import secrets
import threading
import time
from http.server import ThreadingHTTPServer
from .engine import Engine, THEMES
from .twitch import Twitch
from .http_server import handler

ROOT = Path(__file__).resolve().parent
PORT = 7443
SOURCE = 'Hub Twitch Celebrations'


class Service:
    def __init__(self, stop):
        self.lock = threading.RLock()
        self.engine = Engine()
        self.csrf = secrets.token_urlsafe(32)
        self.last_overlay = -1000
        self.settings = {'enabled':True, 'volume':0.22, 'muted':False, 'custom':{}}
        try:
            self.settings.update(json.loads((ROOT/'settings.json').read_text()))
        except FileNotFoundError:
            pass
        self.twitch = Twitch(stop, self.receive)

    def receive(self, kind, name, count=1, event_id=None, theme=None):
        with self.lock:
            if not self.settings['enabled']:
                return False
            return self.engine.submit(kind, name, count, event_id, theme)

    def state(self, overlay=False):
        with self.lock:
            if overlay:
                self.last_overlay = time.monotonic()
            active = self.engine.snapshot(ready=overlay)
            return dict(active=active, queue=len(self.engine.queue), settings=self.settings,
                        themes=THEMES, history=list(self.engine.history),
                        connected=self.twitch.connected, message=self.twitch.message, auth=self.twitch.auth,
                        subscriptions=self.twitch.subscriptions, last_event=self.twitch.last_event,
                        overlay_ready=time.monotonic()-self.last_overlay < 3)

    def save(self, body):
        with self.lock:
            patch = {}
            for key in ('enabled','muted'):
                if key in body:
                    if not isinstance(body[key],bool): raise ValueError('Invalid switch')
                    patch[key] = body[key]
            if 'volume' in body:
                value = float(body['volume'])
                if not 0 <= value <= 1: raise ValueError('Volume must be between 0 and 1')
                patch['volume'] = value
            if 'custom' in body:
                custom = body['custom']
                if not isinstance(custom,dict) or set(custom)-set(THEMES): raise ValueError('Invalid theme')
                for values in custom.values():
                    if not isinstance(values,dict) or set(values)-{'visual','audio'}: raise ValueError('Invalid media slot')
                    for kind, name in values.items():
                        if name and not self.asset(name, kind): raise ValueError('Choose a file from the media folder')
                patch['custom'] = custom
            from lib.settings_backups import SettingsBackups
            SettingsBackups().snapshot()
            updated = {**self.settings, **patch}
            tmp = ROOT/'settings.tmp'
            tmp.write_text(json.dumps(updated,indent=2))
            tmp.replace(ROOT/'settings.json')
            self.settings = updated
            if not self.settings['enabled']:
                self.engine.clear()

    def asset(self, name, kind=None):
        if not isinstance(name,str) or Path(name).name != name: return None
        path = (ROOT/'media'/name).resolve()
        allowed = {'.wav','.mp3','.ogg','.m4a'} if kind == 'audio' else {'.webm','.mp4','.gif','.png','.webp'} if kind == 'visual' else {'.wav','.mp3','.ogg','.m4a','.webm','.mp4','.gif','.png','.webp'}
        return path if path.parent == (ROOT/'media').resolve() and path.suffix.lower() in allowed and path.is_file() else None

    def attach_obs(self):
        import obs
        from lib.settings_backups import SettingsBackups
        SettingsBackups().snapshot()
        client = obs.get_obs()
        scene = obs.get_current_scene()
        existing = next((x for x in client.send('GetInputList',{},raw=True)['inputs'] if x['inputName']==SOURCE),None)
        if existing and existing['inputKind'] != 'browser_source': raise ValueError('Source name already belongs to another input')
        if not existing:
            client.send('CreateInput',dict(sceneName=scene,inputName=SOURCE,inputKind='browser_source',sceneItemEnabled=True,
                inputSettings=dict(url=f'http://127.0.0.1:{PORT}/overlay',width=1920,height=1080,fps=30,
                                   reroute_audio=True,shutdown=False,restart_when_active=False)),raw=True)
            obs.ensure_input_on_stream_track(SOURCE)
        else:
            settings = client.send('GetInputSettings',dict(inputName=SOURCE),raw=True)['inputSettings']
            expected = dict(url=f'http://127.0.0.1:{PORT}/overlay', width=1920,height=1080,
                            reroute_audio=True,shutdown=False,restart_when_active=False)
            patch = {key:value for key,value in expected.items() if settings.get(key) != value}
            if patch:
                client.send('SetInputSettings',dict(inputName=SOURCE,inputSettings=patch,overlay=True),raw=True)
            items = client.send('GetSceneItemList',{'sceneName':scene},raw=True)['sceneItems']
            if not any(x['sourceName']==SOURCE for x in items):
                client.send('CreateSceneItem',dict(sceneName=scene,sourceName=SOURCE,sceneItemEnabled=True),raw=True)
        return scene


def run(input_queue, stop_event, *, startup_event=None):
    service = Service(stop_event)
    server = ThreadingHTTPServer(('127.0.0.1',PORT),handler(service,ROOT,PORT))
    server.daemon_threads = True
    from .interface import _live
    _live['service'] = service
    threading.Thread(target=server.serve_forever,daemon=True,name='celebrations-http').start()
    threading.Thread(target=service.twitch.listen,daemon=True,name='celebrations-twitch').start()
    # OBS may have opened this page before the local HTTP server was available.
    # Reload existing input once; polling then handles later server interruptions.
    def reload_existing():
        try:
            import obs
            client = obs.get_obs()
            inputs = client.send('GetInputList',{},raw=True)['inputs']
            if any(x['inputName']==SOURCE and x['inputKind']=='browser_source' for x in inputs):
                client.send('PressInputPropertiesButton',dict(inputName=SOURCE,propertyName='refreshnocache'),raw=True)
        except Exception:
            pass  # OBS can be offline while Twitch is listening.
    threading.Thread(target=reload_existing,daemon=True,name='celebrations-overlay-reload').start()
    if startup_event: startup_event.set()
    print(f'[twitch_celebrations] Ready: http://127.0.0.1:{PORT}',flush=True)
    try:
        stop_event.wait()
    finally:
        service.engine.clear()
        if service.twitch.socket: service.twitch.socket.close()
        server.shutdown()
        server.server_close()
        _live.clear()

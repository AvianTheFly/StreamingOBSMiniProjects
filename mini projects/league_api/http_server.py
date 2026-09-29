"""Loopback HTTP transport for League alerts.

Routes translate browser requests into Service calls. Game polling, alert state,
settings persistence and OBS volume access belong to main.Service. The factory
receives paths and the config loader explicitly so tests can use temporary data.
"""
from __future__ import annotations

import json
import mimetypes
import re
import uuid
import time
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


def make_handler(service, *, root: Path, port: int, load_config):
    """Bind a handler to one service without importing or starting the Hub."""
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def local_origins(self):
            listening_port=self.server.server_address[1]
            return {f'127.0.0.1:{listening_port}',f'localhost:{listening_port}'}
        def reject_post(self, status):
            # Windows may reset a socket with unread JSON, hiding the HTTP error.
            try: size=int(self.headers.get('Content-Length','0'))
            except ValueError: size=0
            if 0<size<=65536: self.rfile.read(size)
            self.send_error(status)
        def send_bytes(self, body, content_type='application/json', status=200):
            self.send_response(status); self.send_header('Content-Type',content_type)
            self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store')
            self.end_headers(); self.wfile.write(body)
        def do_GET(self):
            if self.headers.get('Host') not in self.local_origins():
                self.send_error(403); return
            path=unquote(urlparse(self.path).path)
            if path=='/production/settings':
                self.send_bytes(json.dumps(service.production_settings()).encode()); return
            if path=='/production':
                self.send_bytes((root/'production'/'web'/'control.html').read_bytes(),'text/html; charset=utf-8'); return
            if path.startswith('/production/') and path.removeprefix('/production/') in {'overlay.js','scene.js','materials.js','terrain.js','bursts.js','control.js','control.css'}:
                file=root/'production'/'web'/path.removeprefix('/production/')
                self.send_bytes(file.read_bytes(),'text/css' if file.suffix=='.css' else 'text/javascript'); return
            if path=='/sprite.png':
                config=json.loads((root/'sprites.json').read_text(encoding='utf-8'))
                self.send_bytes(Path(config['image']).read_bytes(),'image/png'); return
            if path in {'/sprites.js','/sprite-control.js'}:
                self.send_bytes((root/path[1:]).read_bytes(),'text/javascript'); return
            if path=='/settings': self.send_bytes(json.dumps(service.settings()).encode()); return
            if path in {'/memes','/meme-pack.json'}:
                file=root/('meme_gallery.html' if path=='/memes' else 'meme_pack.json')
                if not file.is_file(): self.send_error(404); return
                self.send_bytes(file.read_bytes(),'text/html; charset=utf-8' if path=='/memes' else 'application/json'); return
            if path.startswith('/meme-thumbnails/'):
                name=path.removeprefix('/meme-thumbnails/')
                if not re.fullmatch(r'[a-z0-9-]+\.jpg',name): self.send_error(404); return
                file=root/'meme_thumbnails'/name
                if not file.is_file(): self.send_error(404); return
                self.send_bytes(file.read_bytes(),'image/jpeg'); return
            if path=='/volume':
                try: self.send_bytes(json.dumps(service.volume()).encode())
                except Exception: self.send_bytes(b'{"error":"OBS audio is unavailable. Start OBS with WebSocket enabled."}',status=503)
                return
            if path in {'/control.js','/control.css','/presentation.js','/pool.js','/monitor.js'}:
                self.send_bytes((root/path[1:]).read_bytes(),'text/javascript' if path.endswith('.js') else 'text/css'); return
            if path=='/state':
                query=parse_qs(urlparse(self.path).query)
                if query.get('consumer')==['obs']: service.last_overlay=time.monotonic()
                self.send_bytes(json.dumps(service.snapshot()).encode()); return
            if path=='/catalog':
                self.send_bytes(json.dumps(service.engine.config['events']).encode()); return
            if path in {'/','/overlay'}:
                self.send_bytes((root/('control.html' if path=='/' else 'overlay.html')).read_bytes(),'text/html; charset=utf-8'); return
            if path.startswith('/media/') or path=='/asset':
                with service.lock:
                    if path=='/asset':
                        value=parse_qs(urlparse(self.path).query).get('path',[''])[0]
                        permitted={a['path'] for a in service.library()}|{r.get(f,'') for r in service.engine.config['events'].values() for f in ('media','audio')}
                        permitted.update(item['media'] for rule in service.engine.config['events'].values() for item in rule.get('media_pool',[]))
                        permitted.update(a.get(f,'') for a in service.engine.active() for f in ('media','audio'))
                        target=service.media_path(value) if value in permitted else None
                    else:
                        rule=service.engine.config['events'].get(path[7:],{})
                        target=service.media_path(rule.get('media',''))
                if target:
                    # Range support permits seeking and reliable Chromium video playback.
                    size=target.stat().st_size; start=0; end=size-1
                    value=self.headers.get('Range','')
                    if value.startswith('bytes='):
                        try:
                            a,b=value[6:].split('-',1)
                            start=int(a) if a else max(0,size-int(b)); end=min(size-1,int(b)) if a and b else size-1
                            if start>end or start>=size: raise ValueError()
                        except ValueError:
                            self.send_error(416); return
                    self.send_response(206 if value else 200)
                    self.send_header('Content-Type',mimetypes.guess_type(target.name)[0] or 'application/octet-stream')
                    self.send_header('Accept-Ranges','bytes'); self.send_header('Content-Length',str(end-start+1))
                    self.send_header('Cache-Control','no-store')
                    if value: self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
                    self.end_headers()
                    with target.open('rb') as f:
                        f.seek(start); remaining=end-start+1
                        while remaining:
                            chunk=f.read(min(65536,remaining))
                            if not chunk: break
                            self.wfile.write(chunk); remaining-=len(chunk)
                    return
            self.send_error(404)
        def do_POST(self):
            if self.headers.get('Host') not in self.local_origins():
                self.reject_post(403); return
            # Local control page only; no cross-origin browser mutations.
            if self.headers.get('Origin') not in {None,*(f'http://{host}' for host in self.local_origins())}:
                self.reject_post(403); return
            path=urlparse(self.path).path
            if path=='/upload':
                try:
                    size=int(self.headers.get('Content-Length','0'))
                    if not 0<size<=256*1024*1024: raise ValueError('Select a file between 1 byte and 256 MB')
                    name=parse_qs(urlparse(self.path).query).get('name',['asset'])[0]
                    name=Path(name.replace('\\','/')).name
                    import re
                    name=re.sub(r'[^\w. -]','_',name)[:150]
                    if Path(name).suffix.lower() not in {'.png','.jpg','.jpeg','.webp','.gif','.mp4','.webm','.mov','.mp3','.wav','.ogg','.m4a'}:
                        # Consume the bounded request before closing; unread bytes
                        # can reset the Windows socket and hide the error response.
                        remaining=size
                        while remaining:
                            chunk=self.rfile.read(min(65536,remaining))
                            if not chunk: break
                            remaining-=len(chunk)
                        raise ValueError('Unsupported media format')
                    folder=root/'media'; folder.mkdir(exist_ok=True)
                    dest=folder/(uuid.uuid4().hex[:8]+'_'+name)
                    remaining=size
                    try:
                        with dest.open('xb') as f:
                            while remaining:
                                chunk=self.rfile.read(min(65536,remaining))
                                if not chunk: raise ValueError('Upload interrupted')
                                f.write(chunk); remaining-=len(chunk)
                    except Exception:
                        dest.unlink(missing_ok=True); raise
                    self.send_bytes(json.dumps({'path':'media/'+dest.name,'library':service.library()}).encode())
                except (ValueError,OSError) as exc: self.send_bytes(json.dumps({'error':str(exc)}).encode(),status=400)
                return
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':
                self.reject_post(415); return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=65536: raise ValueError('Invalid body size')
                body=json.loads(self.rfile.read(size))
                if not isinstance(body,dict): raise ValueError('Expected an object')
                if path=='/production/configure':
                    self.send_bytes(json.dumps(service.save_production(body)).encode()); return
                if path=='/production/preview':
                    with service.lock: service.engine.production.preview(body.get('key','earth_cycle'))
                    self.send_bytes(b'{}'); return
                if path=='/production/clear':
                    with service.lock: service.engine.production.clear()
                    self.send_bytes(b'{}'); return
                if path=='/production/obs':
                    from .production.obs_source import repair_overlay
                    try: repair_overlay(service)
                    except ValueError: raise
                    except Exception:
                        self.send_bytes(b'{"error":"OBS is unavailable. Start OBS with WebSocket enabled."}',status=503); return
                    self.send_bytes(b'{}'); return
                if path in {'/event','/custom','/delete','/options'}:
                    self.send_bytes(json.dumps(service.save_edit(path,body)).encode()); return
                if path=='/volume':
                    try: result=service.volume(body)
                    except ValueError: raise
                    except Exception: self.send_bytes(b'{"error":"OBS volume could not be changed"}',status=503); return
                    self.send_bytes(json.dumps(result).encode()); return
                with service.lock:
                    if self.path=='/sprite-preview':
                        service.engine.trigger_sprites(body.get('level',6))
                    elif self.path=='/preview':
                        if not service.engine.config.get('overlay_enabled',True): raise ValueError('League alerts are off. Turn them on before previewing in OBS.')
                        keys=body.get('keys',[])
                        if not isinstance(keys,list) or any(k not in service.engine.config['events'] for k in keys): raise ValueError('Unknown alert')
                        # Preview is explicit and bypasses enabled/cooldown flags only.
                        saved=service.engine.config; config=json.loads(json.dumps(saved))
                        for k in keys: config['events'][k].update(enabled=True,cooldown=0)
                        service.engine.config=config
                        try:
                            service.engine.submit([{'key':k,'title':k.replace('_',' ').title(),'detail':'Hello World — preview','confidence':'preview'} for k in keys])
                        finally: service.engine.config=saved
                    elif self.path=='/clear': service.engine.clear()
                    elif self.path=='/stop': service.engine.clear(); service.stop_event.set()
                    elif self.path=='/reload':
                        service.engine.config=load_config()
                        service.engine.production.configure(service.production_store.load())
                    elif self.path=='/media-error': service.media_errors.append(str(body.get('key','unknown'))[:100])
                    else: self.send_error(404); return
                self.send_bytes(b'{}')
            except (ValueError,TypeError) as exc: self.send_bytes(json.dumps({'error':str(exc)}).encode(),status=400)
    return Handler

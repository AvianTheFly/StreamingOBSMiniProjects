"""Loopback-only control API with host and CSRF checks; static media allowlist."""
import json
import mimetypes
import secrets
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote


def handler(service, root, port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass

        def send(self, value, status=200, content_type='application/json'):
            data = json.dumps(value).encode() if content_type == 'application/json' else value
            self.send_response(status)
            self.send_header('Content-Type',content_type)
            self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.end_headers()
            self.wfile.write(data)

        def host(self):
            return self.headers.get('Host') in {f'127.0.0.1:{port}',f'localhost:{port}'}

        def do_GET(self):
            if not self.host(): return self.send({'error':'Invalid host'},403)
            path = urlparse(self.path).path
            if path in ('/api/state','/api/overlay'):
                return self.send(service.state(overlay=path.endswith('overlay')))
            if path == '/api/library':
                return self.send([p.name for p in (root/'media').iterdir() if service.asset(p.name)])
            files = {'/':'control.html','/overlay':'overlay.html','/overlay.js':'overlay.js','/overlay.css':'overlay.css','/control.js':'control.js','/characters.js':'characters.js','/raid_sequence.js':'raid_sequence.js','/raid_sequence.css':'raid_sequence.css'}
            if path in files:
                p = root/files[path]
                data = p.read_bytes().replace(b'__CSRF__',service.csrf.encode()) if path == '/' else p.read_bytes()
                return self.send(data,content_type=mimetypes.guess_type(p.name)[0] or 'application/octet-stream')
            if path.startswith('/media/'):
                p = service.asset(unquote(path[len('/media/'):]))
                if p: return self.send(p.read_bytes(),content_type=mimetypes.guess_type(p.name)[0] or 'application/octet-stream')
            self.send({'error':'Not found'},404)

        def do_POST(self):
            if not self.host() or not secrets.compare_digest(self.headers.get('X-Hub-CSRF',''),service.csrf):
                return self.send({'error':'Forbidden'},403)
            try:
                size = int(self.headers.get('Content-Length',0))
                if not 0 < size <= 16384: raise ValueError('Invalid request size')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body,dict): raise ValueError('Expected object')
                path = urlparse(self.path).path
                if path == '/api/test':
                    if not service.receive(body.get('kind','raid'),body.get('name','Your next favorite streamer'),body.get('count',42),theme=body.get('theme') or None):
                        raise ValueError('Celebrations paused or queue full')
                elif path == '/api/settings': service.save(body)
                elif path == '/api/stop':
                    with service.lock: service.engine.clear()
                elif path == '/api/connect': return self.send(service.twitch.connect())
                elif path == '/api/obs': return self.send({'scene':service.attach_obs()})
                else: return self.send({'error':'Not found'},404)
                self.send({'ok':True})
            except (ValueError,TypeError,KeyError):
                self.send({'error':'Invalid request. Check media, settings, or Twitch configuration.'},400)
            except Exception:
                self.send({'error':'Action failed. Check OBS/Twitch connection and retry.'},503)
    return Handler

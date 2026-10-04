"""Loopback state and acknowledgement API; range-enabled media scoped to active IDs."""
import json
import mimetypes
from pathlib import Path
from lib.http_files import serve_file
from .presentations import resolve as presentation_file
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

WEB = Path(__file__).parent/'web'
STATIC = {'overlay.html', 'playback.js', 'muffins.js', 'borders.js', 'renderers.js', 'production.js', 'rave.js', 'subtle.js', 'overlay.css', 'mash-dance.png'}


def handler(find_channel, port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def host(self):
            return self.headers.get('Host') in {f'127.0.0.1:{port}', f'localhost:{port}'}

        def send(self, value, status=200, content_type='application/json'):
            # Published files are already encoded bytes, including JSON manifests.
            data = json.dumps(value).encode() if content_type == 'application/json' and not isinstance(value,bytes) else value
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.host():
                return self.send({'error':'Invalid host'}, 403)
            path = urlparse(self.path).path
            if path.startswith('/api/state/'):
                channel = find_channel(path.removeprefix('/api/state/'))
                return self.send(channel.snapshot(poll=True) if channel else {'active':None, 'ready':False})
            if path.startswith('/overlay/'):
                file = presentation_file(path.removeprefix('/overlay/')) or WEB/'overlay.html'
            elif path.startswith('/presentation/'):
                parts = path.split('/')
                file = presentation_file(parts[2], parts[3]) if len(parts) == 4 else None
                if file is None or not file.is_file():
                    return self.send({'error':'Not found'}, 404)
            elif path.removeprefix('/') in STATIC:
                file = WEB/path.removeprefix('/')
            elif path.startswith('/audio/'):
                parts = path.split('/')
                if len(parts) != 4:
                    return self.send({'error':'Not found'}, 404)
                channel = find_channel(parts[2])
                if not channel:
                    return self.send({'error':'Not found'}, 404)
                with channel.lock:
                    if not channel.item or channel.item['id'] != parts[3] or not channel.media:
                        return self.send({'error':'Expired playback'}, 404)
                    file = channel.media
                return self.media(file)
            else:
                return self.send({'error':'Not found'}, 404)
            self.send(file.read_bytes(), content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')

        def media(self, file):
            serve_file(self, file, content_type=mimetypes.guess_type(file.name)[0] or 'audio/wav',
                       headers={'Cache-Control': 'no-store'})

        def do_POST(self):
            origin = self.headers.get('Origin')
            if not self.host() or (origin and origin not in {f'http://127.0.0.1:{port}', f'http://localhost:{port}'}):
                return self.send({'error':'Forbidden'}, 403)
            if self.headers.get('Content-Type') != 'application/json':
                return self.send({'error':'Expected JSON'}, 415)
            try:
                size = int(self.headers.get('Content-Length', 0))
                if not 0 < size <= 1024:
                    raise ValueError('Invalid size')
                path = urlparse(self.path).path
                if not path.startswith('/api/ack/'):
                    return self.send({'error':'Not found'}, 404)
                channel = find_channel(path.removeprefix('/api/ack/'))
                body = json.loads(self.rfile.read(size))
                if not channel or not isinstance(body, dict):
                    raise ValueError('Unknown channel')
                self.send({'ok':channel.acknowledge(body['id'], body['status'])})
            except (ValueError, KeyError, TypeError):
                self.send({'error':'Invalid acknowledgement'}, 400)
    return Handler

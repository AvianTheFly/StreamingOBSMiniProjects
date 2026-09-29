"""Loopback state and acknowledgement API; range-enabled media scoped to active IDs."""
import json
import mimetypes
from pathlib import Path
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

WEB = Path(__file__).parent/'web'
STATIC = {'overlay.html', 'playback.js', 'muffins.js', 'overlay.css'}


def handler(find_channel, port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def host(self):
            return self.headers.get('Host') in {f'127.0.0.1:{port}', f'localhost:{port}'}

        def send(self, value, status=200, content_type='application/json'):
            data = json.dumps(value).encode() if content_type == 'application/json' else value
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
                file = WEB/'overlay.html'
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
            size = file.stat().st_size
            first, last = 0, size-1
            ranged = self.headers.get('Range')
            if ranged:
                match = re.fullmatch(r'bytes=(\d*)-(\d*)', ranged)
                if not match or not any(match.groups()):
                    return self.send({'error':'Invalid range'}, 416)
                a, b = match.groups()
                first, last = (int(a), min(int(b), last) if b else last) if a else (max(0, size-int(b)), last)
                if first > last or first >= size:
                    return self.send({'error':'Unsatisfiable range'}, 416)
            self.send_response(206 if ranged else 200)
            self.send_header('Content-Type', mimetypes.guess_type(file.name)[0] or 'audio/wav')
            self.send_header('Content-Length', str(last-first+1))
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Cache-Control', 'no-store')
            if ranged:
                self.send_header('Content-Range', f'bytes {first}-{last}/{size}')
            self.end_headers()
            with file.open('rb') as stream:
                stream.seek(first)
                remaining = last-first+1
                while remaining:
                    chunk = stream.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)

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

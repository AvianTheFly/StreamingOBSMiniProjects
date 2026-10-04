"""Loopback Spotify state and static presentation transport, with an explicit allowlist."""
import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

WEB = Path(__file__).parent / 'web'


class SpotifyHTTPServer(ThreadingHTTPServer):
    """Persistent clients release their owned worker on shutdown or idle timeout."""
    daemon_threads = False
    closing = False

    def __init__(self, *args):
        self.connections = set()
        self.connections_lock = threading.Lock()
        super().__init__(*args)

    def shutdown(self):
        self.closing = True
        super().shutdown()
        with self.connections_lock:
            connections = tuple(self.connections)
        for connection in connections:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def make_server(state, port=7447):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def setup(self):
            super().setup()
            # Reuse one browser connection and worker. Small headers/payloads
            # must not wait for Nagle + delayed ACK on a persistent connection.
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            self.connection.settimeout(3)
            with self.server.connections_lock:
                self.server.connections.add(self.connection)

        def finish(self):
            try:
                super().finish()
            finally:
                with self.server.connections_lock:
                    self.server.connections.discard(self.connection)

        def log_message(self, *args):
            pass

        def do_GET(self):
            url = urlsplit(self.path)
            route = url.path
            if route == '/api/state':
                query = parse_qs(url.query, keep_blank_values=True)
                try:
                    after = int(query['after'][0]) if 'after' in query else None
                    audio_after = int(query['audio_after'][0]) if 'audio_after' in query else None
                except ValueError:
                    self.send_error(400, 'Invalid state revision')
                    return
                data = state.wait_audio(audio_after, after) if audio_after is not None else (
                    state.snapshot() if after is None else state.wait_snapshot(after))
                payload = json.dumps(data, separators=(',', ':')).encode()
                kind = 'application/json'
            elif route in ('/overlay', '/', '/overlay.js', '/overlay.css', '/surface.js', '/filament.js', '/reactive.js', '/forms.js', '/performance.js', '/radiance.js', '/music_strings.js', '/music_pacing.js', '/music_motion.js', '/music_space.js', '/journey.js', '/music_feed.js', '/stage_palette.js', '/stage_spirits.js', '/stage_geometry.js', '/stage_morph.js', '/stage_depth.js', '/stage_renderer.js'):
                name = 'overlay.html' if route in ('/overlay', '/') else route[1:]
                payload = (WEB / name).read_bytes()
                kind = {'html':'text/html', 'js':'application/javascript', 'css':'text/css'}[name.rsplit('.',1)[1]]
            else:
                self.send_error(404)
                return
            self.close_connection = self.server.closing
            self.send_response(200)
            if self.close_connection:
                self.send_header('Connection', 'close')
            self.send_header('Content-Type', kind + '; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            try:
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass  # Browser reloads and timed-out polls can close an in-flight request.
    return SpotifyHTTPServer(('127.0.0.1', port), Handler)



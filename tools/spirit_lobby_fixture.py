"""Finite browser-test HTTP fixture with the real library and disposable media."""
from pathlib import Path
import argparse
import http.server
import json
import sys
import threading
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from hub_ui.routes.spirit_lobby import SpiritLobbyRoutes
from spirit_lobby.library import Library
from lib.http_files import serve_file


class Handler(SpiritLobbyRoutes, http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, code, data):
        payload = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _err(self, code, text):
        self._json(code, {'error': text})

    def _body(self):
        return json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == '/api/events':
            from hub_ui.updates import stream
            return stream(self)
        if path.startswith('/api/spirit-lobby'):
            return self._get_spirit_lobby(path)
        if path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        app = (ROOT / 'hub_ui/app/spirit-lobby').resolve()
        target = (app / path.removeprefix('/spirit-lobby/')).resolve()
        if not target.is_relative_to(app) or not target.is_file():
            return self._err(404, 'Not found')
        serve_file(self, target)

    def do_POST(self):
        self._post_spirit_lobby(urllib.parse.urlsplit(self.path).path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    args = parser.parse_args()
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
        server.screen_library = Library(args.root, snapshot=False)
        server.stop_event = threading.Event()
        print(server.server_port, flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()

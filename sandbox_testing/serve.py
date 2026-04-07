#!/usr/bin/env python3
"""Bare-minimens HTTP server for sandbox_testing. Serves from this directory."""

import http.server
import socketserver
import os
import json
import urllib.parse
import webbrowser

PORT = 8787
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def send_response(self, code, message=None):
        super().send_response(code, message)
        if code == 200:
            self.send_header("Cache-Control", "no-store")

    def do_POST(self):
        if self.path == "/save-config":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            with open(os.path.join(DIR, "plank_config.json"), "w") as f:
                json.dump(body, f, indent=2)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path == "/load-config":
            path = os.path.join(DIR, "plank_config.json")
            if os.path.exists(path):
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                with open(path) as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404)
        else:
            super().do_GET()

os.chdir(DIR)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    webbrowser.open(f"http://localhost:{PORT}/face_track_hello.html")
    httpd.serve_forever()

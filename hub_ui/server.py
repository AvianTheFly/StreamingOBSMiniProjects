"""Hub HTTP transport and lifecycle.

Feature routes live in routes/. Audio reconciliation, settings, action dispatch,
hotkeys and browser updates have explicit owners alongside this file.
"""
from __future__ import annotations

import http.server
import json
import mimetypes
import threading
import urllib.parse
from pathlib import Path
from typing import Any
from . import hotkeys, updates
from .routes.audio import AudioRoutes
from .routes.profiles import ProfileRoutes
from .routes.projects import ProjectRoutes
from .routes.controls import ControlRoutes

_APP_DIR = Path(__file__).resolve().parent / "app"


class _Handler(AudioRoutes, ProfileRoutes, ProjectRoutes, ControlRoutes, http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):  # suppress default request logs
        pass

    def _json(self, code: int, data: Any) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _err(self, code: int, msg: str) -> None:
        self._json(code, {"error": msg})

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length", 0))
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path.rstrip("/") or "/"
        if   path == "/api/status":                 self._get_status()
        elif path == "/api/projects":               self._get_projects()
        elif path == "/api/rules":                  self._get_rules()
        elif path == "/api/settings":               self._get_settings()
        elif path == "/api/hub-actions":            self._get_hub_actions()
        elif path == "/api/editor-profiles":        self._get_editor_profiles()
        elif path == "/api/events":                 self._get_sse()
        elif path == "/api/info":                   self._get_info()
        elif path == "/api/audio":                  self._get_audio()
        elif path == "/api/obs/audio":              self._get_obs_audio()
        elif path == "/editor":                     self._redirect_to_editor()
        elif path.startswith("/api/projects/"):     self._get_project(path)
        else:                                       self._static(path)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path.rstrip("/")
        if path == "/api/rules":                  self._post_rules()
        elif path == "/api/settings":               self._post_settings()
        elif path.startswith("/api/hub-actions/"):  self._post_hub_action(path)
        elif path.startswith("/api/project-actions/"): self._post_project_action(path)
        elif path.startswith("/api/workflows/"):     self._post_workflow(path)
        elif path == "/api/editor-profiles":        self._post_editor_profiles()
        elif path == "/api/editor-project-settings": self._post_editor_project_settings()
        elif path == "/api/audio":                  self._post_audio()
        elif path == "/api/obs/audio":              self._post_obs_audio()
        elif path.startswith("/api/projects/"):     self._post_project(path)
        else:                                       self._err(404, "Not found")

    def _redirect_to_editor(self):
        port = getattr(self.server, "_editor_port", 8765)
        self.send_response(302)
        self.send_header("Location", f"http://localhost:{port}")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _static(self, path: str):
        if path == "/":
            fp = _APP_DIR / "index.html"
        else:
            fp = _APP_DIR / path.lstrip("/")

        if not fp.exists() or not fp.is_file():
            fp = _APP_DIR / "index.html"  # SPA fallback

        if not fp.exists():
            self._err(404, "Not found")
            return

        ct = mimetypes.guess_type(str(fp))[0] or "application/octet-stream"

        if fp.name == "index.html":
            # Inject the editor port so the nav link is always correct
            text = fp.read_text(encoding="utf-8").replace(
                "http://localhost:8000",
                f"http://localhost:{self.server._editor_port}",
            )
            data = text.encode("utf-8")
        else:
            data = fp.read_bytes()

        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _get_sse(self):
        updates.stream(self)


class HubUIServer:
    def __init__(self, port: int = 7420, editor_port: int = 8765) -> None:
        self.port        = port
        self.editor_port = editor_port

    def serve(self, stop_event: threading.Event) -> None:
        """Own the socket, UI workers and subscriptions until application shutdown.

        Bind first: an occupied port must not leave another hotkey listener or
        audio poller running. The local stop event also cleans up partial startup.
        """
        ui_stop = threading.Event()
        with http.server.ThreadingHTTPServer(("", self.port), _Handler) as server:
            server._editor_port = self.editor_port
            server.stop_event = ui_stop
            workers = [
                threading.Thread(target=updates.poll_loop, args=(ui_stop,),
                                 daemon=True, name="hub_ui:poll"),
                threading.Thread(target=hotkeys.hub_hotkey_loop, args=(ui_stop,),
                                 daemon=True, name="hub_ui:hotkeys"),
            ]
            http_thread = threading.Thread(target=server.serve_forever,
                                           daemon=True, name="hub_ui:http")
            started = []
            with updates.forward_domain_events():
                try:
                    for worker in workers:
                        worker.start()
                        started.append(worker)
                    http_thread.start()
                    print(f"[hub_ui] Serving on port {server.server_port}")
                    stop_event.wait()
                finally:
                    ui_stop.set()
                    if http_thread.is_alive():
                        server.shutdown()
                        http_thread.join(timeout=2)
                    for worker in started:
                        worker.join(timeout=2)

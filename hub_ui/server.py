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
from .routes.transitions import TransitionRoutes
from .routes.chat import ChatRoutes
from .routes.twitch_commands import TwitchCommandRoutes
from .routes.starting_soon import StartingSoonRoutes
from .routes.league_stats import LeagueStatsRoutes
from .routes.workflow_map import WorkflowMapRoutes
from .routes.mood_cues import MoodCueRoutes
from .routes.spirit_lobby import SpiritLobbyRoutes

_APP_DIR = Path(__file__).resolve().parent / "app"


class InvalidRequestBody(ValueError):
    pass


class _Handler(AudioRoutes, ProfileRoutes, ProjectRoutes, ControlRoutes, TransitionRoutes, ChatRoutes, TwitchCommandRoutes, StartingSoonRoutes, LeagueStatsRoutes, WorkflowMapRoutes, MoodCueRoutes, SpiritLobbyRoutes, http.server.BaseHTTPRequestHandler):

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
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n < 0:
                raise ValueError()
        except ValueError as exc:
            raise InvalidRequestBody("Invalid Content-Length") from exc
        if not n:
            return {}
        try:
            body = json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeError) as exc:
            raise InvalidRequestBody("Invalid JSON") from exc
        if not isinstance(body, dict):
            raise InvalidRequestBody("Expected a JSON object")
        return body

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path.rstrip("/") or "/"
        if path == '/api/spirit-lobby' or path.startswith('/api/spirit-lobby/'):
            return self._get_spirit_lobby(path)
        if path == '/api/mood-cues' or path.startswith('/api/mood-cues/audio/'):
            return self._get_mood_cues(path)
        if path == '/api/twitch-commands':
            return self._get_twitch_commands()
        if path == '/api/workflow-map' or path.startswith('/api/workflow-map/'):
            return self._get_workflow_map(path)
        if path=='/api/league-stats' or path.startswith('/api/league-stats/'):
            return self._get_league_stats(path)
        if path == '/api/starting-soon' or path.startswith('/starting-soon/art/'):
            return self._get_starting_soon(path)
        if path == '/chat':
            if urllib.parse.urlparse(self.path).path.endswith('/'):
                return self._static('/chat/index.html')
            self.send_response(302)
            self.send_header('Location', '/chat/')
            self.end_headers()
            return
        if path == '/transitions':
            if urllib.parse.urlparse(self.path).path.endswith('/'):
                return self._get_transition_asset('/transitions')
            self.send_response(302)
            self.send_header('Location', '/transitions/')
            self.end_headers()
            # A trailing slash is required for relative ES modules and artwork.
            return
        if path.startswith('/transitions/'):
            return self._get_transition_asset(path)
        if path.startswith('/viewer_assets/'):
            return self._get_chat_sticker(path)
        if   path == "/api/chat/settings":          self._get_chat_settings()
        elif path == "/api/chat/pointer":           self._get_chat_pointer()
        elif path == "/api/chat/catalog":           self._get_chat_catalog()
        elif path == "/api/status":                 self._get_status()
        elif path == "/api/twitch-stream-settings": self._get_twitch_stream_settings()
        elif path == "/api/projects":               self._get_projects()
        elif path == "/api/rules":                  self._get_rules()
        elif path == "/api/settings":               self._get_settings()
        elif path == "/api/hub-actions":            self._get_hub_actions()
        elif path == "/api/editor-profiles":        self._get_editor_profiles()
        elif path == "/api/events":                 self._get_sse()
        elif path == "/api/info":                   self._get_info()
        elif path == "/api/voice":                  self._get_voice()
        elif path == "/api/coordination":           self._get_coordination()
        elif path == "/api/audio":                  self._get_audio()
        elif path == "/api/obs/audio":              self._get_obs_audio()
        elif path == "/editor":                     self._redirect_to_editor()
        elif path.startswith("/api/projects/"):     self._get_project(path)
        else:                                       self._static(path)

    def do_POST(self):
        try:
            self._route_post()
        except InvalidRequestBody as exc:
            self._err(400, str(exc))

    def _route_post(self):
        path = urllib.parse.urlparse(self.path).path.rstrip("/")
        if path.startswith('/api/spirit-lobby/'):
            return self._post_spirit_lobby(path)
        if path.startswith('/api/mood-cues/'):
            return self._post_mood_cues(path)
        if path.startswith('/api/twitch-commands/'):
            return self._post_twitch_commands(path)
        if path.startswith('/api/league-stats/'):
            return self._post_league_stats(path)
        if path.startswith('/api/starting-soon/'):
            return self._post_starting_soon(path)
        if path == "/api/chat/settings":          self._post_chat_settings()
        elif path == "/api/chat/activate":         self._post_chat_activate()
        elif path == "/api/rules":                  self._post_rules()
        elif path == "/api/voice":                  self._post_voice()
        elif path == "/api/twitch-stream-settings": self._post_twitch_stream_settings()
        elif path == "/api/twitch-stream-settings/result": self._post_twitch_stream_settings_result()
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
            # This authored artifact may be stored on C: behind its project
            # junction when the media drive is full. Authorize only its own root.
            base = (_APP_DIR / 'spirit-lobby').resolve() if path.startswith('/spirit-lobby/') else _APP_DIR.resolve()
            relative = path.removeprefix('/spirit-lobby/') if path.startswith('/spirit-lobby/') else path.lstrip('/')
            fp = (base / relative).resolve()
            if not fp.is_relative_to(base):
                self._err(404, "Not found")
                return

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


class _HubHTTPServer(http.server.ThreadingHTTPServer):
    # ES-module previews open several sockets together. Windows rejects excess
    # connects when the default five-slot queue fills while the Hub is busy.
    request_queue_size = 64


class HubUIServer:
    def __init__(self, port: int = 7420, editor_port: int = 8765) -> None:
        self.port        = port
        self.editor_port = editor_port
        self.ready = threading.Event()

    def serve(self, stop_event: threading.Event) -> None:
        """Own the socket, UI workers and subscriptions until application shutdown.

        Bind first: an occupied port must not leave another hotkey listener or
        audio poller running. The local stop event also cleans up partial startup.
        """
        ui_stop = threading.Event()
        self.ready.clear()
        with _HubHTTPServer(("", self.port), _Handler) as server:
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
            from .workflow_map import journal
            with updates.forward_domain_events(), journal.observe():
                try:
                    for worker in workers:
                        worker.start()
                        started.append(worker)
                    http_thread.start()
                    self.ready.set()
                    print(f"[hub_ui] Serving on port {server.server_port}")
                    stop_event.wait()
                finally:
                    self.ready.clear()
                    ui_stop.set()
                    if http_thread.is_alive():
                        server.shutdown()
                        http_thread.join(timeout=2)
                    for worker in started:
                        worker.join(timeout=2)

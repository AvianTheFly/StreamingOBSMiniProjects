"""Editor HTTP parsing, static files, and dispatch to domain routes."""
from __future__ import annotations
import http.server
import json
import urllib.parse
from pathlib import Path
from lib.http_files import serve_file
from lib.hotkey_editor.profiles import PROFILE_ACTIONS
from .context import _EDITOR_DIR, _PENDING_MOVES_FILE
from .settings import _load_editor_state
from .assets import _load_pending_moves, _scan_sounds
from .layout import _layout_response, _sources_for_property_scope
from .presentation import _build_api_data
from .context import EditorContext
from .profile_routes import _ProfileRoutes
from .layout_routes import _LayoutRoutes
from .asset_routes import _AssetRoutes
from .voice_routes import _VoiceRoutes
from .session_routes import _SessionRoutes


class EditorHandler(_ProfileRoutes, _LayoutRoutes, _AssetRoutes, _VoiceRoutes, _SessionRoutes, http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        path = self.path.split('?')[0]
        if path in ('/', '/editor.html'):
            self._serve_editor_file(_EDITOR_DIR / 'editor.html')
        elif path == '/api/data':
            proj = self.context.current['proj']
            state = _load_editor_state(proj)
            self._json_ok(_build_api_data(proj, state, self.context.projects, self.context.current['proj']))
        elif path == '/api/assets':
            qs = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            proj_key = qs.get('project', [''])[0].strip()
            found = next((p for p in self.context.projects if p['key'] == proj_key), None)
            if not found:
                self._json_err(f"Project '{proj_key}' not found")
            else:
                files = _scan_sounds(found['asset_dir'], found['extensions'])
                self._json_ok({'ok': True, 'files': files, 'asset_dir': str(found['asset_dir']), 'project_key': proj_key})
        elif path == '/api/pending-moves':
            self._json_ok({'ok': True, 'moves': _load_pending_moves(), 'file': str(_PENDING_MOVES_FILE)})
        elif path == '/api/layout/data':
            self._json_ok({'ok': True, 'layout': _layout_response(self.context.current['proj'])})
        elif path.startswith('/api/layout/volume'):
            from urllib.parse import parse_qs, urlparse
            qs = parse_qs(urlparse(self.path).query)
            scope_type = qs.get('scope_type', ['group'])[0]
            scope_key = qs.get('scope_key', [''])[0]
            proj = self.context.current['proj']
            targets = _sources_for_property_scope(proj, {'scope_type': scope_type, 'scope_key': scope_key})
            if not targets:
                self._json_ok({'ok': True, 'db': None, 'mul': None, 'sources': []})
            else:
                try:
                    import obs
                    vols = []
                    for item in targets:
                        try:
                            v = obs.get_input_volume(item['source'])
                            if isinstance(v, dict):
                                vols.append(v.get('db', 0))
                        except Exception:
                            pass
                    avg_db = sum(vols) / len(vols) if vols else None
                    self._json_ok({'ok': True, 'db': avg_db, 'sources': [t['source'] for t in targets]})
                except Exception as exc:
                    self._json_err(str(exc))
        elif path.startswith('/assets/'):
            editor_asset = (_EDITOR_DIR / path.lstrip('/')).resolve()
            if _EDITOR_DIR.resolve() in editor_asset.parents and editor_asset.is_file():
                self._serve_file(editor_asset)
                return
            self._serve_asset(self.path[len('/assets/'):])
        elif path.startswith('/components/'):
            comp = (_EDITOR_DIR / path.lstrip('/')).resolve()
            if _EDITOR_DIR.resolve() in comp.parents and comp.is_file():
                self._serve_file(comp)
            else:
                self.send_error(404)
        else:
            file_path = (_EDITOR_DIR / path.lstrip('/')).resolve()
            if _EDITOR_DIR.resolve() in file_path.parents and file_path.is_file():
                self._serve_file(file_path)
            else:
                self.send_error(404)

    def _serve_editor_file(self, path: Path):
        if not path.is_file():
            self.send_error(500, f'{path.name} not found')
            return
        self._serve_file(path)

    def _serve_asset(self, encoded_path: str):
        proj = self.context.current['proj']
        filename = urllib.parse.unquote(encoded_path)
        file_path = (proj['asset_dir'] / filename).resolve()
        if proj['asset_dir'].resolve() in file_path.parents and file_path.is_file() and (file_path.suffix.lower() in proj['extensions']):
            self._serve_file(file_path)
        else:
            self.send_error(404)

    def _serve_file(self, path: Path):
        serve_file(self, path, headers={'Access-Control-Allow-Origin': '*'})

    def do_POST(self):
        path = self.path.split('?')[0]
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        if path == '/api/media/replace':
            self._handle_media_replace(body)
            return
        if path == '/api/voice/transcribe':
            self._handle_voice_transcribe(body)
            return
        try:
            data = json.loads(body) if length else {}
        except json.JSONDecodeError:
            self._json_err('Invalid JSON')
            return
        if not isinstance(data, dict):
            self._json_err('Expected a JSON object')
            return
        profile_action = path.removeprefix('/api/profile/')
        if path.startswith('/api/profile/') and profile_action in PROFILE_ACTIONS:
            self._handle_profile(profile_action, data)
            return
        routes = {'/api/save': self._handle_save, '/api/config/save': self._handle_config_save, '/api/phrases/save': self._handle_phrases_save, '/api/voice/score': self._handle_voice_score, '/api/media-profile/create': self._handle_media_profile_create, '/api/layout/save': self._handle_layout_save, '/api/layout/properties/apply': self._handle_layout_properties_apply, '/api/layout/source-visibility': self._handle_layout_source_visibility, '/api/switch': self._handle_project_switch, '/api/pending-moves/save': self._handle_pending_moves_save, '/api/pending-moves/commit': self._handle_pending_moves_commit, '/api/shutdown': self._handle_shutdown}
        fn = routes.get(path)
        if fn:
            fn(data)
        else:
            self.send_error(404)

    def _json_ok(self, obj):
        self._send_json(200, obj)

    def _json_err(self, msg, status=400):
        self._send_json(status, {'ok': False, 'error': msg})

    def _send_json(self, status: int, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)


def _make_handler(*, current, all_projects, server_ref):
    session = EditorContext(current, all_projects, server_ref)
    class Handler(EditorHandler):
        context = session
    return Handler

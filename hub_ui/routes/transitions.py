"""Read-only preview assets. Scene playback belongs to native OBS, not HTTP."""
import mimetypes
from pathlib import Path
from urllib.parse import unquote

WEB = Path(__file__).resolve().parents[2] / 'lib' / 'scene_transitions' / 'web'


class TransitionRoutes:
    def _get_transition_asset(self, path):
        relative = unquote(path.removeprefix('/transitions')).lstrip('/') or 'index.html'
        file = (WEB / relative).resolve()
        if not file.is_relative_to(WEB.resolve()) or not file.is_file():
            return self._err(404, 'Transition asset not found')
        data = file.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

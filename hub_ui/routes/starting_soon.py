"""HTTP transport for the public Starting Soon API and bundled artwork."""
from pathlib import Path
import mimetypes


class StartingSoonRoutes:
    def _get_starting_soon(self, path):
        from starting_soon import api
        if path == '/api/starting-soon':
            try:
                self._json(200, api.state())
            except Exception as exc:
                self._err(400, str(exc))
            return
        from starting_soon.config import ART
        name = path.removeprefix('/starting-soon/art/')
        target = (ART / name).resolve()
        if not target.is_relative_to(ART.resolve()) or not target.is_file():
            return self._err(404, 'Artwork not found')
        payload = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(target.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _post_starting_soon(self, path):
        from starting_soon import api
        from starting_soon.settings import Conflict
        body = self._body()
        try:
            result = api.save(body) if path == '/api/starting-soon/settings' else api.action(path.rsplit('/', 1)[-1], body)
            self._json(200 if result.get('ok', True) else 409, result)
        except Conflict as exc:
            self._err(409, str(exc))
        except (ValueError, OSError) as exc:
            self._err(400, str(exc))

"""HTTP composition for League's public stage appearance API."""
from urllib.parse import parse_qs, urlparse, unquote
import mimetypes


class LeagueStageRoutes:
    def _get_league_stage(self, path):
        from league_api import stage_api
        try:
            if path == '/api/league-stage':
                return self._json(200, stage_api.catalog())
            from lib.http_files import serve_file
            target = stage_api.asset(unquote(path.removeprefix('/api/league-stage/art/')))
            return serve_file(self, target, content_type=mimetypes.guess_type(target.name)[0])
        except (ValueError, FileNotFoundError) as exc:
            self._err(400, str(exc))

    def _post_league_stage(self, path):
        from league_api import stage_api
        try:
            if path == '/api/league-stage/upload':
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 12 * 1024 * 1024:
                    self.close_connection = True
                    raise ValueError('Choose an image under 12 MB')
                name = parse_qs(urlparse(self.path).query).get('name', ['Uploaded image'])[0]
                payload = self.rfile.read(size)
                if len(payload) != size:
                    raise ValueError('Image upload was interrupted')
                result = stage_api.upload(name, payload)
            elif path == '/api/league-stage/select':
                result = stage_api.select(self._body())
            elif path == '/api/league-stage/draft-theme':
                result = stage_api.draft_theme(self._body().get('theme'))
            elif path == '/api/league-stage/queue-theme':
                result = stage_api.queue_theme(self._body().get('theme'))
            else:
                return self._err(404, 'Unknown stage control')
            self._json(200, result)
        except (ValueError, OSError) as exc:
            self._err(400, str(exc))

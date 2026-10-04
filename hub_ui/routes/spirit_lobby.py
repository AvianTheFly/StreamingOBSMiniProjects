"""Transport adapter for the public lobby media-library owner."""
import urllib.parse
from lib.http_files import serve_file
from spirit_lobby.library import Library
from spirit_lobby.actions import catalog, envelope
from hub_ui.updates import broadcast


class SpiritLobbyRoutes:
    def _lobby_library(self):
        return getattr(self.server, 'screen_library', None) or Library()

    def _get_spirit_lobby(self, path):
        try:
            library = self._lobby_library()
            if path == '/api/spirit-lobby/actions':
                self._json(200, {'actions': catalog()})
            elif path == '/api/spirit-lobby':
                self._json(200, library.state())
            elif path.startswith('/api/spirit-lobby/media/'):
                serve_file(self, library.media_path(path.rsplit('/', 1)[-1]), headers={'Cache-Control': 'public, max-age=3600'})
            else:
                self._err(404, 'Not found')
        except (ValueError, OSError) as exc:
            self._err(400, str(exc))

    def _post_spirit_lobby(self, path):
        try:
            library = self._lobby_library()
            if path == '/api/spirit-lobby/action':
                cue = envelope(self._body())
                broadcast('spirit_lobby_action', cue)
                return self._json(200, {'ok': True, **cue})
            elif path == '/api/spirit-lobby/import':
                query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                size = int(self.headers.get('Content-Length', 0))
                self.connection.settimeout(20)
                state = library.import_stream(self.rfile, size, query.get('name', [''])[0], stopped=self.server.stop_event.is_set)
            elif path == '/api/spirit-lobby/settings':
                state = library.save(self._body())
            elif path == '/api/spirit-lobby/remove':
                state = library.remove(self._body().get('id'))
            else:
                return self._err(404, 'Not found')
            self._json(200, state)
        except (ValueError, OSError) as exc:
            self.close_connection = True
            self._err(400, str(exc))

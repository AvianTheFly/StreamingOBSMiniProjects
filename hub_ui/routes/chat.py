"""Chat controls and public catalog. The desktop host owns topmost/input behavior."""
import re
import mimetypes
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from lib.chat_overlay import settings


class ChatRoutes:
    def _get_chat_pointer(self):
        origin = self.headers.get('Origin')
        if self.client_address[0] not in ('127.0.0.1', '::1') or (origin and urlparse(origin).netloc != self.headers.get('Host')):
            return self._err(403, 'Desktop readability is available on this computer.')
        from lib.chat_overlay.pointer import pointer
        self._json(200, pointer.read())

    def _get_chat_sticker(self, path):
        root = Path(__file__).resolve().parents[1] / 'viewer_assets'
        file = (root / path.removeprefix('/viewer_assets/')).resolve()
        if not file.is_relative_to(root.resolve()) or not file.is_file() or file.suffix.lower() not in ('.png', '.gif', '.webp', '.jpg'):
            return self._err(404, 'Sticker not found.')
        data = file.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(file.name)[0])
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

    def _get_chat_settings(self):
        self._json(200, settings.read())

    def _post_chat_settings(self):
        # Local UI only; never accept cross-origin settings writes.
        origin = self.headers.get('Origin')
        if origin and urlparse(origin).netloc != self.headers.get('Host'):
            return self._err(403, 'Open chat controls from this Hub.')
        try:
            self._json(200, settings.save(self._body()))
        except (ValueError, TypeError) as exc:
            self._err(400, str(exc))

    def _get_chat_catalog(self):
        query = parse_qs(urlparse(self.path).query)
        channel = settings.read()['channel']
        default_id = os.environ.get('TWITCH_BROADCASTER_ID', '') if channel == os.environ.get('TWITCH_CHANNEL', '').lower().lstrip('#') else ''
        channel_id = query.get('id', [''])[0] or default_id
        if not re.fullmatch(r'[a-z0-9_]{1,25}', channel) or (channel_id and not re.fullmatch(r'\d{1,24}', channel_id)):
            return self._err(400, 'Configure a channel first.')
        from lib.chat_overlay.catalog import catalog
        self._json(200, catalog(channel, channel_id))

    def _post_chat_activate(self):
        origin = self.headers.get('Origin')
        if origin and urlparse(origin).netloc != self.headers.get('Host'):
            return self._err(403, 'Open chat controls from this Hub.')
        if self.client_address[0] not in ('127.0.0.1', '::1'):
            return self._err(403, 'Launch the desktop overlay from this computer.')
        self._body()
        try:
            from lib.chat_overlay.desktop import activate
            self._json(200, activate(self.server.server_port))
        except (ValueError, OSError, StopIteration) as exc:
            self._err(400, str(exc))

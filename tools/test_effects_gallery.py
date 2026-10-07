"""Isolated read-only gallery resource and range regression checks."""
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from hub_ui.server import _Handler


class GalleryTests(unittest.TestCase):
    def test_private_catalog_media_and_path_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'cue.mp3').write_bytes(b'0123456789')
            (root/'scene.js').write_text('export const ready=true;')
            with patch('hub_ui.routes.effects_gallery.sound_rows', return_value=[{'id':'sound:cue'}]), \
                 patch('hub_ui.routes.effects_gallery.league_catalog', return_value=[{'id':'league:kill'}]), \
                 patch('hub_ui.routes.effects_gallery.sound_file', side_effect=lambda name: root/'cue.mp3' if name=='cue' else None), \
                 patch('hub_ui.routes.effects_gallery.league_art_root', return_value=root):
                server = ThreadingHTTPServer(('127.0.0.1',0),_Handler)
                thread = threading.Thread(target=server.serve_forever,daemon=True)
                thread.start()
                base = f'http://127.0.0.1:{server.server_port}'
                try:
                    with urlopen(base+'/api/effects-gallery') as response:
                        self.assertIn(b'league:kill',response.read())
                    with urlopen(Request(base+'/effects/audio/cue',headers={'Range':'bytes=2-5'})) as response:
                        self.assertEqual(response.status,206)
                        self.assertEqual(response.read(),b'2345')
                    with urlopen(base+'/effects/art/league/scene.js') as response:
                        self.assertIn(b'export',response.read())
                    for path in ('/effects/audio/missing','/effects/audio/..%2Fcue','/effects/art/league/%2e%2e%2fscene.js','/effects/art/league/production.json'):
                        with self.assertRaises(HTTPError) as error:
                            urlopen(base+path)
                        self.assertEqual(error.exception.code,404)
                finally:
                    server.shutdown();server.server_close();thread.join(2)

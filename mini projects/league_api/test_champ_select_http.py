"""The installed OBS page must receive every module in its motion import graph."""
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from urllib.request import urlopen

from .http_server import make_handler


class ChampionMotionHTTPTests(unittest.TestCase):
    def test_motion_modules_are_served_as_javascript(self):
        root = Path(__file__).resolve().parent
        handler = make_handler(SimpleNamespace(), root=root, port=0, load_config=lambda: {})
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        worker = threading.Thread(target=server.serve_forever)
        worker.start()
        try:
            for name in ('app.js', 'layout.js', 'world-motion.js', 'world-art.js', 'world-events.js',
                         'world-assets.js', 'vfx-texture.js', 'vfx-ink.js', 'vfx-timing.js', 'spirit-locks.js', 'spirit-secrets.js', 'world-guests.js', 'scene-map.js', 'draft-cues.js', 'draft-demo.js'):
                with self.subTest(module=name), urlopen(
                    f'http://127.0.0.1:{server.server_port}/champ-select/{name}', timeout=3
                ) as response:
                    self.assertEqual(response.headers.get_content_type(), 'text/javascript')
                    self.assertEqual(response.read(), (root / 'champ_select_web' / name).read_bytes())
            with urlopen(f'http://127.0.0.1:{server.server_port}/shared/world-motion.js', timeout=3) as response:
                self.assertEqual(response.read(), (root.parents[1] / 'lib/browser_effects/web/world-motion.js').read_bytes())
            for theme in ('bear', 'turtle', 'ram', 'phoenix'):
                for folder,ext in (('backgrounds', 'jpg'), ('masks', 'svg'), ('vfx', 'png')):
                    with urlopen(f'http://127.0.0.1:{server.server_port}/champ-select/{folder}/{theme}.{ext}', timeout=3) as response:
                        self.assertGreater(len(response.read()), 100)
            for font in ('barlow', 'cinzel'):
                with urlopen(f'http://127.0.0.1:{server.server_port}/champ-select/fonts/{font}.ttf', timeout=3) as response:
                    self.assertEqual(response.headers.get_content_type(), 'font/ttf')
            for character in ('kirby', 'boo', 'crewmate', 'goose'):
                with urlopen(f'http://127.0.0.1:{server.server_port}/champ-select/guests/game-{character}-0.png', timeout=3) as response:
                    self.assertEqual(response.headers.get_content_type(), 'image/png')
                    self.assertTrue(response.read().startswith(b'\x89PNG'))
        finally:
            server.shutdown()
            server.server_close()
            worker.join(3)
        self.assertFalse(worker.is_alive())

"""Derived geometry publication never publishes stale, missing or broken data."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from spotify.morph_assets import PreparedMorphs, RECIPE_FILES, recipe_hash
from spotify.http_server import make_server
from spotify.service import SpotifyState
import threading
from urllib.request import urlopen
from urllib.error import HTTPError


class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.web = Path(self.temp.name)
        for name in RECIPE_FILES:
            (self.web/name).write_text('original '+name)
        self.owner = PreparedMorphs(self.web)

    def publish(self):
        payload = json.dumps({'schema': 1, 'recipe_hash': recipe_hash(self.web)})
        (self.web/'prepared-morphs.json').write_text(payload)
        return payload.encode()

    def test_cache_then_recipe_change_never_serves_stale_geometry(self):
        original = self.publish()
        self.assertEqual(self.owner.read(), original)
        with patch.object(Path, 'read_bytes', side_effect=AssertionError('cached bytes must be reused')):
            self.assertIs(self.owner.read(), self.owner.payload)
        (self.web/RECIPE_FILES[0]).write_text('changed geometry')
        self.assertIsNone(self.owner.read())
        replacement = self.publish()
        self.assertEqual(self.owner.read(), replacement)

    def test_git_line_endings_do_not_invalidate_identical_recipes(self):
        path = self.web / RECIPE_FILES[0]
        path.write_bytes(b'first\nsecond\n')
        original = self.publish()
        path.write_bytes(b'first\r\nsecond\r\n')
        self.assertEqual(self.owner.read(), original)

    def test_missing_malformed_oversized_and_replaced_asset(self):
        self.assertIsNone(self.owner.read())
        self.publish()
        self.assertIsNotNone(self.owner.read())
        (self.web/'prepared-morphs.json').write_text('malformed')
        self.assertIsNone(self.owner.read())
        self.publish()
        with patch('spotify.morph_assets.MAX_BYTES', 5):
            self.assertIsNone(PreparedMorphs(self.web).read())
        (self.web/'prepared-morphs.json').unlink()
        self.assertIsNone(self.owner.read())

    def test_http_contract_and_missing_asset_fallback(self):
        payload = self.publish()
        with patch('spotify.http_server.WEB', self.web):
            server = make_server(SpotifyState(), 0)
        worker = threading.Thread(target=server.serve_forever)
        worker.start()
        try:
            url = f'http://127.0.0.1:{server.server_port}/prepared-morphs.json'
            with urlopen(url) as response:
                self.assertEqual(response.read(), payload)
                self.assertIn('application/json', response.headers['Content-Type'])
            (self.web/'prepared-morphs.json').unlink()
            with self.assertRaises(HTTPError) as caught:
                urlopen(url)
            self.assertEqual(caught.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()
            worker.join(3)
        self.assertFalse(worker.is_alive())


if __name__ == '__main__':
    unittest.main()

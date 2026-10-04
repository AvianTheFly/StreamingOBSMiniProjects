"""Media isolation, atomic publication and personal-data preservation."""
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
from PIL import Image
from spirit_lobby.library import Library, MAX_BYTES


def image_bytes():
    out = io.BytesIO()
    Image.new('RGB', (32, 16), 'navy').save(out, format='PNG')
    return out.getvalue()


class ScreenLibraryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.library = Library(self.directory.name, snapshot=False)

    def import_image(self):
        payload = image_bytes()
        return self.library.import_stream(io.BytesIO(payload), len(payload), 'screen.png')['imported']

    def test_choices_and_removal_preserve_original_file_and_unknown_data(self):
        identity = self.import_image()
        media = self.library.media_path(identity)
        data = json.loads(self.library.manifest.read_text(encoding='utf8'))
        data['personal'] = {'keep': 7}
        data['assets']['malformed-personal-entry'] = 'preserve me'
        self.library.manifest.write_text(json.dumps(data), encoding='utf8')
        self.library.save({'selected': {'main': identity, 'left': identity}, 'texts': {'title': 'HELLO'}})
        self.assertEqual(self.library.state()['selected']['main'], identity)
        self.library.remove(identity)
        self.assertTrue(media.is_file())
        self.assertEqual(self.library.state()['selected']['main'], 'cosmos')
        current = json.loads(self.library.manifest.read_text(encoding='utf8'))
        self.assertEqual(current['personal'], {'keep': 7})
        self.assertEqual(current['assets']['malformed-personal-entry'], 'preserve me')
        self.assertEqual(current['texts']['title'], 'HELLO')

    def test_invalid_or_incomplete_upload_never_publishes_an_asset(self):
        for payload, size, name in [(b'bad', 3, 'bad.png'), (b'x', 2, 'short.png'), (b'x', MAX_BYTES+1, 'big.png'), (b'x', 1, 'bad.html')]:
            with self.assertRaises((ValueError, OSError)):
                self.library.import_stream(io.BytesIO(payload), size, name)
            self.assertFalse(self.library.manifest.exists())
            self.assertFalse(list(self.library.root.glob('*.upload')))
            self.assertFalse(list(self.library.root.glob('*.png')))

    def test_malformed_catalog_and_invalid_selection_survive(self):
        self.library.manifest.write_text('{bad json', encoding='utf8')
        with self.assertRaises(ValueError):
            self.library.save({'selected': {'main': 'cosmos'}})
        self.assertEqual(self.library.manifest.read_text(encoding='utf8'), '{bad json')
        self.library.manifest.write_text('{"personal":42}', encoding='utf8')
        for body in [{'selected': {'main': 'missing'}}, {'selected': {'left': 'cosmos'}}, {'selected': {'main': []}}]:
            with self.assertRaises(ValueError):
                self.library.save(body)
        self.assertEqual(self.library.manifest.read_text(encoding='utf8'), '{"personal":42}')

    def test_concurrent_imports_publish_complete_map_and_cancel_leaves_no_copy(self):
        results = []
        threads = [threading.Thread(target=lambda: results.append(self.import_image())) for _ in range(2)]
        for thread in threads: thread.start()
        for thread in threads: thread.join(5)
        self.assertEqual(len(set(results)), 2)
        self.assertEqual(set(json.loads(self.library.manifest.read_text(encoding='utf8'))['assets']), set(results))
        payload = image_bytes()
        with self.assertRaises(ValueError):
            self.library.import_stream(io.BytesIO(payload), len(payload), 'cancel.png', stopped=lambda: True)
        self.assertFalse(list(self.library.root.glob('*.upload')))

    def test_media_paths_cannot_escape_library(self):
        identity = self.import_image()
        for key in ['../catalog.json', identity+'..', 'x'*32]:
            with self.assertRaises(ValueError): self.library.media_path(key)
        data = json.loads(self.library.manifest.read_text(encoding='utf8'))
        data['assets'][identity]['file'] = '../outside.png'
        self.library.manifest.write_text(json.dumps(data), encoding='utf8')
        with self.assertRaises(ValueError): self.library.media_path(identity)


if __name__ == '__main__':
    unittest.main()

"""Offline regression checks for the portable cameo pack's export contract."""
from pathlib import Path
import json
import unittest

PACK = Path(__file__).parent / 'v1'


class CameoPackTests(unittest.TestCase):
    def test_deliverables_and_portable_references(self):
        manifest = json.loads((PACK / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(manifest['characters']), 8)
        self.assertEqual(len(manifest['clips']), 24)
        self.assertEqual(len({c['id'] for c in manifest['clips']}), 24)
        for character in manifest['characters']:
            self.assertEqual(sum(c['character'] == character['id'] for c in manifest['clips']), 3)
            for pose in character['poses']:
                self.assertTrue((PACK / pose).is_file(), pose)
        for clip in manifest['clips']:
            self.assertTrue((PACK / clip['file']).is_file(), clip['id'])
            self.assertTrue((PACK / 'frames' / (clip['id'] + '.zip')).is_file())
            self.assertEqual(clip['frames'], clip['fps'] * clip['duration'])

    def test_transparent_endpoints_and_decoder_evidence(self):
        render = json.loads((PACK / 'render-check.json').read_text(encoding='utf-8'))
        self.assertTrue(render['oneShotClears'])
        self.assertEqual(render['errors'], [])
        self.assertEqual(render['staleSelection']['clip'], render['staleSelection']['images'])
        for check in render['checks']:
            self.assertEqual(check['first'], 0)
            self.assertEqual(check['last'], 0)
            self.assertGreater(check['max'], 8000)
        encoded = json.loads((PACK / 'encode-check.json').read_text(encoding='utf-8'))
        self.assertEqual(len(encoded), len(render['checks']))
        for check in encoded:
            self.assertTrue(check['transparent_endpoints'])
            self.assertTrue(check['alpha_content'])
            self.assertEqual(check['decoded_frames'], 120)


if __name__ == '__main__':
    unittest.main()

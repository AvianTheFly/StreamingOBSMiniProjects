"""Trailer cuts must never read outside real media or write over source folders."""
import copy
from pathlib import Path
import tempfile
import unittest

from stream_brand.trailer.timeline import validate
from stream_brand.trailer.render import parse_loudness


class TrailerTimelineTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root/'original.mp4').write_bytes(b'untouched original')
        (self.root/'card.png').write_bytes(b'untouched card')
        self.plan = {'fps': 60, 'width': 1920, 'height': 1080,
            'output_dir': str(self.root/'exports'), 'segments': [
                {'id': 'play', 'kind': 'video', 'source': 'original.mp4', 'start': 2, 'duration': 4},
                {'id': 'card', 'kind': 'still', 'source': 'card.png', 'duration': 2}]}

    @staticmethod
    def probe(source):
        return {'streams': [{'codec_type': 'video'}, {'codec_type': 'audio'}],
                'format': {'duration': '10'}}

    def test_exact_timeline_and_originals_remain_untouched(self):
        before = copy.deepcopy(self.plan)
        rows, frames = validate(self.plan, self.root, self.probe)
        self.assertEqual(frames, 360)
        self.assertEqual([s['timeline_start'] for s in rows], [0, 4])
        self.assertEqual(self.plan, before)
        self.assertEqual((self.root/'original.mp4').read_bytes(), b'untouched original')
        self.assertFalse((self.root/'exports').exists())

    def test_cut_past_source_is_rejected(self):
        self.plan['segments'][0]['start'] = 8
        with self.assertRaisesRegex(ValueError, 'exceeds source'):
            validate(self.plan, self.root, self.probe)

    def test_source_folder_cannot_become_export_folder(self):
        self.plan['output_dir'] = str(self.root)
        with self.assertRaisesRegex(ValueError, 'outside'):
            validate(self.plan, self.root, self.probe)

    def test_invalid_cut_values_and_partial_frames_are_rejected(self):
        for value in (-1, 0, float('nan'), float('inf'), True, 1.001):
            with self.subTest(duration=value):
                plan = copy.deepcopy(self.plan)
                plan['segments'][0]['duration'] = value
                with self.assertRaises(ValueError):
                    validate(plan, self.root, self.probe)

    def test_missing_picture_and_missing_file_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'No picture'):
            validate(self.plan, self.root, lambda p: {'streams': []})
        self.plan['segments'][0]['source'] = 'missing.mp4'
        with self.assertRaises(FileNotFoundError):
            validate(self.plan, self.root, self.probe)

    def test_duplicate_names_and_unknown_kinds_are_rejected(self):
        self.plan['segments'][1]['id'] = 'play'
        with self.assertRaisesRegex(ValueError, 'unique'):
            validate(self.plan, self.root, self.probe)
        self.plan['segments'][1]['id'] = 'card'
        self.plan['segments'][1]['kind'] = 'stream'
        with self.assertRaisesRegex(ValueError, 'Unknown'):
            validate(self.plan, self.root, self.probe)

    def test_negative_starts_and_still_seeks_are_rejected(self):
        self.plan['segments'][0]['start'] = -1
        with self.assertRaises(ValueError):
            validate(self.plan, self.root, self.probe)
        self.plan['segments'][0]['start'] = 2
        self.plan['segments'][1]['start'] = 1
        with self.assertRaisesRegex(ValueError, 'Still images'):
            validate(self.plan, self.root, self.probe)

    def test_loudness_json_allows_ffmpeg_summary_after_it(self):
        stderr = ('[Parsed_loudnorm] summary\n'
                  '{"input_i":"-16.1","input_tp":"-3.3","input_lra":"0.9"}\n'
                  '[out#0/null] video:0KiB audio:3500KiB\n')
        self.assertEqual(parse_loudness(stderr)['input_i'], '-16.1')
        with self.assertRaises(ValueError):
            parse_loudness('No measurement available')


if __name__ == '__main__':
    unittest.main()

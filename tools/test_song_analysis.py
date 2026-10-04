"""Preserve pre-cache visualizer output and verify disposable cache lifetimes."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from lib.paths import ensure_import_paths
ensure_import_paths()
from specific_song.analysis_cache import AnalysisCache, close_analysis
from specific_song.bass_detector import BassDetector


def frames():
    for i in range(120):
        t = (np.arange(1024)+i*1024)/44100
        data = (np.sin(t*2*np.pi*75)*(.1 if i%13<3 else .02)
                + np.sin(t*2*np.pi*440)*.03 + np.sin(t*2*np.pi*3200)*.02).astype('float32')
        if i%31<4:
            data[:] = 0
        yield data


class AnalysisTests(unittest.TestCase):
    def test_cached_and_uncached_match_pre_change_signals(self):
        expected = json.loads((Path(__file__).parent/'fixtures/music_analysis_signals.json').read_text())
        for cached in (False, True):
            detector = BassDetector()
            detector._last_peak_t = 100
            actual = []
            for i, frame in enumerate(frames()):
                if cached:
                    detector._process_features(detector.frame_features(frame), 100+i*1024/44100)
                else:
                    detector._process_frame(frame, 100+i*1024/44100)
                actual.append([detector.get_level(), detector.get_motion(), detector.get_intensity(),
                               detector.get_melody(), detector.get_presence(), detector.get_transient(),
                               detector.consume_beat(), detector.consume_oomph()])
            np.testing.assert_allclose(actual, expected, rtol=0, atol=1e-12)

    def test_cache_roundtrip_invalidation_and_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root/'song.wav'
            source.write_bytes(b'original')
            cache = AnalysisCache(source,44100,1024,60.,180.,root=root/'cache')
            rows = np.arange(70,dtype=np.float64).reshape(-1,7)
            self.assertTrue(cache.save(rows))
            data = cache.load()
            np.testing.assert_array_equal(data,rows)
            close_analysis(data)
            source.write_bytes(b'replacement')
            self.assertIsNone(cache.load())
            changed = AnalysisCache(source,44100,1024,60.,180.,root=root/'cache')
            self.assertNotEqual(cache.path,changed.path)
            self.assertIsNone(changed.load())
            changed.path.write_bytes(b'partial write')
            self.assertIsNone(changed.load())

    def test_cached_playback_never_decodes_or_ffts(self):
        detector = BassDetector(audio_file=Path('song.wav'))
        detector._running = True
        rows = np.zeros((3,7),dtype=np.float64)
        with patch.object(detector,'analysis_cache') as cache, \
             patch('specific_song.bass_detector.subprocess.Popen') as decode, \
             patch('specific_song.bass_detector.np.fft.rfft') as fft, \
             patch('specific_song.bass_detector.time.sleep'):
            cache.return_value.load.return_value = rows
            detector._stream_file_loop()
        decode.assert_not_called()
        fft.assert_not_called()

    def test_paused_cache_waits_and_cancellation_stops_before_next_frame(self):
        detector = BassDetector(audio_file=Path('song.wav'))
        detector._running = True
        detector._paused.set()
        def cancel(_):
            detector._running = False
        with patch.object(detector,'_process_features') as process, \
             patch('specific_song.bass_detector.time.sleep',side_effect=cancel):
            detector._analysis_loop(np.zeros((3,7)))
        process.assert_not_called()


if __name__ == '__main__':
    unittest.main()

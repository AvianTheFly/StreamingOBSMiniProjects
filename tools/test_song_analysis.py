"""Cached/live signal agreement and disposable cache lifetimes."""
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
    def test_saved_analysis_matches_live_signals_and_still_reacts_to_music(self):
        def signals(detector):
            return [detector.get_level(), detector.get_motion(), detector.get_intensity(),
                    detector.get_melody(), detector.get_presence(), detector.get_transient(),
                    detector.consume_beat(), detector.consume_oomph()]

        live, cached = BassDetector(), BassDetector()
        live._last_peak_t = cached._last_peak_t = 100
        audio = [*frames(), *[np.zeros(1024, dtype=np.float32) for _ in range(60)]]
        expected, measurements = [], []
        for i, frame in enumerate(audio):
            measurements.append(live._process_frame(frame, 100+i*1024/44100))
            expected.append(signals(live))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'song.wav'
            source.write_bytes(b'disposable identity for generated PCM')
            cache = AnalysisCache(source, 44100, 1024, 60., 180., root=root/'cache')
            self.assertTrue(cache.save(measurements))
            rows = cache.load()
            self.assertIsNotNone(rows)
            try:
                actual = []
                for i, row in enumerate(rows):
                    cached._process_features(row, 100+i*1024/44100)
                    actual.append(signals(cached))
            finally:
                close_analysis(rows)
        np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-10)
        # Agreement alone would let two silent/broken paths pass. Check an
        # audible response and decay, without freezing the visualizer's tuning.
        values = np.asarray(actual)
        self.assertTrue(np.isfinite(values).all())
        self.assertGreater(values[:, 0].max(), 0)
        self.assertGreater(np.ptp(values[:, 0]), 0)
        self.assertLess(values[-1, 0], values[:, 0].max() * .1)

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

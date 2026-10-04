"""Timbre and absolute dynamics regressions, independent of licensed music."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.audio_analysis import AudioAnalysis, quiet_features
from spotify.audio_channel import AudioChannel
import multiprocessing


class TextureTests(unittest.TestCase):
    def tone(self, modulation=0., depth=0., gain=.15):
        t = np.arange(2048)/44100
        x = np.sin(2*np.pi*1000*t)*(1+depth*np.sin(2*np.pi*modulation*t))
        x *= gain/np.sqrt(np.mean(x*x))
        return np.column_stack((x, x))

    def test_equal_level_grit_is_distinct_from_clean_and_slow_tremolo(self):
        features = [AudioAnalysis().analyze(self.tone(rate, depth))[1]
                    for rate, depth in [(0, 0), (70, .75), (3, .75)]]
        clean, gritty, tremolo = features
        self.assertGreater(gritty['roughness'], .6)
        self.assertLess(clean['roughness'], .02)
        self.assertLess(tremolo['roughness'], .02)
        self.assertTrue(50 < gritty['texture_rate'] < 100)
        for f in features:
            self.assertAlmostEqual(f['loudness'], .3, places=5)

    def test_quiet_wave_and_presence_do_not_normalize_back_to_loud(self):
        loud = AudioAnalysis().analyze(self.tone())[1]
        quiet = AudioAnalysis().analyze(self.tone(gain=.015))[1]
        self.assertAlmostEqual(quiet['loudness']/loud['loudness'], .1, places=5)
        self.assertLess(np.std(quiet['waveform']), np.std(loud['waveform'])*.2)
        self.assertGreater(max(loud['voice_levels']), .25)
        np.testing.assert_allclose(quiet['voice_levels'], np.array(loud['voice_levels'])*.1, rtol=1e-5, atol=1e-9)
        # Relative timbre survives reduced volume without being mapped to a hit.
        gritty = AudioAnalysis().analyze(self.tone(70, .75, .015))[1]
        self.assertGreater(gritty['roughness'], .6)

    def test_texture_reuses_transform_and_mailbox_preserves_complete_values(self):
        with patch('numpy.fft.rfft', wraps=np.fft.rfft) as transform:
            bands, f = AudioAnalysis().analyze(self.tone(70, .75))
        self.assertEqual(transform.call_count, 1)
        channel = AudioChannel(multiprocessing.get_context('spawn'))
        channel.publish_audio(bands, f, 1., .2, True)
        result = channel.read(-1)
        self.assertIsNotNone(result)
        _, received, *_ = channel.unpack(result['values'])
        for key in ['roughness', 'texture_rate', 'noisiness', 'loudness']:
            self.assertAlmostEqual(received[key], f[key], places=5)
        np.testing.assert_allclose(received['voice_levels'], f['voice_levels'])
        _, silence = AudioAnalysis().analyze(np.zeros((2048, 2)))
        self.assertEqual(silence, quiet_features())


if __name__ == '__main__':
    unittest.main()

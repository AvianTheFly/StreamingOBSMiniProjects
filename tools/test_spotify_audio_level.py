"""Playback gain independence without flattening short musical dynamics."""
import unittest

import numpy as np

from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.audio_analysis import AudioAnalysis
from spotify.audio_level import AudioLevel


class AudioLevelTests(unittest.TestCase):
    def song(self):
        t = np.arange(2048) / 44100
        left = .1*np.sin(2*np.pi*86*t) + .04*np.sin(2*np.pi*1700*t)
        return np.column_stack((left, left*.7))

    def test_same_music_at_different_playback_volumes_has_same_features(self):
        reference = None
        for volume in (1., .5, .1, .01, .001):
            level, analysis = AudioLevel(), AudioAnalysis()
            frames = []
            for dynamic in (1., .5, .1, .8, 1., .2):
                bands, features = analysis.analyze(level.apply(self.song()*volume*dynamic), realtime=True)
                frames.append(np.concatenate((bands, features['waveform'], features['voice_levels'],
                                               [features['energy'], features['loudness'], features['beat']])))
            if reference is None:
                reference = frames
            else:
                np.testing.assert_allclose(frames, reference, atol=1e-6)

    def test_quiet_passage_keeps_its_contrast_and_stereo(self):
        level = AudioLevel()
        loud = level.apply(self.song())
        # A five-second quiet break must stay substantially quieter.
        for _ in range(108):
            quiet = level.apply(self.song()*.1)
        ratio = np.sqrt(np.mean(quiet**2) / np.mean(loud**2))
        self.assertGreater(ratio, .09)
        self.assertLess(ratio, .12)
        np.testing.assert_allclose(quiet[:, 1], quiet[:, 0]*.7, atol=1e-8)

    def test_silence_does_not_raise_gain_or_make_motion(self):
        level = AudioLevel()
        level.apply(self.song())
        reference = level.reference
        for _ in range(100):
            result = level.apply(np.zeros((2048, 2)))
            self.assertFalse(np.any(result))
        self.assertEqual(level.reference, reference)
        _, features = AudioAnalysis().analyze(result, realtime=True)
        self.assertEqual(features['energy'], 0.)

    def test_lowered_volume_eventually_reestablishes_reference(self):
        level = AudioLevel()
        loud = level.apply(self.song())
        for _ in range(1600):
            quiet_playback = level.apply(self.song()*.1)
        np.testing.assert_allclose(quiet_playback, loud, atol=1e-8)

    def test_gain_is_bounded_and_input_is_not_modified(self):
        level = AudioLevel()
        samples = self.song()*.00002
        original = samples.copy()
        result = level.apply(samples)
        np.testing.assert_array_equal(samples, original)
        np.testing.assert_allclose(result, original*level.MAX_GAIN)
        self.assertEqual(level.apply(np.empty((0, 2))).shape, (0, 2))

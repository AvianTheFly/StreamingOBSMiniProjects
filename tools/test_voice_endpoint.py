"""Speech endpoint evidence without a microphone, model load or wall-clock sleeps."""
import unittest
from unittest.mock import Mock

import numpy as np
from voice.endpoint import SpeechActivity, at_model_rate


class SpeechActivityTests(unittest.TestCase):
    def detector(self, probabilities, rate=16000):
        model = Mock(side_effect=lambda audio: np.asarray(
            probabilities[:len(audio) // 512], dtype=np.float32))
        return SpeechActivity(model, rate, 100)

    def test_silence_and_isolated_click_do_not_establish_speech(self):
        for values in ([0] * 8, [.8, .1, .8, .1, .8, .1, .8, .1]):
            detector = self.detector(values)
            detector.feed(np.ones(4096, dtype=np.float32))
            self.assertFalse(detector.speech_detected)
            self.assertIsNone(detector.last_speech_at)

    def test_speech_onset_hysteresis_and_capture_time(self):
        detector = self.detector([.1, .7, .7, .7, .4, .4, .1, .1])
        detector.feed(np.ones(4096, dtype=np.float32))
        self.assertTrue(detector.speech_detected)
        self.assertAlmostEqual(detector.last_speech_at, 100 + 4096 / 16000 - .064)
        last = detector.last_speech_at
        detector.model.side_effect = lambda audio: np.zeros(len(audio) // 512)
        detector.feed(np.zeros(4096, dtype=np.float32))
        self.assertEqual(detector.last_speech_at, last)

    def test_only_new_frames_extend_speech_and_context_stays_bounded(self):
        detector = self.detector([.9] * 8)
        detector.feed(np.ones(4096, dtype=np.float32))
        last = detector.last_speech_at
        detector.model.side_effect = lambda audio: np.r_[np.ones(len(audio) // 512 - 8), np.zeros(8)]
        for _ in range(50):
            detector.feed(np.zeros(4096, dtype=np.float32))
        self.assertEqual(detector.last_speech_at, last)
        self.assertEqual(len(detector.audio), detector.WINDOW)

    def test_model_mutation_does_not_corrupt_recording_context(self):
        detector = self.detector([0] * 8)
        def mutate(audio):
            audio[:] = 0
            return np.zeros(len(audio) // 512)
        detector.model.side_effect = mutate
        detector.feed(np.ones(4096, dtype=np.float32))
        self.assertTrue(np.all(detector.audio == 1))

    def test_native_rate_fallback_uses_correct_time_and_model_rate(self):
        detector = self.detector([.9] * 100, rate=48000)
        detector.feed(np.ones(12288, dtype=np.float32))
        self.assertEqual(len(detector.model.call_args.args[0]), 4096)
        self.assertAlmostEqual(detector.last_speech_at, 100.256)
        normalized = at_model_rate(np.zeros(48000, dtype=np.float32), 48000)
        self.assertEqual(len(normalized), 16000)

    def test_small_packets_do_not_run_detector_inference_each_callback(self):
        detector = self.detector([0] * 8)
        for _ in range(7):
            detector.feed(np.zeros(512, dtype=np.float32))
        detector.model.assert_not_called()
        detector.feed(np.zeros(512, dtype=np.float32))
        detector.model.assert_called_once()

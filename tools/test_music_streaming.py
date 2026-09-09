"""Offline resource-lifetime tests: no OBS, mic, real decoder or playback."""
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'mini projects'))
from specific_song.bass_detector import BassDetector


class StreamingTests(unittest.TestCase):
    def detector(self):
        detector = BassDetector(audio_file=Path('test.mp4'))
        detector._running = True
        detector._process_frame = Mock()
        return detector

    def test_small_reads_and_decoder_cleanup(self):
        detector = self.detector()
        decoder = Mock()
        decoder.stdout.read.side_effect = [np.zeros(detector.block_size, dtype='<f4').tobytes(), b'']
        decoder.poll.return_value = None
        with patch('specific_song.bass_detector.subprocess.Popen', return_value=decoder) as launch, \
             patch('specific_song.bass_detector.time.sleep') as pacing:
            detector._stream_file_loop()
        self.assertEqual(decoder.stdout.read.call_args.args, (detector.block_size * 4,))
        detector._process_frame.assert_called_once()
        pacing.assert_called_once()
        decoder.terminate.assert_called_once()
        decoder.stdout.close.assert_called_once()
        self.assertIsNone(detector._decoder)
        self.assertIn('-re', launch.call_args.args[0])

    def test_cancel_before_worker_does_not_launch_decoder(self):
        detector = self.detector(); detector._running = False
        with patch('specific_song.bass_detector.subprocess.Popen') as launch:
            detector._stream_file_loop()
        launch.assert_not_called()

    def test_stop_interrupts_blocked_decoder(self):
        detector = self.detector(); decoder = Mock(); decoder.poll.return_value = None
        detector._decoder = decoder
        detector.stop()
        decoder.terminate.assert_called_once()
        self.assertFalse(detector._running)

    def test_start_never_preloads_song(self):
        detector = self.detector(); detector._running = False
        with patch.object(detector, 'preload') as preload, \
             patch('specific_song.bass_detector.threading.Thread') as thread:
            detector.start()
        preload.assert_not_called()
        thread.return_value.start.assert_called_once()


if __name__ == '__main__': unittest.main()

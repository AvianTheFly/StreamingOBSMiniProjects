"""Offline safety regressions: no OBS, microphone or GPU workload required."""
import json
import subprocess
import sys
import threading
import unittest
from unittest.mock import Mock, patch

import numpy as np

from lib.performance_monitor import Collector, parse_gpu_csv
from voice import listener


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.was_ready = listener._ready_event.is_set()
        listener._ready_event.set()
        listener._transcription_busy = False
        listener._recording = False
        listener._buffer.clear()

    def tearDown(self):
        listener._transcription_busy = False
        listener._recording = False
        listener._buffer.clear()
        if not self.was_ready:
            listener._ready_event.clear()

    def test_no_second_recording_until_lazy_transcription_and_callback_finish(self):
        entered, release = threading.Event(), threading.Event()
        def transcribe(*args):
            entered.set()
            release.wait(3)
        listener._recording = True
        listener._recording_owner = 'test'
        listener._buffer.append(np.zeros(512))
        with patch.object(listener, '_transcribe_and_send', side_effect=transcribe):
            listener.stop_and_transcribe(lambda text: None, 'test')
            try:
                self.assertTrue(entered.wait(1))
                self.assertFalse(listener.start_recording('other'))
            finally:
                release.set()
                for t in threading.enumerate():
                    if t.name == 'voice-transcribe':
                        t.join(2)
        self.assertFalse(listener._transcription_busy)
        self.assertTrue(listener.start_recording('other'))

    def test_failed_thread_start_releases_busy_flag(self):
        listener._recording = True
        listener._recording_owner = 'test'
        listener._buffer.append(np.zeros(512))
        with patch.object(listener.threading.Thread, 'start', side_effect=RuntimeError('no thread')):
            with self.assertRaises(RuntimeError):
                listener.stop_and_transcribe(lambda text: None, 'test')
        self.assertFalse(listener._transcription_busy)

    def test_failed_transcription_releases_busy_flag(self):
        listener._recording = True
        listener._recording_owner = 'test'
        listener._buffer.append(np.zeros(512))
        # Run the thread body synchronously so the error is deterministic.
        def thread(**kwargs):
            return Mock(start=kwargs['target'])
        with patch.object(listener.threading, 'Thread', side_effect=thread), \
             patch.object(listener, '_transcribe_and_send', side_effect=ValueError('decoder failed')):
            with self.assertRaises(ValueError):
                listener.stop_and_transcribe(lambda text: None, 'test')
        self.assertFalse(listener._transcription_busy)

    def test_wrong_owner_does_not_interrupt_recording_or_start_inference(self):
        listener._recording = True
        listener._recording_owner = 'first'
        listener._buffer.append(np.zeros(512))
        with patch.object(listener.threading, 'Thread') as thread:
            listener.stop_and_transcribe(lambda text: None, 'second')
        thread.assert_not_called()
        self.assertTrue(listener._recording)
        self.assertFalse(listener._transcription_busy)

    def test_parent_pipe_eof_ends_worker_without_any_keypress(self):
        code = ('from lib.keyboard_worker import watch_parent; import sys; '
                'print("ready",flush=True); watch_parent(sys.stdin)')
        p = subprocess.Popen([sys.executable, '-c', code], stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, text=True,
                             creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        try:
            self.assertEqual(p.stdout.readline().strip(), 'ready')
            self.assertIsNone(p.poll())
            p.stdin.close()
            self.assertEqual(p.wait(timeout=3), 0)
        finally:
            if p.poll() is None:
                p.kill()
                p.wait()
            p.stdout.close()

    def test_gpu_unavailable_values_and_multiple_adapters(self):
        rows = parse_gpu_csv('0, 35, 10, 4000, 11264, 55, 150, 300, 1800, 7000\n'
                             '1, [N/A], 0, 100, 8192, 30, [N/A], 200, 200, 400\n')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['memory.used'], '4000')
        self.assertEqual(rows[1]['utilization.gpu'], '[N/A]')

    def test_obs_failure_still_records_gpu_and_closes_bad_connection(self):
        collector = Collector()
        collector.smi = 'nvidia-smi'
        client = Mock()
        client.get_stats.side_effect = TimeoutError
        collector.client = client
        with patch('lib.performance_monitor.subprocess.run', return_value=Mock(
                returncode=0, stdout='0, 99, 10, 4000, 11264, 55, 150, 300, 1800, 7000')):
            data = collector.sample()
        self.assertEqual(data['gpu'][0]['utilization.gpu'], '99')
        self.assertEqual(data['obs_error'], 'TimeoutError')
        self.assertIsNone(collector.client)
        client.disconnect.assert_called_once()
        json.dumps(data)


if __name__ == '__main__':
    unittest.main()

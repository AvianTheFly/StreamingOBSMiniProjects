"""Offline safety regressions: no OBS, microphone or GPU workload required."""
import json
import subprocess
import sys
import threading
import unittest
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np

from lib.performance_monitor import Collector, parse_gpu_csv
from shared import VoicePTT
from voice import listener
from voice.service import VoiceService


class AuditTests(unittest.TestCase):
    def test_league_metrics_reuse_cpu_counters_without_reading_launch_tokens(self):
        import psutil
        process = Mock(pid=123, info={'pid': 123, 'name': 'League of Legends.exe'})
        process.oneshot.side_effect = lambda: nullcontext()
        process.cpu_percent.side_effect = [0, 240, 125]
        process.memory_info.return_value.rss = 20 * 1048576
        process.num_threads.return_value = 12
        process.cmdline.side_effect = AssertionError('Never inspect auth-bearing command lines')
        unrelated = Mock(pid=456, info={'pid': 456, 'name': 'unrelated.exe'})
        module = SimpleNamespace(process_iter=Mock(return_value=[process, unrelated]),
                                 NoSuchProcess=psutil.NoSuchProcess, AccessDenied=psutil.AccessDenied)
        collector = Collector()
        with patch('lib.performance_monitor.time.monotonic', side_effect=[100, 101, 106]):
            first = collector._sample_league(module)
            second = collector._sample_league(module)
            third = collector._sample_league(module)
        self.assertIsNone(first[0]['cpu_percent'])
        self.assertEqual(second[0]['cpu_percent'], 240)
        self.assertEqual(third[0]['cpu_percent'], 125)
        self.assertEqual(second[0]['rss_mb'], 20)
        self.assertEqual(module.process_iter.call_count, 2)
        module.process_iter.assert_called_with(['pid', 'name'])
        unrelated.cpu_percent.assert_not_called()
        process.cmdline.assert_not_called()

    def test_league_exit_does_not_leave_stale_process_metrics(self):
        import psutil
        process = Mock(pid=123, info={'pid': 123, 'name': 'League of Legends.exe'})
        process.oneshot.side_effect = lambda: nullcontext()
        process.memory_info.side_effect = psutil.NoSuchProcess(123)
        module = SimpleNamespace(process_iter=Mock(return_value=[process]),
                                 NoSuchProcess=psutil.NoSuchProcess, AccessDenied=psutil.AccessDenied)
        collector = Collector()
        with patch('lib.performance_monitor.time.monotonic', return_value=100):
            self.assertEqual(collector._sample_league(module), [])
        self.assertEqual(collector._league_processes, {})

    def test_metrics_follow_the_obs_control_listener_after_obs_reopens(self):
        from lib.performance_monitor import find_obs_process
        from types import SimpleNamespace
        processes = Mock()
        processes.CONN_LISTEN = 'LISTEN'
        processes.net_connections.return_value = [SimpleNamespace(
            status='LISTEN', laddr=SimpleNamespace(port=4455), pid=26392)]
        processes.Process.return_value.name.return_value = 'obs64.exe'
        actual = find_obs_process(processes, 4455)
        self.assertIs(actual, processes.Process.return_value)
        processes.Process.assert_called_once_with(26392)
        processes.process_iter.assert_not_called()

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
        error, complete = Mock(), Mock()
        with patch.object(listener.threading, 'Thread', side_effect=thread), \
             patch.object(listener, '_transcribe_and_send', side_effect=ValueError('decoder failed')):
            listener.stop_and_transcribe(lambda text: None, 'test',
                                        on_error=error, on_complete=complete)
        self.assertFalse(listener._transcription_busy)
        error.assert_called_once_with('decoder failed')
        complete.assert_called_once()

    def test_wrong_owner_does_not_interrupt_recording_or_start_inference(self):
        listener._recording = True
        listener._recording_owner = 'first'
        listener._buffer.append(np.zeros(512))
        with patch.object(listener.threading, 'Thread') as thread:
            listener.stop_and_transcribe(lambda text: None, 'second')
        thread.assert_not_called()
        self.assertTrue(listener._recording)
        self.assertFalse(listener._transcription_busy)

    def test_cancel_discards_audio_without_inference(self):
        listener._recording = True
        listener._recording_owner = 'instant_replay'
        listener._buffer.append(np.zeros(512))
        with patch.object(listener, '_transcribe_and_send') as transcribe:
            self.assertFalse(listener.cancel_recording('specific_song'))
            self.assertTrue(listener._recording)
            self.assertTrue(listener.cancel_recording('instant_replay'))
        self.assertFalse(listener._recording)
        self.assertEqual(listener._buffer, [])
        transcribe.assert_not_called()

    def test_silent_transcription_completes_ptt_state(self):
        callback = Mock()
        ptt = VoicePTT(timeout=2, on_transcript=callback, tag='instant_replay',
                       voice_service=VoiceService(listener))
        self.assertTrue(ptt.begin())
        listener._buffer.append(np.zeros(512))
        with patch.object(listener, '_transcribe_and_send', return_value=None):
            ptt._do_stop()
            for thread in threading.enumerate():
                if thread.name == 'voice-transcribe':
                    thread.join(2)
        self.assertEqual(ptt.state, 'idle')
        callback.assert_not_called()

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
        rows = parse_gpu_csv('0, 35, 10, 4000, 11264, 55, 150, 300, 1800, 7000, 39, 0\n'
                             '1, [N/A], 0, 100, 8192, 30, [N/A], 200, 200, 400, [N/A], 0\n')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['memory.used'], '4000')
        self.assertEqual(rows[1]['utilization.gpu'], '[N/A]')
        self.assertEqual(rows[0]['utilization.encoder'], '39')
        self.assertEqual(rows[0]['utilization.decoder'], '0')

    def test_performance_log_excludes_voice_transcripts_and_consumer_errors(self):
        collector = Collector()
        collector.smi = None
        collector.client = Mock()
        diagnostics = {'ready': True, 'device': 'cpu', 'state': 'idle',
                       'history': [{'text': 'private phrase'}],
                       'last_rejection': {'error': 'private phrase'},
                       'startup_error': 'private device details', 'consumers': []}
        with patch('voice.service.service.diagnostics', return_value=diagnostics) as get:
            sample = collector.sample()
        get.assert_called_once_with(include_details=False)
        self.assertTrue(sample['voice']['ready'])
        self.assertNotIn('private', json.dumps(sample['voice']))
        collector.close()

    def test_performance_thread_start_failure_closes_log_file(self):
        from lib import performance_monitor
        with patch.object(performance_monitor, 'RotatingFileHandler') as handler, \
             patch.object(performance_monitor.threading, 'Thread') as thread:
            thread.return_value.start.side_effect = RuntimeError('no thread')
            with self.assertRaises(RuntimeError):
                performance_monitor.start_performance_monitor(threading.Event())
        handler.return_value.close.assert_called_once()

    def test_obs_failure_still_records_gpu_and_closes_bad_connection(self):
        collector = Collector()
        collector.smi = 'nvidia-smi'
        client = Mock()
        client.get_stats.side_effect = TimeoutError
        collector.client = client
        with patch('lib.performance_monitor.subprocess.run', return_value=Mock(
                returncode=0, stdout='0, 99, 10, 4000, 11264, 55, 150, 300, 1800, 7000, 39, 0')):
            data = collector.sample()
        self.assertEqual(data['gpu'][0]['utilization.gpu'], '99')
        self.assertEqual(data['obs_error'], 'TimeoutError')
        self.assertIsNone(collector.client)
        client.disconnect.assert_called_once()
        json.dumps(data)


if __name__ == '__main__':
    unittest.main()

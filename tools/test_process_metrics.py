"""CPU attribution, process churn and diagnostic pacing without live workloads."""
from contextlib import nullcontext
from types import SimpleNamespace
import threading
import unittest
from unittest.mock import Mock, patch

import psutil
from lib.process_metrics import ProcessMetrics
from lib import performance_monitor


class ProcessMetricsTests(unittest.TestCase):
    def process(self, pid, name='python.exe', created=10):
        process = Mock(pid=pid, info=dict(name=name, ppid=7, create_time=created))
        process.oneshot.side_effect = nullcontext
        process.memory_info.return_value.rss = 20 * 1048576
        process.num_threads.return_value = 3
        process.cpu_percent.side_effect = [0, 160, 80]
        process.cmdline.side_effect = AssertionError('No command line inspection')
        return process

    def module(self, processes):
        return SimpleNamespace(process_iter=Mock(return_value=processes),
            cpu_count=lambda: 16, NoSuchProcess=psutil.NoSuchProcess, AccessDenied=psutil.AccessDenied)

    def test_counts_other_python_and_ffmpeg_with_machine_percentage(self):
        now = [0]
        python, ffmpeg, unrelated = self.process(101), self.process(102, 'ffmpeg.exe'), self.process(103, 'riot.exe')
        module = self.module([python, ffmpeg, unrelated])
        sampler = ProcessMetrics(clock=lambda: now[0])
        first = sampler.sample(module)
        self.assertTrue(all(row['cpu_percent'] is None for row in first))
        now[0] = 1
        second = sampler.sample(module)
        self.assertEqual({row['pid'] for row in second}, {101, 102})
        self.assertTrue(all(row['machine_cpu_percent'] == 10 for row in second))
        self.assertTrue(all(row['cpu_percent'] == 160 for row in second))
        module.process_iter.assert_called_once_with(['pid', 'name', 'ppid', 'create_time'])
        python.cmdline.assert_not_called()
        ffmpeg.cmdline.assert_not_called()
        unrelated.cpu_percent.assert_not_called()

    def test_reuses_counters_on_scans_but_primes_a_reused_pid(self):
        now = [0]
        old, new = self.process(101), self.process(101, created=20)
        module = self.module([old])
        sampler = ProcessMetrics(clock=lambda: now[0])
        sampler.sample(module)
        now[0] = 5
        self.assertEqual(sampler.sample(module)[0]['cpu_percent'], 160)
        module.process_iter.return_value = [new]
        now[0] = 10
        row = sampler.sample(module)[0]
        self.assertIsNone(row['cpu_percent'])
        self.assertEqual(row['create_time'], 20)

    def test_exit_and_access_denial_do_not_break_other_metrics(self):
        denied, exited, good = self.process(101), self.process(102), self.process(103)
        denied.cpu_percent.side_effect = psutil.AccessDenied(101)
        exited.memory_info.side_effect = psutil.NoSuchProcess(102)
        sampler = ProcessMetrics()
        rows = sampler.sample(self.module([denied, exited, good]))
        self.assertEqual([row['pid'] for row in rows], [103])
        self.assertEqual(len(sampler._tracked), 1)


class DiagnosticPacingTests(unittest.TestCase):
    def test_repeated_markers_cannot_sample_faster_than_half_a_second(self):
        now = [0.0]
        wake = Mock()
        # Simulate a marker every 20ms while waiting, rather than real sleeps.
        def marked(timeout):
            now[0] += min(.02, timeout)
            return True
        wake.wait.side_effect = marked
        with patch.object(performance_monitor, '_sample_requested', wake), \
             patch.object(performance_monitor, '_burst_until', 10), \
             patch.object(performance_monitor.time, 'monotonic', side_effect=lambda: now[0]):
            performance_monitor._wait_for_sample(threading.Event(), sampled_at=0)
        self.assertAlmostEqual(now[0], .5)

    def test_marker_wakes_idle_sample_and_shutdown_remains_responsive(self):
        now = [0.0]
        stop, wake = threading.Event(), Mock()
        def wait(timeout):
            now[0] += timeout
            return now[0] == .25
        wake.wait.side_effect = wait
        with patch.object(performance_monitor, '_sample_requested', wake), \
             patch.object(performance_monitor, '_burst_until', 0), \
             patch.object(performance_monitor.time, 'monotonic', side_effect=lambda: now[0]):
            performance_monitor._wait_for_sample(stop, sampled_at=0)
        self.assertEqual(now[0], .5)
        stop.set()
        with patch.object(performance_monitor, '_sample_requested', wake):
            wake.reset_mock()
            performance_monitor._wait_for_sample(stop)
        wake.wait.assert_not_called()


if __name__ == '__main__':
    unittest.main()

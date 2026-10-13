"""CPU attribution, process churn and diagnostic pacing without live workloads."""
from contextlib import nullcontext
from types import SimpleNamespace
import threading
import unittest
from unittest.mock import Mock, patch

import psutil
from lib.process_metrics import ProcessMetrics
from lib.process_inventory import ProcessEntry
from lib import performance_monitor


class ProcessMetricsTests(unittest.TestCase):
    def process(self, pid, name='python.exe', created=10):
        process = Mock(pid=pid, info=dict(name=name, ppid=7, create_time=created))
        process.oneshot.side_effect = nullcontext
        process.create_time.return_value = created
        process.memory_info.return_value.rss = 20 * 1048576
        process.num_threads.return_value = 3
        process.cpu_percent.side_effect = [0, 160, 80]
        process.cmdline.side_effect = AssertionError('No command line inspection')
        return process

    def module(self, processes):
        return SimpleNamespace(snapshot=Mock(return_value=[ProcessEntry(p.pid,p.info['name'],p.info['ppid'],3) for p in processes]),
            Process=Mock(side_effect=lambda pid: next(p for p in processes if p.pid==pid)),
            cpu_count=lambda: 16, NoSuchProcess=psutil.NoSuchProcess, AccessDenied=psutil.AccessDenied)

    def test_counts_other_python_and_ffmpeg_with_machine_percentage(self):
        now = [0]
        python, ffmpeg, unrelated = self.process(101), self.process(102, 'ffmpeg.exe'), self.process(103, 'riot.exe')
        module = self.module([python, ffmpeg, unrelated])
        sampler = ProcessMetrics(clock=lambda: now[0], snapshot=module.snapshot)
        first = sampler.sample(module)
        self.assertTrue(all(row['cpu_percent'] is None for row in first))
        now[0] = 1
        second = sampler.sample(module)
        self.assertEqual({row['pid'] for row in second}, {101, 102})
        self.assertTrue(all(row['machine_cpu_percent'] == 10 for row in second))
        self.assertTrue(all(row['cpu_percent'] == 160 for row in second))
        module.snapshot.assert_called_once_with()
        self.assertNotIn(103, [call.args[0] for call in module.Process.call_args_list])
        python.cmdline.assert_not_called()
        ffmpeg.cmdline.assert_not_called()
        unrelated.cpu_percent.assert_not_called()

    def test_reuses_counters_on_scans_but_primes_a_reused_pid(self):
        now = [0]
        old, new = self.process(101), self.process(101, created=20)
        module = self.module([old])
        sampler = ProcessMetrics(clock=lambda: now[0], snapshot=module.snapshot)
        sampler.sample(module)
        now[0] = 5
        self.assertEqual(sampler.sample(module)[0]['cpu_percent'], 160)
        module.Process.side_effect = lambda pid: new
        module.snapshot.return_value = [ProcessEntry(new.pid,new.info['name'],7,3)]
        now[0] = 10
        row = sampler.sample(module)[0]
        self.assertIsNone(row['cpu_percent'])
        self.assertEqual(row['create_time'], 20)

    def test_obs_browser_and_mux_costs_are_visible_without_command_line_access(self):
        processes = [self.process(201, 'obs-browser-page.exe'), self.process(202, 'obs-ffmpeg-mux.exe')]
        module = self.module(processes)
        sampler = ProcessMetrics(snapshot=module.snapshot)
        sampler.sample(module)
        rows = sampler.sample(module)
        self.assertEqual({row['name'] for row in rows}, {'obs-browser-page.exe', 'obs-ffmpeg-mux.exe'})
        self.assertTrue(all(row['machine_cpu_percent'] == 10 for row in rows))
        for process in processes:
            process.cmdline.assert_not_called()

    def test_exit_and_access_denial_do_not_break_other_metrics(self):
        denied, exited, good = self.process(101), self.process(102), self.process(103)
        denied.cpu_percent.side_effect = psutil.AccessDenied(101)
        exited.memory_info.side_effect = psutil.NoSuchProcess(102)
        module = self.module([denied, exited, good])
        sampler = ProcessMetrics(snapshot=module.snapshot)
        rows = sampler.sample(module)
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

"""Optional preparation yields under pressure without blocking live media."""
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from lib.cpu_headroom import CpuHeadroom
from lib.asset_preparation import AssetPreparation
from lib.shared_media import media_startup


class FakeStop:
    def __init__(self, stop_at=None):
        self.now = 0.0
        self.stop_at = stop_at
        self.waits = []

    def is_set(self):
        return self.stop_at is not None and self.now >= self.stop_at

    def wait(self, seconds):
        self.waits.append(seconds)
        self.now += seconds
        return self.is_set()


class CpuHeadroomTests(unittest.TestCase):
    def test_pressure_hysteresis_and_cached_admission_without_busy_polling(self):
        stop = FakeStop()
        sample = Mock(side_effect=[0, 90, 60, 54])
        gate = CpuHeadroom(sample=sample, clock=lambda: stop.now)
        self.assertTrue(gate.wait(stop))
        self.assertEqual(sample.call_count, 4)
        self.assertEqual(stop.now, 2.25)
        self.assertFalse(gate.waiting)
        self.assertTrue(gate.wait(stop))
        self.assertEqual(sample.call_count, 4, 'admitted chunks reuse the one-second sample')
        self.assertTrue(all(0 < seconds <= .25 for seconds in stop.waits))

    def test_shutdown_during_high_load_is_bounded(self):
        stop = FakeStop(stop_at=.75)
        gate = CpuHeadroom(sample=lambda: 100, clock=lambda: stop.now)
        self.assertFalse(gate.wait(stop))
        self.assertEqual(stop.now, .75)
        self.assertTrue(gate.waiting)

    def test_missing_monitoring_falls_back_to_normal_paced_work(self):
        stop = FakeStop()
        gate = CpuHeadroom(sample=Mock(side_effect=OSError('unavailable')), clock=lambda: stop.now)
        self.assertTrue(gate.wait(stop))
        self.assertEqual(stop.now, .25)

    def test_stopped_gate_does_not_sample(self):
        stop = FakeStop(stop_at=0)
        sample = Mock()
        self.assertFalse(CpuHeadroom(sample=sample).wait(stop))
        sample.assert_not_called()

    def test_preparation_waits_outside_decoder_slot_and_stops_without_probe(self):
        stop, entered = threading.Event(), threading.Event()
        class Busy:
            waiting = True
            def wait(self, stop_event):
                entered.set()
                stop_event.wait(2)
                return False
        with tempfile.TemporaryDirectory() as folder, \
             patch('lib.asset_preparation.probe_media') as probe:
            path = Path(folder) / 'clip.mp4'
            path.write_bytes(b'unchanged')
            preparer = AssetPreparation(budget_bytes=100, headroom=Busy())
            preparer.register([path])
            worker = preparer.start(stop)
            try:
                self.assertTrue(entered.wait(2))
                self.assertTrue(preparer.status()['waiting_for_cpu'])
                acquired = media_startup._load_lock.acquire(blocking=False)
                self.assertTrue(acquired, 'optional work must not hold foreground decoder admission')
                if acquired:
                    media_startup._load_lock.release()
            finally:
                stop.set()
                worker.join(2)
            self.assertFalse(worker.is_alive())
            probe.assert_not_called()
            self.assertEqual(preparer._warmed, 0)
            self.assertEqual(path.read_bytes(), b'unchanged')


if __name__ == '__main__':
    unittest.main()

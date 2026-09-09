"""Verify bounded startup concurrency without launching OBS or media."""
import threading
import unittest
from unittest.mock import Mock, patch
from lib.shared_media import media_startup as startup


class StartupTests(unittest.TestCase):
    def test_other_source_waits_until_first_clock_advances(self):
        first_entered, release, second_entered = (threading.Event() for _ in range(3))
        errors = []
        positions = {}
        def status(source):
            positions[source] = positions.get(source, 0) + 40
            return {'state': 'OBS_MEDIA_STATE_PLAYING', 'cursor_ms': positions[source]}
        def play(source, entered):
            try:
                with startup.media_startup(source):
                    entered.set()
                    if source == 'music':
                        if not release.wait(2):
                            raise RuntimeError('test did not release loading source')
            except Exception as exc:
                errors.append(exc)
        with patch.object(startup.obs, 'get_media_status', side_effect=status), \
             patch.object(startup.obs, 'stop_media'):
            a = threading.Thread(target=play, args=('music', first_entered))
            b = threading.Thread(target=play, args=('effect', second_entered))
            a.start()
            self.assertTrue(first_entered.wait(2))
            b.start()
            try:
                self.assertFalse(second_entered.wait(.1))
            finally:
                release.set()
                a.join(3); b.join(3)
            self.assertTrue(second_entered.is_set())
            self.assertFalse(a.is_alive() or b.is_alive())
            self.assertEqual(errors, [])

    def test_cancelled_waiter_never_runs_setup(self):
        cancelled = threading.Event()
        setup = Mock()
        errors = []
        def waiter():
            try:
                with startup.media_startup('effect', cancelled=cancelled.is_set):
                    setup()
            except startup.MediaStartupCancelled:
                errors.append('cancelled')
        with startup._load_lock:
            thread = threading.Thread(target=waiter)
            thread.start()
            cancelled.set()
            thread.join(2)
        setup.assert_not_called()
        self.assertEqual(errors, ['cancelled'])

    def test_stalled_clock_stops_source_and_releases_gate(self):
        now = [0.0]
        def sleep(seconds):
            now[0] += seconds
        with patch.object(startup.obs, 'get_media_status', return_value={'state': 'OBS_MEDIA_STATE_PLAYING', 'cursor_ms': 0}), \
             patch.object(startup.obs, 'stop_media') as stop, \
             patch.object(startup.time, 'monotonic', side_effect=lambda: now[0]), \
             patch.object(startup.time, 'sleep', side_effect=sleep):
            with self.assertRaises(TimeoutError):
                with startup.media_startup('stuck', timeout=1):
                    pass
        stop.assert_called_once_with('stuck')
        self.assertTrue(startup._load_lock.acquire(blocking=False))
        startup._load_lock.release()

    def test_intentional_pause_is_not_a_failed_decoder(self):
        with patch.object(startup.obs, 'get_media_status', return_value={'state': 'OBS_MEDIA_STATE_PAUSED', 'cursor_ms': 0}), \
             patch.object(startup.obs, 'stop_media') as stop:
            with startup.media_startup('music'):
                pass
        stop.assert_not_called()


if __name__ == '__main__':
    unittest.main()

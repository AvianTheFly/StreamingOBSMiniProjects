"""Shared manual/voice trigger workflow, without global keyboard hooks."""
import threading
import unittest
from unittest.mock import patch

from lib.shared_media.trigger_window import ManualTriggerWindow


class TriggerWindowTests(unittest.TestCase):
    def test_manual_key_wins_once_and_suppresses_one_voice_result(self):
        window = ManualTriggerWindow(threading.Event())
        with patch('lib.shared_media.trigger_window.threading.Timer') as timer:
            window.open(1)
            self.assertFalse(window.claim('x', {'@': 'hooray'}))
            self.assertTrue(window.claim('@', {'@': 'hooray'}))
            self.assertFalse(window.claim('@', {'@': 'hooray'}))
            timer.return_value.cancel.assert_called_once()
            self.assertTrue(window.consume_suppression())
            self.assertFalse(window.consume_suppression())

    def test_window_expiry_leaves_voice_result_available(self):
        window = ManualTriggerWindow(threading.Event())
        with patch('lib.shared_media.trigger_window.threading.Timer') as timer:
            window.open(1)
            timer.call_args.args[1]()
            self.assertFalse(window.claim('@', {'@': 'hooray'}))
            self.assertFalse(window.consume_suppression())

    def test_close_releases_the_window_timer(self):
        window = ManualTriggerWindow(threading.Event())
        with patch('lib.shared_media.trigger_window.threading.Timer') as timer:
            window.open(1)
            window.close()
            timer.return_value.cancel.assert_called_once()
            self.assertFalse(window.claim('@', {'@': 'hooray'}))


if __name__ == '__main__':
    unittest.main()

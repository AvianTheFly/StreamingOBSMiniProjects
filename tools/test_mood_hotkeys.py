"""Keyboard selection must be armed, finite and independent of playback."""
import queue
import tempfile
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from love_me.hotkeys import MoodHotkeys
from love_me.settings import VariationStore
from love_me import main


class MoodHotkeyTests(unittest.TestCase):
    def setUp(self):
        self.stop = threading.Event()
        self.now = 100.0
        self.keys = MoodHotkeys(self.stop, clock=lambda: self.now)
        self.rows = [{'id':'signal_found','hotkey':'2'}, {'id':'golden','hotkey':'abc'}]
        self.keys.reload(self.rows)

    def type(self, text):
        return [self.keys.press(key) for key in text]

    def test_opener_only_arms_and_one_choice_consumes_window(self):
        self.assertEqual(self.type('12abc'), [None]*5)
        self.assertEqual(self.type('987'), [None]*3)
        self.assertTrue(self.keys.snapshot()['listening'])
        self.assertEqual(self.keys.press('1'), 'original')
        self.assertFalse(self.keys.snapshot()['listening'])
        self.assertIsNone(self.keys.press('2'))
        self.type('987')
        self.assertEqual(self.keys.press('2'), 'signal_found')

    def test_same_cue_can_be_selected_again_after_rearming(self):
        for _ in range(2):
            self.type('987')
            self.assertEqual(self.keys.press('2'), 'signal_found')

    def test_sequence_timing_still_applies_to_opener(self):
        with patch('lib.key_sequences.time.time', side_effect=[0, .1, .4]):
            self.assertEqual(self.type('987'), [None]*3)
        self.assertFalse(self.keys.snapshot()['listening'])

    def test_expiry_escape_stop_and_reload_reject_old_selection(self):
        self.type('987')
        self.now += 5
        self.assertFalse(self.keys.snapshot()['listening'])
        self.assertIsNone(self.keys.press('1'))
        self.type('987')
        self.keys.press('esc')
        self.assertIsNone(self.keys.press('2'))
        self.type('987')
        self.keys.reload([{'id':'golden','hotkey':'2'}])
        self.assertIsNone(self.keys.press('2'))
        self.type('987')
        self.assertEqual(self.keys.press('2'), 'golden')
        self.type('987')
        self.stop.set()
        self.assertIsNone(self.keys.press('1'))
        self.assertFalse(self.keys.open())

    def test_reopening_and_timeout_reset_partial_variation_sequences(self):
        self.type('987a987')
        self.assertEqual(self.type('bc'), [None, None])
        self.assertEqual(self.type('abc')[-1], 'golden')
        self.type('987a')
        self.now += 5
        self.type('987')
        self.assertEqual(self.type('bc'), [None, None])

    def test_runtime_keyboard_and_command_opener_use_existing_service(self):
        from love_me.interface import _live
        ready = threading.Event()
        inbox = queue.Queue()
        called = threading.Event()
        service = Mock(trigger=Mock(side_effect=lambda identity: called.set()))
        try:
            with tempfile.TemporaryDirectory() as folder, \
                 patch.object(main, 'SequentialPlayer'), \
                 patch.object(main, 'VariationStore', return_value=VariationStore(folder)), \
                 patch.object(main, 'MoodService', return_value=service), \
                 patch.object(main, 'register'), patch.object(main, 'unregister'), \
                 patch.object(main, 'browser_files', return_value={}), \
                 patch.object(main, 'subscribe_global_hotkeys') as subscribe, \
                 patch.object(main, 'unsubscribe_global_hotkeys') as unsubscribe:
                worker = threading.Thread(target=main.run, args=(inbox,self.stop), kwargs={'startup_event':ready})
                worker.start()
                try:
                    self.assertTrue(ready.wait(2))
                    press = subscribe.call_args.args[0]
                    for char in '987': press(SimpleNamespace(char=char))
                    service.trigger.assert_not_called()
                    press(SimpleNamespace(char='1'))
                    self.assertTrue(called.wait(2))
                    service.trigger.assert_called_once_with('original')
                    called.clear()
                    # Queue command 987 has the same arm-only meaning.
                    marker = threading.Event()
                    open_window = _live['hotkeys'].open
                    def opened():
                        result = open_window()
                        marker.set()
                        return result
                    with patch.object(_live['hotkeys'], 'open', side_effect=opened):
                        inbox.put('987')
                        self.assertTrue(marker.wait(2))
                    self.assertEqual(service.trigger.call_count, 1)
                    press(SimpleNamespace(char='2'))
                    self.assertTrue(called.wait(2))
                    self.assertEqual(service.trigger.call_args.args, ('signal_found',))
                finally:
                    self.stop.set();worker.join(2)
                self.assertFalse(worker.is_alive())
                unsubscribe.assert_called_once()
                service.close.assert_called_once()
                self.assertFalse(_live)
        finally:
            _live.clear()


if __name__ == '__main__':
    unittest.main()

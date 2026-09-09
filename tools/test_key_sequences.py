"""Offline sequence matching checks; never install keyboard hooks."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.key_sequences import SequenceTrigger
import shared


class KeySequenceTests(unittest.TestCase):
    def feed(self, trigger, keys, times):
        with patch('lib.key_sequences.time.time', side_effect=times):
            return [trigger.register_key(key) for key in keys]

    def test_existing_import_is_same_class(self):
        self.assertIs(shared.SequenceTrigger, SequenceTrigger)

    def test_completed_sequence_fires_once_and_resets(self):
        trigger = SequenceTrigger(['i', 'l', 'i'], .6)
        self.assertEqual(self.feed(trigger, 'iliili', [0, .1, .2, .3, .4, .5]),
                         [False, False, True, False, False, True])

    def test_timeout_then_new_sequence_recovers(self):
        trigger = SequenceTrigger(['/', '*'], .6)
        self.assertEqual(self.feed(trigger, ['/', '*', '/', '*'], [0, 1, 2, 2.2]),
                         [False, False, False, True])

    def test_shifted_tail_is_allowed_but_first_key_is_exact(self):
        trigger = SequenceTrigger(['/', '*'], .6)
        self.assertEqual(self.feed(trigger, ['?', '8', '/', '8'], [0, .1, .2, .3]),
                         [False, False, False, True])
        strict = SequenceTrigger(['/', '*'], .6, shift_agnostic_tail=False)
        self.assertEqual(self.feed(strict, ['/', '8', '/', '*'], [0, .1, .2, .3]),
                         [False, False, False, True])

    def test_unrelated_keys_roll_out_of_buffer(self):
        trigger = SequenceTrigger(['a', 'b'], .6)
        self.assertEqual(self.feed(trigger, 'xab', [0, .1, .2]), [False, False, True])


if __name__ == '__main__':
    unittest.main()

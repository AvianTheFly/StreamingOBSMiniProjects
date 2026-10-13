"""Bounded accent lifetime and subscription ownership."""
import unittest
import events
from lib.paths import ensure_import_paths
ensure_import_paths()
from league_api.production.stance_accent import StanceAccent


class AccentTests(unittest.TestCase):
    def test_one_latest_cue_expires_and_blocked_state_cannot_replay(self):
        now = [10.]
        accent = StanceAccent(lambda: now[0])
        accent.start()
        try:
            for key in 'qwer'*100:
                events.emit('league.udyr_stance', key=key)
            self.assertEqual(accent.snapshot(True)['key'], 'r')
            self.assertEqual(accent.snapshot(True)['id'], 400)
            self.assertIsNone(accent.snapshot(False))
            self.assertIsNone(accent.snapshot(True))
            events.emit('league.udyr_stance', key='w')
            now[0] += 1.21
            self.assertIsNone(accent.snapshot(True))
        finally:
            accent.close()
        events.emit('league.udyr_stance', key='q')
        self.assertIsNone(accent.snapshot(True))

    def test_start_is_idempotent_and_close_rejects_already_copied_callback(self):
        accent = StanceAccent()
        accent.start()
        accent.start()
        try:
            events.emit('league.udyr_stance', key='e')
            self.assertEqual(accent.snapshot(True)['id'], 1)
        finally:
            accent.close()
        accent.receive({'key': 'r'})
        self.assertIsNone(accent.snapshot(True))


if __name__ == '__main__':
    unittest.main()

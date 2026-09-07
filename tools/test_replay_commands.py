import sys
import unittest
from unittest.mock import patch, Mock
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay.main import _parse_command, wait_for_replay_start

class ReplayCommands(unittest.TestCase):
    def test_stale_ended_cursor_does_not_count_as_started(self):
        cancel = Mock()
        cancel.is_set.return_value = False
        cancel.wait.return_value = False
        samples = [
            {'state': 'OBS_MEDIA_STATE_ENDED', 'cursor_ms': 5000},
            {'state': 'OBS_MEDIA_STATE_PLAYING', 'cursor_ms': 0},
            {'state': 'OBS_MEDIA_STATE_PLAYING', 'cursor_ms': 100}]
        with patch('instant_replay.main.restart_media'), patch('instant_replay.main.obs.get_media_status', side_effect=samples) as status:
            self.assertTrue(wait_for_replay_start('replay', cancel))
        self.assertEqual(status.call_count, 3)

    def test_cancel_during_load_does_not_restart(self):
        cancel = Mock()
        cancel.wait.return_value = True
        with patch('instant_replay.main.restart_media') as restart:
            self.assertFalse(wait_for_replay_start('replay', cancel))
        restart.assert_not_called()

    def test_random_voice_variations(self):
        for text in ('random', 'Random.', 'play random.', 'random replay', 'play a random clip', 'surprise me!'):
            with self.subTest(text=text):
                self.assertEqual(_parse_command(text), ('play', 'random', 0, False))

    def test_existing_commands(self):
        self.assertEqual(_parse_command('play game 3.'), ('play', 'game 3', 0, False))
        self.assertEqual(_parse_command('save 30.'), ('save', '', 30, False))
        self.assertEqual(_parse_command('mark')[0], 'mark')
        self.assertEqual(_parse_command('save full')[3], True)

if __name__ == '__main__': unittest.main()

import sys
import unittest
from unittest.mock import patch, Mock
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay import main as replay_main
from instant_replay.main import _parse_command, wait_for_replay_start

class ReplayCommands(unittest.TestCase):
    def test_full_save_uses_original_without_cutting(self):
        with patch.object(replay_main, '_trim_from_end') as trim:
            self.assertEqual(replay_main._saved_clip('Replay.mp4', None,
                full_save=True, tail_seconds=40), 'Replay.mp4')
        trim.assert_not_called()

    def test_automatic_save_keeps_cutoff(self):
        with patch.object(replay_main, '_trim_from_end', return_value='cut.mkv') as trim:
            self.assertEqual(replay_main._saved_clip('Replay.mp4', 12,
                full_save=False, tail_seconds=3), 'cut.mkv')
        trim.assert_called_once_with('Replay.mp4', 12, tail_seconds=3)

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

    def test_stop_replay_voice_variations(self):
        for text in ('stop replay', 'leave replay!', 'exit replay', 'cancel replay'):
            with self.subTest(text=text):
                self.assertEqual(_parse_command(text), ('stop', '', 0, False))

    def test_existing_commands(self):
        self.assertEqual(_parse_command('play game 3.'), ('play', 'game 3', 0, False))
        self.assertEqual(_parse_command('save 30.'), ('save', '', 30, False))
        self.assertEqual(_parse_command('mark')[0], 'mark')
        self.assertEqual(_parse_command('save full')[3], True)

    def test_audio_restore_uses_the_pre_replay_mute_state(self):
        with patch.object(replay_main, '_is_muted', True), \
             patch.object(replay_main, '_desktop_was_muted', False), \
             patch('instant_replay.main.set_input_mute') as set_mute, \
             patch('instant_replay.main.obs.get_input_mute', return_value=False), \
             patch('builtins.print'):
            replay_main._unmute_desktop()
        set_mute.assert_called_once_with('Desktop Audio', False)

    def test_audio_restore_retries_until_obs_confirms_unmuted(self):
        with patch.object(replay_main, '_is_muted', True), \
             patch('instant_replay.main.set_input_mute') as set_mute, \
             patch('instant_replay.main.obs.get_input_mute', side_effect=[None, True, False]), \
             patch('instant_replay.main.time.sleep'), patch('builtins.print'):
            self.assertTrue(replay_main._unmute_desktop(force=True, attempts=3))
        self.assertEqual(set_mute.call_count, 3)

if __name__ == '__main__': unittest.main()

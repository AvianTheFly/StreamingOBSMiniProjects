import sys
import unittest
import threading
import subprocess
from contextlib import ExitStack
from unittest.mock import patch, Mock
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
from instant_replay import source_playback as replay_main
from instant_replay import audio as replay_audio, capture as replay_capture
from instant_replay.kill_tracker import KillTracker
from lib.league_live_client import LiveClientUnavailable
from instant_replay.main import _parse_command, wait_for_replay_start
from lib.shared_media.media_startup import media_startup, MediaStartupCancelled


class ReplayStartupTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.obs = self.stack.enter_context(patch.object(replay_main, 'obs'))
        self.obs.get_media_status.return_value={'state':'OBS_MEDIA_STATE_PAUSED','cursor_ms':0}
        cursor = {}
        def status(source):
            cursor[source] = cursor.get(source, 0) + 50
            return {'state': 'OBS_MEDIA_STATE_PLAYING', 'cursor_ms': cursor[source]}
        # The gate and Replay use the same OBS module; keep its status calls offline.
        self.stack.enter_context(patch('lib.shared_media.media_startup.obs.get_media_status', side_effect=status))
        self.stop = self.stack.enter_context(patch.object(replay_main, 'stop_media'))
        self.set_file = self.stack.enter_context(patch.object(replay_main, 'set_media_source_file'))
        self.mute = self.stack.enter_context(patch.object(replay_main, '_mute_desktop'))
        self.started = self.stack.enter_context(patch.object(replay_main, 'wait_for_replay_start', return_value=True))
        self.stack.enter_context(patch.object(replay_main, 'wait_for_stage_entry'))
        self.stack.enter_context(patch('instant_replay.library.volume_source', return_value='original.mkv'))
        self.fader, self.session = Mock(), Mock()
        self.fader.values.return_value = {}
        self.session.activate.return_value = True

    def launch(self, cancel):
        entered, done = threading.Event(), threading.Event()
        errors = []
        def run():
            entered.set()
            try:
                replay_main._start_replay_clip(Path('clip.mkv'), cancel, self.session, self.fader, {})
            except Exception as exc:
                errors.append(exc)
            finally:
                done.set()
        thread = threading.Thread(target=run, daemon=True)
        thread.start()
        self.assertTrue(entered.wait(1))
        self.addCleanup(lambda: thread.join(2))
        return done, errors

    def test_replay_waits_for_other_decoder_startup_then_preserves_asset_volume(self):
        cancel = threading.Event()
        with media_startup('music', timeout=1):
            done, errors = self.launch(cancel)
            self.assertFalse(done.wait(.1))
            self.set_file.assert_not_called()
            self.session.activate.assert_not_called()
        self.assertTrue(done.wait(2))
        self.assertEqual(errors, [])
        self.fader.capture.assert_called_once()
        self.fader.apply.assert_called_once_with(Path('clip.mkv'), fallback='original.mkv')
        self.set_file.assert_called_once_with(replay_main.SOURCE_NAME, 'clip.mkv')
        self.started.assert_called_once_with(replay_main.SOURCE_NAME, cancel)

    def test_cancel_while_queued_never_changes_file_scene_or_mute(self):
        cancel = threading.Event()
        with media_startup('music', timeout=1):
            done, errors = self.launch(cancel)
            cancel.set()
            self.assertTrue(done.wait(2))
            self.assertIsInstance(errors[0], MediaStartupCancelled)
        self.set_file.assert_not_called()
        self.session.activate.assert_not_called()
        self.mute.assert_not_called()
        self.fader.capture.assert_not_called()

    def test_failed_start_stops_decoder_and_releases_slot(self):
        self.started.return_value = False
        with patch('lib.shared_media.media_startup.obs.stop_media') as stop:
            with self.assertRaises(TimeoutError):
                replay_main._start_replay_clip(Path('clip.mkv'), threading.Event(),
                                              self.session, self.fader, {})
            stop.assert_called_once_with(replay_main.SOURCE_NAME)
        # A subsequent native start must be admitted, rather than leaking the gate.
        with media_startup('next', timeout=1):
            pass

    def test_handoff_holds_first_frame_until_reveal(self):
        order=[]
        self.started.side_effect=lambda *args:order.append('decode') or True
        self.obs.pause_media.side_effect=lambda *args:order.append('pause')
        self.obs.show_source.side_effect=lambda *args:order.append('show')
        replay_main._start_replay_clip(Path('clip.mkv'), threading.Event(),
                                      self.session, self.fader, {}, hold=True)
        self.assertEqual(order,['decode','pause','show'],'A handoff must not expose advancing media/audio before the first-frame hold')
        self.obs.pause_media.assert_called_once_with(replay_main.SOURCE_NAME)
        self.obs.get_obs().set_media_input_cursor.assert_called_once_with(replay_main.SOURCE_NAME, 0)

    def test_initial_clip_prepares_before_leaving_game_and_resumes_after_entry(self):
        order=[]
        self.session.activated=False
        self.started.side_effect=lambda *a:order.append('decode') or True
        self.session.activate.side_effect=lambda:order.append('scene') or True
        self.obs.play_media.side_effect=lambda *a:order.append('resume')
        replay_main._start_replay_clip(Path('clip.mkv'),threading.Event(),self.session,self.fader,{})
        self.assertEqual(order,['decode','scene'])
        self.obs.play_media.assert_not_called()
        self.obs.pause_media.assert_called_once_with(replay_main.SOURCE_NAME)

class ReplayCommands(unittest.TestCase):
    def test_import_preserves_hub_signal_handlers(self):
        result = subprocess.run([sys.executable, '-X', 'utf8', '-c', '''
import signal
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
before = {s: signal.getsignal(s) for s in (signal.SIGINT, signal.SIGTERM)}
import instant_replay.main
assert all(signal.getsignal(s) == handler for s, handler in before.items())
'''], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_kill_tracker_uses_shared_snapshot_and_resets_on_disconnect(self):
        stop = Mock()
        stop.is_set.side_effect = [False, False, True]
        stop.wait.return_value = False
        tracker = KillTracker(stop)
        snapshot = {'activePlayer': {'riotIdGameName': 'Me'},
                    'events': {'Events': [{'EventID': 1, 'EventName': 'ChampionKill',
                                           'KillerName': 'Me', 'VictimName': 'Other',
                                           'EventTime': 10.0}]}}
        with patch('instant_replay.kill_tracker.fetch_snapshot',
                   side_effect=[snapshot, LiveClientUnavailable('offline')]) as fetch:
            tracker._run()
        self.assertEqual(fetch.call_count, 2)
        self.assertFalse(tracker.game_connected)
        self.assertIsNone(tracker.last_kill_wall_time)

    def test_full_save_uses_original_without_cutting(self):
        with patch.object(replay_capture, '_trim_from_end') as trim:
            self.assertEqual(replay_capture._saved_clip('Replay.mp4', None,
                full_save=True, tail_seconds=40), 'Replay.mp4')
        trim.assert_not_called()

    def test_automatic_save_keeps_cutoff(self):
        with patch.object(replay_capture, '_trim_from_end', return_value='cut.mkv') as trim:
            self.assertEqual(replay_capture._saved_clip('Replay.mp4', 12,
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
        with patch('instant_replay.source_playback.restart_media'), patch('instant_replay.source_playback.obs.get_media_status', side_effect=samples) as status:
            self.assertTrue(wait_for_replay_start('replay', cancel))
        self.assertEqual(status.call_count, 3)

    def test_cancel_during_load_does_not_restart(self):
        cancel = Mock()
        cancel.wait.return_value = True
        with patch('instant_replay.source_playback.restart_media') as restart:
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
        with patch.object(replay_audio, '_is_muted', True), \
             patch.object(replay_audio, '_desktop_was_muted', False), \
             patch('instant_replay.audio.set_input_mute') as set_mute, \
             patch('instant_replay.audio.obs.get_input_mute', return_value=False), \
             patch('builtins.print'):
            replay_audio._unmute_desktop()
        set_mute.assert_called_once_with('Desktop Audio', False)

    def test_audio_restore_retries_until_obs_confirms_unmuted(self):
        with patch.object(replay_audio, '_is_muted', True), \
             patch('instant_replay.audio.set_input_mute') as set_mute, \
             patch('instant_replay.audio.obs.get_input_mute', side_effect=[None, True, False]), \
             patch('instant_replay.audio.time.sleep'), patch('builtins.print'):
            self.assertTrue(replay_audio._unmute_desktop(force=True, attempts=3))
        self.assertEqual(set_mute.call_count, 3)

if __name__ == '__main__': unittest.main()

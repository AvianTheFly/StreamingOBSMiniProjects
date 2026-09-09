"""Offline lifecycle tests, including slow loads and rapidly replaced requests."""
import sys
import ast
import threading
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import Mock, patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths()
load_project_env()
from lib.shared_media.playback_worker import PlaybackWorker
from soundboard.player import SoundboardPlayer
from specific_song.player import SongPlayer
from specific_song.bass_detector import BassDetector
from lib.shared_media import media_project


class WorkerTests(unittest.TestCase):
    def test_burst_keeps_only_latest_and_waits_for_cleanup(self):
        worker = PlaybackWorker('test')
        entered, release = threading.Event(), threading.Event()
        sequence = []
        def first(cancel):
            entered.set()
            self.assertTrue(release.wait(2))
            self.assertTrue(cancel.is_set())
            sequence.append('old cleaned')
        old = worker.submit(first)
        self.assertTrue(entered.wait(2))
        try:
            requests = [worker.submit(lambda cancel, i=i: sequence.append(i)) for i in range(100)]
            self.assertTrue(worker.busy)
            self.assertTrue(all(done.is_set() for done in requests[:-1]))
            self.assertEqual(sequence, [])
        finally:
            release.set()
        self.assertTrue(old.wait(2))
        self.assertTrue(requests[-1].wait(2))
        self.assertEqual(sequence, ['old cleaned', 99])

    def test_cancel_drops_pending_request(self):
        worker = PlaybackWorker('test')
        entered, release = threading.Event(), threading.Event()
        def first(cancel):
            entered.set()
            release.wait(2)
        old = worker.submit(first)
        self.assertTrue(entered.wait(2))
        pending = Mock()
        done = worker.submit(pending)
        worker.cancel()
        release.set()
        self.assertTrue(old.wait(2))
        self.assertTrue(done.is_set())
        pending.assert_not_called()


class DirectPlaybackTests(unittest.TestCase):
    def setUp(self):
        # Player tests isolate OBS startup; the shared gate has separate
        # threaded tests that exercise real ownership and cancellation.
        for module in ('soundboard.player', 'specific_song.player', 'lib.shared_media.media_project'):
            mock = patch(module + '.media_startup', return_value=nullcontext())
            mock.start()
            self.addCleanup(mock.stop)

    def test_soundboard_changed_file_has_no_redundant_restart(self):
        for same in (False, True):
            with self.subTest(same=same), patch('soundboard.player.obs') as obs, \
                 patch.object(SoundboardPlayer, '_ensure_source'):
                player = SoundboardPlayer()
                obs.set_media_source_file.return_value = not same
                player._state_store = Mock()
                player._current_media_file = Mock(return_value=Path('new.mp4' if same else 'old.mp4'))
                player._wait_for_media_file = Mock(return_value=True)
                player._poll_until_done = Mock(return_value=True)
                player.play(stem='new', filepath=Path('new.mp4'), volume_db=-9, categories=[])
                self.assertEqual(obs.restart_media.call_count, int(same))
                obs.set_media_source_file.assert_called_once()
                if not same:
                    names = [call[0] for call in obs.mock_calls]
                    self.assertLess(names.index('set_input_volume_db'), names.index('set_media_source_file'))
                    self.assertNotIn('stop_media', names[names.index('set_media_source_file') + 1:-2])

    def song(self):
        player = SongPlayer()
        player.remember_obs_volume = Mock()
        player.volume_for_stem = Mock(return_value=-9)
        player._current_media_file = Mock(return_value=Path('old.mp4'))
        player._wait_for_media_file = Mock(return_value=True)
        player._apply_fullscreen = Mock()
        player._set_monitor_and_output = Mock()
        player._poll_until_done = Mock(return_value=True)
        return player

    def test_song_file_change_starts_once_and_cleanup_stops_media(self):
        with patch('specific_song.player.obs') as obs, \
             patch('specific_song.player.BASS_ANIMATION_ENABLED', False), \
             patch('specific_song.player._resolve_audio_file', return_value=Path('new.mp4')):
            player = self.song()
            player.play('ss__new')
            obs.set_media_source_file.assert_called_once()
            obs.restart_media.assert_not_called()
            obs.stop_media.assert_called_once()  # stop before loading
            self.assertEqual(obs.park_media_source.call_count, 2)  # initialization and completion

    def test_cancel_during_load_never_starts_visualizer_or_shows_source(self):
        cancel = threading.Event()
        with patch('specific_song.player.obs') as obs, \
             patch('specific_song.player.BassAnimator') as animator, \
             patch('specific_song.player.BASS_ANIMATION_ENABLED', True), \
             patch('specific_song.player._resolve_audio_file', return_value=Path('new.mp4')):
            player = self.song()
            player._wait_for_media_file = Mock(side_effect=lambda *args: cancel.set() or True)
            player.play('ss__new', cancelled=cancel)
            animator.return_value.start.assert_not_called()
            obs.show_source.assert_not_called()
            obs.restart_media.assert_not_called()
            player._poll_until_done.assert_not_called()
            animator.return_value.stop.assert_called_once()

    def test_paused_analysis_does_not_read_more_audio(self):
        detector = BassDetector(audio_file=Path('song.mp4'))
        detector._running = True
        detector.pause()
        decoder = Mock()
        decoder.poll.return_value = 0
        with patch('specific_song.bass_detector.subprocess.Popen', return_value=decoder), \
             patch('specific_song.bass_detector.time.sleep', side_effect=lambda _: setattr(detector, '_running', False)):
            detector._stream_file_loop()
        decoder.stdout.read.assert_not_called()
        decoder.stdout.close.assert_called_once()

    def test_pause_and_resume_control_visualizer_too(self):
        with patch('specific_song.player.obs'):
            player = self.song()
            player._is_busy = True
            player._animator = Mock()
            player.pause()
            player._animator.pause.assert_called_once()
            player.resume()
            player._animator.resume.assert_called_once()

    def test_missing_song_does_not_replay_previous_file(self):
        with patch('specific_song.player.obs') as obs, \
             patch('specific_song.player._resolve_audio_file', return_value=None):
            player = self.song()
            player.play('ss__missing')
            obs.show_source.assert_not_called()
            obs.restart_media.assert_not_called()
            player._poll_until_done.assert_not_called()

    def test_shared_effect_player_starts_changed_file_once(self):
        for same in (False, True):
            with self.subTest(same=same), patch.object(media_project, 'obs') as obs, \
                 patch.object(media_project, '_get_obs_input_settings', return_value={'local_file': 'new.mp4' if same else 'old.mp4'}), \
                 patch.object(media_project, '_wait_for_media_source_file', return_value=True), \
                 patch.object(media_project.time, 'sleep'):
                obs.get_media_status.return_value = {'state': 'OBS_MEDIA_STATE_PLAYING', 'cursor_ms': 20}
                obs.set_media_source_file.return_value = not same
                self.assertTrue(media_project._start_media_source_playback(
                    scene='test', source_name='player', filepath=Path('new.mp4'), start_timeout=1))
                self.assertEqual(obs.restart_media.call_count, int(same))
                obs.set_media_source_file.assert_called_once()

    def test_shared_effect_completion_cannot_park_or_save_a_newer_identical_clip(self):
        # Exercise the nested completion callback without starting the Hub's
        # keyboard/event loop. Simulate another request during media polling.
        tree = ast.parse(Path(media_project.__file__).read_text(encoding='utf-8'))
        callback = next(node for node in ast.walk(tree)
                        if isinstance(node, ast.FunctionDef) and node.name == '_do_play')
        for replaced in (False, True):
            with self.subTest(replaced=replaced):
                request = [1]
                playing, source = ['hooray'], ['player']
                store, obs, coordinator = Mock(), Mock(), Mock()
                if replaced:
                    obs.wait_for_media_end.side_effect = lambda *a, **kw: request.__setitem__(0, 2)
                scope = dict(
                    play_lock=threading.Lock(), visible_lock=threading.Lock(),
                    current_play_request_id=request, request_id=1, currently_playing=playing,
                    current_source_name=source, name='hooray', source_name='player',
                    cfg=SimpleNamespace(project_name='test', scene='effects',
                                        media_start_timeout=1, media_total_timeout=10),
                    visible_sources=set(), _single_source_store_for=lambda _: store,
                    apply_runtime_media_settings=Mock(), apply_runtime_audio_settings=Mock(),
                    _single_source_mode=False, filepath=Path('hooray.mp4'),
                    _start_media_source_playback=Mock(), obs=obs, coordinator=coordinator)
                exec(compile(ast.Module(body=[callback], type_ignores=[]), '<callback>', 'exec'), scope)
                scope['_do_play']()
                self.assertEqual(obs.park_media_source.call_count, int(not replaced))
                self.assertEqual(store.capture_override_for_stem.call_count, int(not replaced))
                self.assertEqual(coordinator.announce_finished.call_count, int(not replaced))
                self.assertEqual(playing, ['hooray' if replaced else None])


if __name__ == '__main__':
    unittest.main()

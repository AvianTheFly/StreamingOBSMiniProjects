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
from lib.shared_media import media_project, source_playback


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
        for module in ('soundboard.player', 'specific_song.player', 'lib.shared_media.source_playback'):
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
            with self.subTest(same=same), patch.object(source_playback, 'obs') as obs, \
                 patch.object(source_playback, '_get_obs_input_settings', return_value={'local_file': 'new.mp4' if same else 'old.mp4'}), \
                 patch.object(source_playback, '_wait_for_media_source_file', return_value=True), \
                 patch.object(source_playback.time, 'sleep'):
                obs.get_media_status.return_value = {'state': 'OBS_MEDIA_STATE_PLAYING', 'cursor_ms': 20}
                obs.set_media_source_file.return_value = not same
                self.assertTrue(source_playback._start_media_source_playback(
                    scene='test', source_name='player', filepath=Path('new.mp4'), start_timeout=1))
                self.assertEqual(obs.restart_media.call_count, int(same))
                obs.set_media_source_file.assert_called_once()

    def test_cancel_during_file_load_does_not_show_or_restart_source(self):
        cancelled = threading.Event()
        def applied(*args, **kwargs):
            cancelled.set()
            return True
        with patch.object(source_playback, 'obs') as obs, \
             patch.object(source_playback, '_wait_for_media_source_file', side_effect=applied), \
             patch.object(source_playback.time, 'sleep'):
            with self.assertRaises(RuntimeError):
                source_playback._start_media_source_playback(scene='test', source_name='player',
                    filepath=Path('new.mp4'), start_timeout=1, cancelled=cancelled.is_set)
        obs.show_source.assert_not_called()
        obs.restart_media.assert_not_called()


class SharedSourceTests(unittest.TestCase):
    def setUp(self):
        # Exercise the real scheduling component with injected OBS/playback ports.
        from lib.shared_media.playback_controller import MediaPlayback
        self.obs, self.store, self.coordinator = Mock(), Mock(), Mock()
        self.tickets = []
        def request(name, on_ready):
            ticket = Mock(cancelled=threading.Event())
            self.tickets.append(ticket)
            if on_ready(ticket) is False:
                ticket.finish()
            return ticket
        self.coordinator.request.side_effect = request
        self.scope = dict(threading=threading, PlaybackWorker=PlaybackWorker,
            play_lock=threading.RLock(), visible_lock=threading.Lock(), stop_event=threading.Event(),
            current_play_request_id=[0], currently_playing=[None], current_source_name=[None],
            source_workers={}, current_worker=[None], current_completion=[None],
            name_index={'old': (Path('old.mp4'), 'player'), 'new': (Path('new.mp4'), 'player'),
                        'layer': (Path('layer.mp4'), 'layer-player')},
            cfg=SimpleNamespace(project_name='test', scene='effects',
                                media_start_timeout=1, media_total_timeout=10),
            visible_sources=set(), _single_source_store_for=lambda _: self.store,
            apply_runtime_media_settings=Mock(), apply_runtime_audio_settings=Mock(),
            _single_source_mode=False, _start_media_source_playback=Mock(return_value=True),
            obs=self.obs, coordinator=self.coordinator, run_cleanup=media_project.run_cleanup,
            layout_for_asset=Mock(return_value={'positionX': 22}))
        self.scope['asset_player'] = media_project.AssetPlayback(self.scope['cfg'], obs_api=self.obs,
            start_source=self.scope['_start_media_source_playback'],
            state_for=self.scope['_single_source_store_for'],
            apply_media=self.scope['apply_runtime_media_settings'],
            apply_audio=self.scope['apply_runtime_audio_settings'], layout_for=self.scope['layout_for_asset'])
        component = MediaPlayback(self.scope['cfg'], self.scope['stop_event'],
            self.scope['name_index'], self.scope['asset_player'],
            visible_sources=self.scope['visible_sources'], visible_lock=self.scope['visible_lock'])
        for name in ('worker_for', 'play_asset', 'play_asset_concurrent', '_play_asset_concurrent',
                     'stop_current_playback', 'cancel_all_playback', 'stop_current_playing_source',
                     '_play_source', 'play_lock', 'currently_playing', 'current_source_name',
                     'current_play_request_id', 'source_workers', 'current_worker', 'current_completion'):
            self.scope[name] = getattr(component, name)
        for name, value in (('obs', self.obs), ('coordinator', self.coordinator)):
            seam = patch('lib.shared_media.playback_controller.' + name, value)
            seam.start()
            self.addCleanup(seam.stop)
        self.addCleanup(self.scope['cancel_all_playback'])

    def test_replacement_waits_for_old_cleanup_and_preserves_old_asset_settings(self):
        entered, cleaning, release = threading.Event(), threading.Event(), threading.Event()
        waits = [0]
        def wait(source, cancelled, **kwargs):
            waits[0] += 1
            if waits[0] == 1:
                entered.set()
                while not cancelled():
                    release.wait(.01)
        parks = [0]
        def park(*args):
            parks[0] += 1
            if parks[0] == 1:
                cleaning.set()
                self.assertTrue(release.wait(2))
        self.obs.wait_for_media_end.side_effect = wait
        self.obs.park_media_source.side_effect = park
        self.scope['play_asset']('old')
        self.assertTrue(entered.wait(2))
        latest = self.scope['play_asset']('new')
        try:
            self.assertTrue(cleaning.wait(2))
            self.assertEqual(self.scope['_start_media_source_playback'].call_count, 1)
            self.store.capture_override_for_stem.assert_called_once_with('old')
            self.tickets[0].finish.assert_not_called()
        finally:
            release.set()
        self.assertTrue(latest.wait(2))
        self.assertEqual([c.args[0] for c in self.store.capture_override_for_stem.call_args_list], ['old', 'new'])
        self.tickets[0].finish.assert_called_once_with()
        self.tickets[1].finish.assert_called_once_with()

    def test_different_sources_still_layer_concurrently(self):
        entered, layer_entered, release = threading.Event(), threading.Event(), threading.Event()
        def wait(source, cancelled, **kwargs):
            (entered if source == 'player' else layer_entered).set()
            self.assertTrue(release.wait(2))
        self.obs.wait_for_media_end.side_effect = wait
        old = self.scope['play_asset']('old')
        self.assertTrue(entered.wait(2))
        layer = self.scope['play_asset_concurrent']('layer')
        try:
            self.assertTrue(layer_entered.wait(2))
        finally:
            release.set()
        self.assertTrue(old.wait(2))
        self.assertTrue(layer.wait(2))

    def test_stop_invalidates_a_delayed_coordinator_callback(self):
        callbacks = []
        self.coordinator.request.side_effect = lambda name, on_ready: callbacks.append(lambda: on_ready(Mock(cancelled=threading.Event())))
        done = self.scope['play_asset']('old')
        self.scope['stop_current_playback']()
        callbacks[0]()
        self.assertTrue(done.is_set())
        self.scope['_start_media_source_playback'].assert_not_called()

    def test_delayed_hotkey_abort_cannot_stop_a_newer_identical_asset(self):
        self.coordinator.request.side_effect = lambda name, on_ready: None
        self.scope['play_asset']('old')
        previous = self.scope['current_play_request_id'][0]
        self.scope['play_asset']('old')
        self.scope['stop_current_playing_source']('old', 'player', previous)
        self.assertEqual(self.scope['currently_playing'], ['old'])
        self.obs.stop_media.assert_not_called()

    def test_failed_file_load_does_not_save_old_file_state_as_new_asset(self):
        self.scope['_start_media_source_playback'].side_effect = RuntimeError('OBS file swap failed')
        self.assertTrue(self.scope['play_asset']('new').wait(2))
        self.store.capture_override_for_stem.assert_not_called()
        self.obs.park_media_source.assert_called_once()

    def test_shared_source_preserves_asset_placement_priority(self):
        self.scope['cfg'].single_source_mode = True
        self.scope.update(_single_source_mode=True, _choose_shared_source=lambda previous: 'player',
            _refresh_layout_rules_if_needed=Mock(), active_settings=[None],
            _layout_rules_cache=[{}], resolve_rule_for_stem=Mock(return_value={'scale_x': 2}),
            obs_transform_from_rule=lambda rule: rule)
        for has_override in (True, False):
            with self.subTest(has_override=has_override):
                self.obs.set_source_transform.reset_mock()
                self.store.has_transform_override.return_value = has_override
                self.assertTrue(self.scope['play_asset']('new').wait(2))
                self.assertEqual(self.obs.set_source_transform.call_count, int(not has_override))
                self.store.apply_for_stem.assert_called_with('new')


if __name__ == '__main__':
    unittest.main()

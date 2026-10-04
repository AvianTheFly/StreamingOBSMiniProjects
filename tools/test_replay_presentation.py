"""Replay workflow regressions with disposable settings and owned fake resources."""
import json
import copy
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from contextlib import ExitStack

from lib.paths import ensure_import_paths
ensure_import_paths()
from instant_replay import presentation, stage_settings, stage
from instant_replay.runtime_state import ReplayState
from instant_replay.selection import ReplaySelection
from instant_replay.playback import ReplayPlayback
from instant_replay.source_playback import wait_for_stage_entry
from lib.shared_media.media_startup import MediaStartupCancelled
from lib.coordination.scenes import SceneDirector


class PresentationTests(unittest.TestCase):
    def test_context_and_explicit_choice_determine_workflow(self):
        self.assertEqual(presentation.mode_for('replay', in_game=True), 'replay')
        self.assertEqual(presentation.mode_for('replay', in_game=False), 'showcase')
        self.assertEqual(presentation.mode_for('highlights', in_game=True), 'showcase')
        self.assertEqual(presentation.mode_for('clip', requested='replay'), 'replay')

    def test_viewports_preserve_aspect_and_never_overlap(self):
        for view, camera in ((view, camera) for view in ('off', 'live', 'desktop') for camera in (False, True)):
            box = presentation.layout(view, camera)
            x, y, w, h = box['media']
            self.assertEqual(w / h, 16 / 9)
            self.assertLessEqual(x + w, 1920)
            self.assertLessEqual(y + h, 1080)
            if view != 'off':
                self.assertLess(x + w, box['live'][0])
            if camera:
                self.assertLess(x + w, box['camera'][0])
                self.assertEqual(box['camera'][2] / box['camera'][3], 16 / 9)
                if view != 'off':
                    self.assertLess(box['live'][1] + box['live'][3], box['camera'][1])

    def test_personal_title_wins_and_capture_timestamp_has_readable_fallback(self):
        path = 'Replay 2026-10-02 12-10-00.mp4'
        self.assertEqual(presentation.clip_copy(path, {'title': 'Baron, stolen.', 'game': 'Game 8'})[0], 'Baron, stolen.')
        self.assertEqual(presentation.clip_copy(path, {'tag': 'win'})[0], 'Win')
        self.assertNotIn('2026', presentation.clip_copy(path, {})[0])
        self.assertEqual(presentation.clip_copy(path, {'tag': 'untagged', 'game': 'Game 8 2026-10-02'}),
                         ('Oct 2 · 12:10', 'Game 8'))
        self.assertEqual(presentation.clip_copy(path, {'title': 'Baron steal', 'game': 'Game 8 2026-10-02'})[1],
                         'Game 8 · Oct 2 · 12:10')

    def test_preferences_preserve_unknown_fields_and_malformed_files(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(stage_settings, 'FILE', Path(folder) / 'prefs.json'), \
             patch.object(stage_settings, 'SettingsBackups'):
            stage_settings.FILE.write_text(json.dumps({'personal': [1, 2], 'replay': {'note': 'keep'}}))
            settings = stage_settings.save({'replay': {'companion': 'off'}})
            self.assertEqual(settings['personal'], [1, 2])
            self.assertEqual(settings['replay']['note'], 'keep')
            self.assertEqual(settings['showcase']['transition'], 'current')
            stage_settings.FILE.write_text('{broken')
            with self.assertRaises(ValueError):
                stage_settings.save({'motion': False})
            self.assertEqual(stage_settings.FILE.read_text(), '{broken')

    def test_camera_and_clip_transitions_are_independent_saved_choices(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(stage_settings, 'FILE', Path(folder) / 'prefs.json'), \
             patch.object(stage_settings, 'SettingsBackups'):
            settings = stage_settings.save({'replay': {'camera': False, 'clip_transition': 'iris'}})
            self.assertFalse(settings['replay']['camera'])
            self.assertTrue(settings['showcase']['camera'])
            self.assertEqual(settings['replay']['clip_transition'], 'iris')
            with self.assertRaises(ValueError):
                stage_settings.save({'showcase': {'camera': 'true'}})
            with self.assertRaises(ValueError):
                stage_settings.save({'showcase': {'clip_transition': 'unknown'}})

    def test_stage_snapshots_are_isolated(self):
        one = stage.state()
        one['settings']['replay']['companion'] = 'bad'
        self.assertNotEqual(stage.state()['settings']['replay']['companion'], 'bad')

    def test_finished_replay_clears_pause_and_progress(self):
        with patch.object(stage, '_installed', False), patch.object(stage, '_state', dict(stage._state)):
            stage.start('clip', 'A moment', 1, 1)
            stage.progress({'cursor_ms': 850, 'duration_ms': 1000}, paused=True)
            stage.returning()
            stage.finish()
            state = stage.state()
            self.assertFalse(state['active'])
            self.assertFalse(state['paused'])
            self.assertEqual((state['phase'], state['cursor_ms'], state['duration_ms']), ('idle', 0, 0))


class TemporaryTransitionTests(unittest.TestCase):
    def setUp(self):
        self.current = 'Game'
        self.overrides = {'Game': ('My Spirit', 1000), 'Replay': (None, None)}
        self.used = []
        self.client = Mock()
        self.client.get_current_program_scene.side_effect = lambda: SimpleNamespace(current_program_scene_name=self.current)
        self.client.get_scene_scene_transition_override.side_effect = lambda scene: SimpleNamespace(
            transition_name=self.overrides[scene][0], transition_duration=self.overrides[scene][1])
        self.client.set_scene_scene_transition_override.side_effect = lambda scene, name, duration: self.overrides.__setitem__(scene, (name, duration))
        def switch(scene):
            self.used.append((scene, self.overrides.get(scene, (None, None))))
            self.current = scene
        self.client.set_current_program_scene.side_effect = switch
        self.director = SceneDirector(lambda: self.client)

    def test_short_transition_is_scoped_to_entry_and_owned_return(self):
        lease = self.director.reserve('replay', 'Replay', 'Game', transition=('Fade', 220))
        self.director.activate(lease)
        self.director.finish(lease)
        self.assertEqual(self.used, [('Replay', ('Fade', 220)), ('Game', ('Fade', 220))])
        self.assertEqual(self.overrides, {'Game': ('My Spirit', 1000), 'Replay': (None, None)})
        self.client.set_current_scene_transition.assert_not_called()

    def test_failed_switch_restores_override(self):
        self.client.set_current_program_scene.side_effect = RuntimeError('unavailable')
        lease = self.director.reserve('replay', 'Replay', 'Game', transition=('Fade', 220))
        with self.assertRaises(RuntimeError):
            self.director.activate(lease)
        self.assertEqual(self.overrides['Replay'], (None, None))

    def test_newer_choice_prevents_return_and_transition_changes(self):
        lease = self.director.reserve('replay', 'Replay', 'Game', transition=('Fade', 220))
        self.director.activate(lease)
        self.director.request('Other', owner='user', automatic=False)
        self.client.set_scene_scene_transition_override.reset_mock()
        self.assertFalse(self.director.finish(lease))
        self.client.set_scene_scene_transition_override.assert_not_called()

    def test_clip_waits_for_stinger_before_starting(self):
        cancelled, session, client = Mock(), Mock(), Mock()
        cancelled.wait.return_value = False
        session.owns_scene.return_value = True
        client.get_current_scene_transition_cursor.side_effect = [
            SimpleNamespace(transition_cursor=p) for p in (.15, .8, 1)]
        with patch('instant_replay.source_playback.obs.get_obs', return_value=client):
            wait_for_stage_entry(session, cancelled)
        self.assertEqual(client.get_current_scene_transition_cursor.call_count, 3)

    def test_transition_wait_rejects_cancel_and_newer_scene(self):
        for cancel, owns in ((True, True), (False, False)):
            cancelled, session = Mock(), Mock()
            cancelled.wait.return_value, session.owns_scene.return_value = cancel, owns
            with patch('instant_replay.source_playback.obs.get_obs') as client:
                with self.assertRaises(MediaStartupCancelled):
                    wait_for_stage_entry(session, cancelled)
                client.assert_not_called()

    def test_transition_wait_has_a_deadline(self):
        cancelled, session, client = Mock(), Mock(), Mock()
        cancelled.wait.return_value = False
        session.owns_scene.return_value = True
        client.get_current_scene_transition_cursor.return_value = SimpleNamespace(transition_cursor=.5)
        with patch('instant_replay.source_playback.obs.get_obs', return_value=client), \
             patch('instant_replay.source_playback.time.monotonic', side_effect=[0, 13]):
            with self.assertRaises(TimeoutError):
                wait_for_stage_entry(session, cancelled)


class ClipHandoffTests(unittest.TestCase):
    def setUp(self):
        self.scope = ExitStack(); self.addCleanup(self.scope.close)
        self.scope.enter_context(patch.multiple(stage, _installed=True, _state=copy.deepcopy(stage._state),
                                    _covered=threading.Event(), _revealed=threading.Event()))
        self.apply = self.scope.enter_context(patch.object(stage, 'apply_layout'))
        self.cover = self.scope.enter_context(patch('instant_replay.obs_stage.set_cover'))
        self.cancelled = threading.Event()
        stage.start('highlights', 'Next play', 2, 3, handoff=True)

    def test_only_current_revision_and_phase_can_acknowledge_a_swap(self):
        revision = stage.state()['revision']
        self.assertFalse(stage.acknowledge_cue(revision - 1, 'covered'))
        self.assertFalse(stage.acknowledge_cue(revision, 'revealed'))
        self.assertFalse(stage._covered.is_set())
        self.assertTrue(stage.acknowledge_cue(revision, 'covered'))
        self.assertTrue(stage.cover_for_swap(self.cancelled, lambda: True))
        self.cover.assert_called_once_with(True)
        self.assertFalse(stage.acknowledge_cue(revision, 'covered'))
        self.assertEqual(stage.state()['phase'], 'loading')

    def test_missing_browser_gets_native_cover_and_bounded_reveal(self):
        self.assertTrue(stage.cover_for_swap(self.cancelled, lambda: True, timeout=0))
        self.assertTrue(stage.reveal_for_play(self.cancelled, lambda: True, timeout=0))
        self.assertEqual([c.args for c in self.cover.call_args_list], [(True,), (False,)])

    def test_cancel_or_lost_lease_never_admits_file_swap(self):
        self.cancelled.set()
        self.assertFalse(stage.cover_for_swap(self.cancelled, lambda: True))
        self.cancelled.clear()
        self.assertFalse(stage.cover_for_swap(self.cancelled, lambda: False))
        self.cover.assert_not_called()

    def test_replaced_cue_cannot_release_the_new_clip(self):
        old = stage.state()['revision']
        stage.start('highlights', 'Third play', 3, 3, handoff=True)
        self.assertFalse(stage.acknowledge_cue(old, 'covered'))
        self.assertFalse(stage._covered.is_set())

    def test_reveal_ack_releases_only_the_current_ready_clip(self):
        revision = stage.state()['revision']
        with patch.object(stage._revealed, 'wait', side_effect=lambda _: stage.acknowledge_cue(revision, 'revealed')):
            self.assertTrue(stage.reveal_for_play(self.cancelled, lambda: True))
        self.assertTrue(stage._revealed.is_set())
        stage.playing()
        self.assertFalse(stage.acknowledge_cue(revision, 'revealed'))


class SavedReplayTests(unittest.TestCase):
    def setUp(self):
        self.state = ReplayState()
        self.player = Mock()
        self.selection = ReplaySelection(self.state, Mock(), self.player)
        self.addCleanup(self.selection.shutdown)
        self.patch = patch('instant_replay.selection.scene_director')
        self.director = self.patch.start()
        self.addCleanup(self.patch.stop)
        self.director.snapshot.return_value = {'manual_revision': 0}

    def test_failed_capture_never_falls_back_to_old_clip(self):
        self.state._save_done_event[0].set()
        self.selection.queue_saved_replay(force_replay=True)
        self.selection._deferred_thread.join(1)
        self.player._play_all_clips_sequential.assert_not_called()

    def test_successful_capture_plays_exact_result_and_repeated_requests_are_bounded(self):
        self.assertTrue(self.selection.queue_saved_replay(force_replay=True))
        self.assertFalse(self.selection.queue_saved_replay(force_replay=True))
        self.state._save_result[0]['path'] = 'new.mp4'
        self.state._save_done_event[0].set()
        self.selection._deferred_thread.join(1)
        self.player._play_all_clips_sequential.assert_called_once_with(['new.mp4'], presentation='replay', mode=None)

    def test_stop_and_newer_scene_choice_cancel_pending_replay(self):
        for newer in (False, True):
            with self.subTest(newer=newer):
                self.director.snapshot.return_value = {'manual_revision': 0}
                self.assertTrue(self.selection.queue_saved_replay(force_replay=True))
                if newer:
                    self.director.snapshot.return_value = {'manual_revision': 1}
                else:
                    self.selection.cancel_pending()
                self.state._save_result[0]['path'] = 'new.mp4'
                self.state._save_done_event[0].set()
                self.selection._deferred_thread.join(1)
                self.player._play_all_clips_sequential.assert_not_called()
                self.state._save_done_event[0].clear()

    def test_cleanup_returns_before_parking_and_restores_audio_on_failure(self):
        state = ReplayState()
        session = Mock()
        order = []
        session.finish.side_effect = lambda **kwargs: order.append('return')
        with patch('instant_replay.playback.AssetFader'), patch('instant_replay.playback.stage'), \
             patch('instant_replay.playback.library', create=True), \
             patch('instant_replay.library.read', return_value={'clips': {}}), \
             patch('instant_replay.playback.coordinator') as coordinator, \
             patch('instant_replay.playback.obs.park_media_source', side_effect=lambda *a: order.append('park')), \
             patch('instant_replay.playback._unmute_desktop') as unmute:
            coordinator.scene_session.return_value = session
            player = ReplayPlayback(state, {})
            player.replay_fader.capture.side_effect = RuntimeError('fader unavailable')
            player._play_all_clips_sequential([])
            self.assertEqual(order, ['return', 'park'])
            unmute.assert_called_once_with(force=True)
            self.assertFalse(player._playback_gate.locked())
            self.assertFalse(state._replay_active[0])

    def test_user_resume_during_handoff_does_not_start_media_under_the_cover(self):
        state = ReplayState()
        state._replay_active[0], state._replay_paused[0] = True, True
        state._scene_session[0] = Mock()
        state._scene_session[0].owns_scene.return_value = True
        with patch('instant_replay.playback.AssetFader'), patch('instant_replay.playback._mute_desktop'), \
             patch('instant_replay.playback.stage') as presentation_state, \
             patch('instant_replay.playback.obs.play_media') as play:
            presentation_state.state.return_value = {'handoff': True, 'phase': 'revealing'}
            player = ReplayPlayback(state, {})
            player._resume_replay()
            self.assertFalse(state._replay_paused[0])
            play.assert_not_called()


if __name__ == '__main__':
    unittest.main()

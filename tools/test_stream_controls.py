"""Stream-session intent and output dispatch, with disposable OBS state."""
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from lib.coordination.scenes import SceneDirector
from scene_voice_switcher.session_controls import SessionControls


class StreamControlTests(unittest.TestCase):
    def setUp(self):
        self.scene = 'Game'
        self.writes = []
        self.client = Mock()
        self.client.get_current_program_scene.side_effect = lambda: SimpleNamespace(current_program_scene_name=self.scene)
        def write(scene):
            self.scene = scene
            self.writes.append(scene)
        self.client.set_current_program_scene.side_effect = write
        self.director = SceneDirector(lambda: self.client)
        self.resolve = patch('lib.coordination.lobbies.resolve_presented_scene', side_effect=lambda client, scene, **kw: scene)
        self.resolve.start()
        self.addCleanup(self.resolve.stop)
        self.controls = SessionControls(self.director)
        self.addCleanup(self.controls.close)

    def choose(self, scene):
        self.director.request(scene, owner='button', automatic=False)
        return {'lobby': scene}

    def test_overlapping_holds_release_only_their_token_and_apply_latest(self):
        first = self.director.hold_automatic('first')
        last = self.director.hold_automatic('last')
        prepare_old, prepare_new = Mock(), Mock()
        self.assertFalse(self.director.request('Queue', owner='client', prepare=prepare_old))
        self.assertFalse(self.director.request('Draft', owner='client', prepare=prepare_new))
        self.assertFalse(self.director.release_automatic(object(), resume=True))
        self.assertTrue(self.director.release_automatic(first, resume=True))
        self.assertEqual(self.writes, [])
        prepare_old.assert_not_called(); prepare_new.assert_not_called()
        self.director.release_automatic(last, resume=True)
        self.assertEqual(self.writes, ['Draft'])
        prepare_old.assert_not_called(); prepare_new.assert_called_once()
        self.assertFalse(self.director.release_automatic(last, resume=True))

    def test_break_replay_return_and_follow_preserve_hold(self):
        result = self.controls.present('break', lambda: self.choose('Tavern'))
        self.assertTrue(result['session']['held'])
        self.director.request('Game', owner='league')
        lease = self.director.reserve('instant_replay', 'Replay', 'Game')
        self.assertTrue(self.director.activate(lease))
        self.director.finish(lease)
        self.assertEqual(self.scene, 'Tavern')
        self.assertTrue(self.controls.snapshot()['held'])
        self.controls.follow()
        self.assertEqual(self.scene, 'Game')

    def test_manual_choice_discards_old_automatic_intent(self):
        self.controls.hold()
        self.director.request('Draft', owner='client')
        self.choose('Other')
        self.controls.follow()
        self.assertEqual(self.writes, ['Other'])

    def test_ending_hold_expires_when_another_manual_scene_is_chosen(self):
        self.controls.present('ending', lambda: self.choose('Afterparty'))
        self.director.request('Old queue', owner='client')
        self.choose('Game')
        self.controls.reconcile()
        self.assertFalse(self.controls.snapshot()['held'])
        self.assertIsNone(self.director.snapshot()['pending_scene'])
        self.director.request('Lobby', owner='client')
        self.assertEqual(self.writes, ['Afterparty', 'Game', 'Lobby'])

    def test_break_scope_survives_replay_and_explicit_hold_remains_deliberate(self):
        self.controls.present('break', lambda: self.choose('Tavern'))
        lease = self.director.reserve('instant_replay', 'Replay', 'Game')
        self.director.activate(lease); self.controls.reconcile()
        self.assertTrue(self.controls.snapshot()['held'])
        self.director.finish(lease); self.controls.reconcile()
        self.assertTrue(self.controls.snapshot()['held'])
        self.controls.hold(); self.choose('Other'); self.controls.reconcile()
        self.assertTrue(self.controls.snapshot()['held'])

    def test_external_obs_scene_change_expires_the_ending_hold(self):
        self.controls.present('ending', lambda: self.choose('Afterparty'))
        self.scene = 'Game'; self.director.observe('Game'); self.controls.reconcile()
        self.assertFalse(self.controls.snapshot()['held'])

    def test_unobserved_external_choice_invalidates_pending_on_release(self):
        self.controls.hold()
        self.director.request('Draft', owner='client')
        self.scene = 'User OBS choice'
        self.controls.follow()
        self.assertEqual(self.writes, [])
        self.assertEqual(self.scene, 'User OBS choice')

    def test_follow_during_replay_waits_for_owned_return(self):
        self.controls.hold()
        lease = self.director.reserve('instant_replay', 'Replay', 'Game')
        self.director.activate(lease)
        self.director.request('Queue', owner='client')
        self.controls.follow()
        self.assertEqual(self.scene, 'Replay')
        self.director.finish(lease)
        self.assertEqual(self.scene, 'Queue')

    def test_failed_selection_rolls_back_only_its_new_hold(self):
        failure = Mock(side_effect=ValueError('OBS unavailable'))
        with self.assertRaises(ValueError): self.controls.present('ending', failure)
        self.assertEqual(self.director.snapshot()['automatic_holds'], [])
        self.controls.present('break', lambda: self.choose('Tavern'))
        with self.assertRaises(ValueError): self.controls.present('ending', failure)
        self.assertEqual(self.controls.snapshot(), {'held': True, 'stage': 'break', 'lobby': 'Tavern'})

    def test_explicit_game_and_shutdown_drop_deferred_intent_without_replay(self):
        self.controls.present('ending', lambda: self.choose('Afterparty'))
        self.director.request('Draft', owner='client')
        self.controls.present('game', lambda: self.choose('Game'))
        self.assertEqual(self.writes, ['Afterparty', 'Game'])
        self.assertFalse(self.controls.snapshot()['held'])
        self.controls.hold()
        self.director.request('Draft', owner='client')
        self.controls.close()
        self.assertEqual(self.scene, 'Game')
        self.assertEqual(self.director.snapshot()['automatic_holds'], [])

    def test_outputs_dispatch_without_scene_or_settings_writes(self):
        from hub_actions import run_action
        with patch('obs.outputs.start_stream') as start, patch('obs.outputs.stop_stream') as stop, patch('obs.outputs.start_replay_buffer') as buffer:
            self.assertTrue(run_action('start_stream')['ok']); start.assert_called_once()
            self.assertTrue(run_action('stop_stream')['ok']); stop.assert_called_once()
            self.assertTrue(run_action('start_replay_buffer')['ok']); buffer.assert_called_once()
            stop.side_effect = RuntimeError('OBS disconnected')
            self.assertEqual(run_action('stop_stream')['error'], 'OBS disconnected')
        self.assertEqual(self.writes, [])

    def test_buffer_start_is_idempotent(self):
        from obs.outputs import start_replay_buffer
        with patch('obs.outputs.get_obs', return_value=self.client):
            self.client.get_replay_buffer_status.return_value = SimpleNamespace(output_active=True)
            start_replay_buffer(); self.client.start_replay_buffer.assert_not_called()
            self.client.get_replay_buffer_status.return_value = SimpleNamespace(output_active=False)
            start_replay_buffer(); self.client.start_replay_buffer.assert_called_once()

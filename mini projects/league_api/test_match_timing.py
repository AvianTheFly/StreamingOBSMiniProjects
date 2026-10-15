"""The image clock admits lifecycle actions and protects the final handoff."""
import copy
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from lib.coordination.game_policy import GameScenePolicy
from lib.coordination.scenes import SceneDirector
from .client_scenes import ClientScenes, DEFAULTS as CLIENT_DEFAULTS
from .match_handoff import MatchHandoff
from .match_screens import MatchScreens
from .match_timing import MatchTiming
from .production.config import DEFAULTS
from .test_client_scenes import FakeOBS
from .test_engine import snapshot, event


class MatchTimingTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        for name in ('game-start.png', 'victory.png', 'defeat.png'):
            (self.root / name).write_bytes(b'art')
        self.now = [100.0]
        self.clock = lambda: self.now[0]
        self.screens = MatchScreens(self.root, {**copy.deepcopy(DEFAULTS), 'enabled': True,
                                              'match_screens': True}, self.clock)
        self.timing = MatchTiming(self.clock)

    def result(self):
        self.screens.ingest(900, [{'key': 'victory', 'confidence': 'observed'}])
        return snapshot(900, [event(2, 'GameEnd', 900, Result='Win')])

    def test_start_uses_zero_clock_event_and_never_replays_duplicates(self):
        self.assertEqual(self.timing.observe(snapshot(.1)), [])
        start = snapshot(.2, [event(1, 'GameStart', 0)])
        self.assertEqual(self.timing.observe(start), ['game.connected'])
        self.assertEqual(self.timing.observe(start), [])
        zero = MatchTiming(self.clock)
        self.assertEqual(zero.observe(snapshot(0, [event(1, 'GameStart', 0)])), ['game.connected'])

    def test_result_boundary_uses_art_start_even_after_api_disappears(self):
        self.timing.observe(snapshot(899))
        data = self.result()
        self.assertEqual(self.timing.observe(data, self.screens.snapshot()), [])
        self.now[0] += 1.49
        self.assertEqual(self.timing.disconnected(), [])
        self.assertTrue(self.timing.snapshot()['running'])
        self.now[0] += .01
        self.assertEqual(self.timing.disconnected(), ['game.disconnected'])
        self.assertFalse(self.timing.snapshot()['running'])
        self.assertEqual(self.timing.observe(data, self.screens.snapshot()), [])

    def test_reconnect_does_not_end_game_or_replay_start_and_new_match_rewinds(self):
        self.timing.observe(snapshot(899))
        self.timing.disconnected()
        self.now[0] += 2
        self.assertEqual(self.timing.observe(snapshot(900)), [])
        self.timing.observe(self.result(), self.screens.snapshot())
        self.assertEqual(self.timing.observe(snapshot(0, [event(1, 'GameStart', 0)])), ['game.connected'])
        self.assertFalse(self.timing.snapshot()['ending'])

    def test_startup_on_finished_game_is_silent_and_unknown_result_ends(self):
        self.assertEqual(self.timing.observe(self.result()), [])
        self.assertFalse(self.timing.snapshot()['running'])
        self.timing.observe(snapshot(0, [event(1, 'GameStart', 0)]))
        self.assertEqual(self.timing.observe(snapshot(901, [event(2, 'GameEnd', 901)])), ['game.disconnected'])

    def test_preview_cannot_advance_real_result_boundary(self):
        self.timing.observe(snapshot(899))
        data = self.result()
        self.screens.preview('victory')
        self.assertEqual(self.screens.snapshot()['elapsed'], 0)
        self.assertEqual(self.timing.observe(data, self.screens.automatic_screen()), [])
        self.now[0] += 1.5
        self.assertEqual(self.timing.observe(data, self.screens.automatic_screen()), ['game.disconnected'])

    def test_service_dispatches_once_on_image_clocks_outside_service_lock(self):
        from . import main
        from .engine import Engine
        from lib.league_live_client import LiveClientUnavailable
        with patch.object(main, 'ROOT', self.root):
            service = main.Service(threading.Event())
        service.engine = Engine(clock=self.clock, production_settings=self.screens.settings)
        service.match_screens = self.screens
        service.match_timing = self.timing
        service.client_scenes = Mock(intent_revision=0)
        service.client_scenes.snapshot.return_value = {'phase': 'InProgress', 'connected': True,
                                                      'watching_replay': False}
        recording_calls = []
        def record_tick(phase, **kwargs):
            self.assertFalse(service.lock._is_owned())
            recording_calls.append((phase, kwargs))
        service.match_recording = Mock()
        service.match_recording.tick.side_effect = record_tick
        service.match_handoff = Mock(screen_id=None, origin=('Test', 0))
        service.stop_event = Mock()
        service.stop_event.is_set.side_effect = [False]*7 + [True]
        service.stop_event.wait.side_effect = lambda seconds: self.now.__setitem__(0, self.now[0]+seconds)
        data = [snapshot(0), snapshot(0, [event(1, 'GameStart', 0)]),
                snapshot(900, [event(1, 'GameStart', 0), event(2, 'GameEnd', 900, Result='Win')])]
        signals = []
        def dispatched(name, **payload):
            self.assertFalse(service.lock._is_owned())
            signals.append((name, self.now[0]))
        with patch.object(main, 'fetch_snapshot', side_effect=data+[LiveClientUnavailable('closed')]*4), \
             patch.object(main.time, 'monotonic', side_effect=self.clock), \
             patch('events.emit', side_effect=dispatched):
            service.poll()
        self.assertEqual(signals, [('game.connected', 100.5), ('game.disconnected', 102.5)])
        service.client_scenes.game_started.assert_called_once()
        service.client_scenes.game_ended.assert_called_once_with(expected_manual_revision=0)
        self.assertEqual(len(recording_calls), 7)
        self.assertEqual(sum(call[1]['ended'] for call in recording_calls), 1)

    def test_provider_is_withdrawn_and_callbacks_run_outside_contract_lock(self):
        policy = GameScenePolicy()
        owner = object()
        def read():
            policy.unregister(owner)
            return self.timing.snapshot()
        policy.register(owner, automatic_lobbies=lambda: False, hold=lambda **kw: 0, match_state=read)
        self.assertFalse(policy.match_state()['running'])
        self.assertIsNone(policy.match_state())

    def test_picture_covers_slow_preparation_and_full_transition(self):
        obs = FakeOBS()
        director = SceneDirector(lambda: obs)
        director.refresh_observation()
        self.result()
        handoff = MatchHandoff(self.screens, director, self.clock, lambda: obs)
        handoff.begin()
        self.now[0] += 6.5
        self.assertEqual(self.screens.scene_hold(), 0)
        self.assertTrue(self.screens.snapshot()['protected'])
        handoff.tick()  # Router has not run yet; the picture must stay.
        director.request('Lobbies', owner='league_client')
        obs.send = Mock(return_value={'transitionCursor': .4})
        handoff.tick()
        self.now[0] += .5
        handoff.tick()
        self.assertIsNotNone(self.screens.snapshot())
        obs.send.return_value = {'transitionCursor': 1}
        handoff.tick()
        self.assertIsNone(self.screens.snapshot())

    def test_manual_choice_and_safety_deadline_release_only_original_picture(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        self.result()
        handoff = MatchHandoff(self.screens, director, self.clock, lambda: obs)
        handoff.begin()
        director.request('Manual', owner='user', automatic=False)
        handoff.tick()
        self.assertIsNone(self.screens.snapshot())
        self.screens.reset(); self.result(); handoff.begin()
        self.now[0] += 16.5
        self.assertIsNone(self.screens.snapshot())

    def test_temporary_replay_cannot_acknowledge_the_result_handoff(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        director.refresh_observation(); self.result()
        handoff = MatchHandoff(self.screens, director, self.clock, lambda: obs)
        handoff.begin(); self.now[0] += 6.5
        lease = director.reserve('replay', 'InstantReplay', 'Game')
        director.activate(lease)
        obs.send = Mock(return_value={'transitionCursor': 1})
        handoff.tick(); handoff.tick()
        self.assertIsNotNone(self.screens.snapshot())
        obs.send.assert_not_called()
        director.finish(lease)
        self.assertIsNotNone(self.screens.snapshot())

    def test_end_routes_before_lcu_phase_and_retains_manual_guard_across_idle(self):
        obs = FakeOBS(); reader = Mock(); director = SceneDirector(lambda: obs)
        config = self.root/'client.json'
        config.write_text(json.dumps({**CLIENT_DEFAULTS, 'enabled': True, 'loading_scene': 'Test'}))
        watcher = ClientScenes(config, reader, lambda: obs, self.clock,
                               self.screens.scene_hold, director=director)
        reader.snapshot.return_value = ('InProgress', None)
        watcher.game_started(); watcher.tick()
        self.result()
        watcher.game_ended(expected_manual_revision=0)
        watcher.tick()
        self.assertEqual(watcher.target, 'idle')
        self.assertEqual(obs.writes, [])
        director.request('Manual', owner='user', automatic=False)
        self.now[0] += 6.5
        reader.snapshot.return_value = ('EndOfGame', None)
        watcher.tick()
        self.assertEqual(obs.scene, 'Manual')

    def test_end_with_lcu_still_in_game_applies_at_art_deadline(self):
        obs = FakeOBS(); reader = Mock(); reader.snapshot.return_value = ('InProgress', None)
        config = self.root/'client.json'
        config.write_text(json.dumps({**CLIENT_DEFAULTS, 'enabled': True, 'loading_scene': 'Test'}))
        watcher = ClientScenes(config, reader, lambda: obs, self.clock,
                               self.screens.scene_hold, director=SceneDirector(lambda: obs))
        watcher.game_started(); watcher.tick(); self.result(); watcher.game_ended(); watcher.tick()
        self.now[0] += 6.5
        watcher.apply_pending()
        self.assertEqual(obs.scene, 'just screen')
        watcher.tick()
        self.assertEqual(obs.scene, 'just screen')

    def test_new_match_withdraws_old_post_game_intent(self):
        obs = FakeOBS(); reader = Mock(); reader.snapshot.return_value = ('InProgress', None)
        config = self.root/'client.json'
        config.write_text(json.dumps({**CLIENT_DEFAULTS, 'enabled': True}))
        watcher = ClientScenes(config, reader, lambda: obs, self.clock,
                               self.screens.scene_hold, director=SceneDirector(lambda: obs))
        watcher.game_ended()
        watcher.game_started()
        watcher.apply_pending()
        self.assertIsNone(watcher.target)
        self.assertEqual(obs.writes, [])


class ReplayBoundaryTests(unittest.TestCase):
    def test_replay_uses_published_end_instead_of_api_socket_and_preserves_ids(self):
        from instant_replay.kill_tracker import KillTracker
        tracker = KillTracker(threading.Event())
        state = {'running': True, 'generation': 1}
        with patch('instant_replay.kill_tracker.game_scene_policy.match_state', side_effect=lambda: dict(state)):
            self.assertTrue(tracker._observe_match(snapshot(900)))
            tracker._seen_event_ids.add(42)
            ended = snapshot(901, [event(43, 'GameEnd', 901)])
            self.assertTrue(tracker._observe_match(ended))
            state['running'] = False
            self.assertFalse(tracker._observe_match(ended))
            self.assertFalse(tracker.game_connected)
            self.assertIn(42, tracker._seen_event_ids)
            state.update(running=True, generation=2)
            self.assertTrue(tracker._observe_match(snapshot(0, [event(1, 'GameStart', 0)])))
            self.assertEqual(tracker._seen_event_ids, set())


if __name__ == '__main__':
    unittest.main()

import copy
import json
import queue
from pathlib import Path
import tempfile
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from .client_scenes import ClientScenes, DEFAULTS as CLIENT_DEFAULTS
from .engine import Engine
from .match_screens import MatchScreens
from .production.config import DEFAULTS, validate
from .test_client_scenes import FakeOBS
from .test_engine import snapshot, event
from lib.coordination.scenes import SceneDirector


class MatchScreenTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        for name in ('game-start.png', 'victory.png', 'defeat.png'):
            (self.root/name).write_bytes(b'art')
        self.now = [100.0]
        self.settings = {**copy.deepcopy(DEFAULTS), 'enabled': True, 'match_screens': True}
        self.screens = MatchScreens(self.root, self.settings, lambda: self.now[0])

    def result(self, key='victory'):
        self.screens.ingest(1800, [{'key': key, 'confidence': 'observed'}])

    def test_result_waits_one_point_five_and_then_holds_five_seconds(self):
        self.result()
        self.assertEqual(self.screens.snapshot()['elapsed'], -1.5)
        self.assertEqual(self.screens.scene_hold(), 6.5)
        self.now[0] = 101.49
        self.assertLess(self.screens.snapshot()['elapsed'], 0)
        self.now[0] = 101.5
        self.assertEqual(self.screens.snapshot()['elapsed'], 0)
        self.assertEqual(self.screens.snapshot()['remaining'], 5)
        self.now[0] = 106.49
        self.assertGreater(self.screens.scene_hold(), 0)
        self.now[0] = 106.5
        self.assertIsNone(self.screens.snapshot())
        self.assertEqual(self.screens.scene_hold(), 0)
        self.assertEqual(self.screens.scene_hold(disconnected=True), 0)

    def test_duplicate_results_do_not_extend_hold_and_new_game_resets(self):
        self.result('defeat')
        self.now[0] += 2
        self.result('defeat')
        self.assertEqual(self.screens.scene_hold(), 4.5)
        self.screens.ingest(0, [{'key': 'game_start', 'confidence': 'observed'}])
        self.assertEqual(self.screens.snapshot()['key'], 'game_start')
        self.assertEqual(self.screens.snapshot()['elapsed'], 0)
        self.assertEqual(self.screens.scene_hold(), 0)
        self.now[0] += 5
        self.assertIsNone(self.screens.snapshot())
        self.result()
        self.assertEqual(self.screens.snapshot()['key'], 'victory')

    def test_unknown_or_baselined_results_never_guess_art(self):
        engine = Engine(clock=lambda: self.now[0])
        old = snapshot(1800, [event(1, 'GameEnd', 1800, Result='Lose')])
        self.screens.ingest(1800, engine.ingest(old))
        self.assertIsNone(self.screens.snapshot())
        self.screens.ingest(1801, [{'key': 'game_end', 'confidence': 'observed'}])
        self.assertIsNone(self.screens.snapshot())
        self.screens.ingest(1802, [{'key': 'victory', 'confidence': 'possible'}])
        self.assertIsNone(self.screens.snapshot())

    def test_real_engine_event_selects_result_once(self):
        engine = Engine(clock=lambda: self.now[0])
        engine.ingest(snapshot(1799))
        end = snapshot(1800, [event(1, 'GameEnd', 1800, Result='Lose')])
        out = engine.ingest(end)
        self.screens.ingest(1800, out)
        self.assertEqual(self.screens.snapshot()['key'], 'defeat')
        self.now[0] += 1
        self.screens.ingest(1800, engine.ingest(end))
        self.assertEqual(self.screens.scene_hold(), 5.5)

    def test_client_phase_arriving_first_waits_for_actual_result(self):
        obs = FakeOBS(); reader = Mock()
        config = self.root/'client.json'
        config.write_text(json.dumps({**CLIENT_DEFAULTS, 'enabled': True}))
        watcher = ClientScenes(config, reader, lambda: obs, lambda: self.now[0], self.screens.scene_hold,
                               director=SceneDirector(lambda: obs))
        reader.snapshot.return_value = ('InProgress', None); watcher.tick()
        reader.snapshot.return_value = ('WaitingForStats', None); watcher.tick()
        self.assertEqual(obs.writes, [])
        self.now[0] += .5
        self.result()
        reader.snapshot.return_value = ('Lobby', None); watcher.tick()
        self.assertEqual(obs.writes, [])
        self.now[0] += 6.49; watcher.apply_pending()
        self.assertEqual(obs.writes, [])
        self.now[0] += .01; watcher.apply_pending()
        self.assertEqual(obs.scene, 'just screen')
        writes = len(obs.writes)
        watcher.apply_pending()
        self.assertEqual(len(obs.writes), writes)

    def test_phase_only_grace_is_bounded_and_never_rearmed(self):
        self.assertEqual(self.screens.scene_hold(previous_phase='InProgress', phase='EndOfGame'), 2)
        self.now[0] += 2
        self.assertEqual(self.screens.scene_hold(disconnected=True), 0)
        self.assertIsNone(self.screens.snapshot())

    def test_previews_do_not_hold_or_release_a_real_result(self):
        self.screens.preview('victory')
        self.assertEqual(self.screens.scene_hold(), 0)
        self.result('defeat')
        self.now[0] += .5
        self.screens.preview('game_start')
        self.assertEqual(self.screens.scene_hold(), 6)
        self.assertEqual(self.screens.snapshot()['key'], 'game_start')
        self.screens.clear()
        self.assertEqual(self.screens.scene_hold(), 0)

    def test_disabled_paused_or_missing_art_does_not_hold(self):
        self.screens.configure({**self.settings, 'match_screens': False})
        self.result()
        self.assertIsNone(self.screens.snapshot())
        self.assertEqual(self.screens.scene_hold(disconnected=True), 0)
        self.screens.configure(self.settings)
        (self.root/'victory.png').unlink()
        self.result()
        self.assertIsNone(self.screens.snapshot())
        self.assertEqual(self.screens.scene_hold(disconnected=True), 0)
        from .main import Service
        service = Service.__new__(Service)
        service.match_screens = self.screens
        service.engine = Mock(config={'paused': True})
        self.assertEqual(service.match_scene_hold(disconnected=True), 0)

    def test_game_api_loss_keeps_art_until_its_original_deadline(self):
        from . import main
        with patch.object(main, 'ROOT', self.root):
            (self.root/'production.json').write_text(json.dumps(self.settings))
            service = main.Service(threading.Event())
        service.match_screens = self.screens
        service.engine.config['overlay_enabled'] = False  # Clip switch is independent of production art.
        self.result()
        self.now[0] += 3.1
        service.engine.clear()  # Service.poll does this after API loss.
        self.assertEqual(service.snapshot()['match_screen']['key'], 'victory')
        self.assertGreater(service.match_scene_hold(), 0)
        self.now[0] += 3.4
        self.assertIsNone(service.snapshot()['match_screen'])

    def test_settings_preserve_event_overrides_and_reject_invalid_timing(self):
        saved = {**self.settings, 'event_options': {'kill': {'duration': 1.2}}}
        self.assertEqual(validate(saved)['event_options'], saved['event_options'])
        for key, value in [('result_delay_seconds', -1), ('result_hold_seconds', 90),
                           ('start_hold_seconds', float('nan')), ('match_screens', 1)]:
            with self.assertRaises(ValueError):
                validate({**saved, key: value})

    def test_fallback_scene_return_waits_and_reconnect_cancels_it(self):
        from scene_voice_switcher import main as switcher
        callbacks = {}
        stop = threading.Event(); startup = threading.Event(); returned = threading.Event()
        remaining = [5]
        service = SimpleNamespace(client_scenes=SimpleNamespace(enabled=False),
                                  match_scene_hold=lambda **context: remaining[0])
        with patch.object(switcher, '_discover_lobbies', return_value={'TavernLobby': []}), \
             patch.object(switcher, 'show_game', return_value=True), \
             patch.object(switcher, 'show_lobby', side_effect=lambda *a, **k: (returned.set() or True, 'TavernLobby')), \
             patch.object(switcher, 'VoicePTT'), \
             patch.object(switcher, 'subscribe_global_hotkeys'), \
             patch.object(switcher, 'unsubscribe_global_hotkeys'), \
             patch.object(switcher.hub_events, 'subscribe', side_effect=lambda name, cb: callbacks.update({name: cb})), \
             patch.object(switcher.hub_events, 'unsubscribe'), \
             patch.object(switcher.game_scene_policy, 'automatic_lobbies', return_value=False), \
             patch.object(switcher.game_scene_policy, 'hold', side_effect=service.match_scene_hold):
            worker = threading.Thread(target=switcher.run,args=(queue.Queue(),stop),kwargs={'startup_event':startup})
            worker.start()
            try:
                self.assertTrue(startup.wait(2))
                callbacks['game.disconnected']({})
                self.assertFalse(returned.wait(.15))
                callbacks['game.connected']({})
                remaining[0] = 0
                self.assertFalse(returned.wait(.2))
                remaining[0] = 5
                callbacks['game.disconnected']({})
                self.assertFalse(returned.wait(.15))
                remaining[0] = 0
                self.assertTrue(returned.wait(1))
            finally:
                stop.set(); worker.join(2)
            self.assertFalse(worker.is_alive())


if __name__ == '__main__':
    unittest.main()

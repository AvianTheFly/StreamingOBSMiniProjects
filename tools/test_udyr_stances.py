"""Stance intent must preserve loops, match boundaries and sole source ownership."""
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from league.udyr_stances import UdyrStances, SOURCE


class StanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.paths = {key: Path(self.tmp.name) / (key + '.mp4') for key in 'qwer'}
        for path in self.paths.values():
            path.touch()
        self.gate = threading.Event()
        self.gate.set()
        self.stop = threading.Event()
        self.client = Mock()
        self.settings = {'local_file': 'original.mp4', 'looping': True,
                         'hw_decode': True, 'personal': 'preserve'}
        self.client.get_input_settings.side_effect = lambda source: Mock(input_settings=dict(self.settings))
        self.loaded = threading.Event()
        def settings(source, values, overlay):
            self.settings.update(values)
            self.loaded.set()
        self.client.set_input_settings.side_effect = settings
        self.obs_patch = patch('league.udyr_stances.obs.get_obs', return_value=self.client)
        self.obs_patch.start()
        self.player = UdyrStances(self.stop, paths=self.paths, permission=self.gate)

    def tearDown(self):
        self.player.close()
        self.obs_patch.stop()
        self.tmp.cleanup()

    def test_inactive_and_dead_keys_ignored_same_key_does_not_restart(self):
        self.assertFalse(self.player.select('r'))
        self.player.update(True, True)
        self.assertTrue(self.loaded.wait(2))
        self.assertEqual(self.settings['local_file'], self.paths['q'].as_posix())
        self.assertFalse(self.player.select('Q'))
        self.assertEqual(self.client.set_input_settings.call_count, 1)
        self.player.update(True, False)
        self.assertFalse(self.player.select('e'))
        self.player.update(False, False)
        self.assertFalse(self.player.select('w'))
        self.assertEqual(self.settings['personal'], 'preserve')

    def test_replacement_waits_for_old_cleanup_and_latest_intent_wins(self):
        self.player.update(True, True)
        self.assertTrue(self.loaded.wait(2))
        cleaning, release = threading.Event(), threading.Event()
        def action(source, action):
            if action.endswith('_PAUSE') and not release.is_set():
                cleaning.set()
                release.wait(2)
        self.client.trigger_media_input_action.side_effect = action
        try:
            self.assertTrue(self.player.select('w'))
            self.assertTrue(cleaning.wait(2))
            self.player.select('e')
            self.player.select('r')
            self.assertEqual(self.client.set_input_settings.call_count, 1)
            self.loaded.clear()
            release.set()
            self.assertTrue(self.loaded.wait(2))
            self.assertEqual(self.settings['local_file'], self.paths['r'].as_posix())
            self.assertEqual(self.client.set_input_settings.call_count, 2)
        finally:
            release.set()

    def test_blocked_gate_cannot_load_and_end_discards_delayed_stance(self):
        self.gate.clear()
        self.player.update(True, True)
        self.player.select('r')
        self.player.update(False, False)
        self.gate.set()
        self.player.close()
        self.client.set_input_settings.assert_not_called()
        self.assertFalse(self.player.select('e'))

    def test_respawn_keeps_selection_and_new_match_defaults_blue(self):
        self.player.update(True, True)
        self.assertTrue(self.loaded.wait(2))
        self.loaded.clear()
        self.player.select('w')
        self.assertTrue(self.loaded.wait(2))
        self.player.update(True, False)
        self.player.update(True, True)
        self.player.update(False, False)
        self.loaded.clear()
        self.player.update(True, True)
        self.assertTrue(self.loaded.wait(2))
        self.assertEqual(self.settings['local_file'], self.paths['q'].as_posix())

    def test_pause_gate_freezes_then_resumes_without_reloading(self):
        paused, played = threading.Event(), threading.Event()
        self.client.trigger_media_input_action.side_effect = lambda source, action: (
            paused.set() if action.endswith('_PAUSE') else played.set())
        self.player.update(True, True)
        self.assertTrue(played.wait(2))
        played.clear()
        self.gate.clear()
        self.assertTrue(paused.wait(2))
        self.gate.set()
        self.assertTrue(played.wait(2))
        self.assertEqual(self.client.set_input_settings.call_count, 1)
        self.assertTrue(all(call.args[0] == SOURCE
            for call in self.client.trigger_media_input_action.call_args_list))

    def test_chat_guard_requires_mana_evidence_and_death_clears_intent(self):
        now = [10.]
        self.player._casts.clock = lambda: now[0]
        def sample(mana):
            return {'gameData': {'gameTime': now[0]}, 'activePlayer': {
                'championStats': {'resourceType': 'MANA', 'resourceValue': mana,
                                 'resourceMax': 1000, 'resourceRegenRate': 4}}}
        self.player.update(True, True)
        self.assertTrue(self.loaded.wait(2))
        self.player.observe(sample(500))
        self.player.enter()
        self.assertTrue(self.player.press('w'))
        self.assertEqual(self.client.set_input_settings.call_count, 1)
        self.loaded.clear()
        now[0] += .25
        self.player.observe(sample(470))
        self.assertTrue(self.loaded.wait(2))
        self.assertEqual(self.settings['local_file'], self.paths['w'].as_posix())
        self.player.press('r')
        self.player.update(True, False)
        self.player.update(True, True)
        now[0] += .25
        self.player.observe(sample(440))
        self.player.close()
        self.assertEqual(self.settings['local_file'], self.paths['w'].as_posix())

    def test_fallback_without_mana_and_chat_keys_never_replay_after_timeout(self):
        now = [10.]
        self.player._casts.clock = lambda: now[0]
        self.player.update(True, True)
        self.assertTrue(self.loaded.wait(2))
        self.loaded.clear()
        self.assertTrue(self.player.press('W'))
        self.assertTrue(self.loaded.wait(2))
        self.assertEqual(self.settings['local_file'], self.paths['w'].as_posix())
        self.player.enter()
        self.assertFalse(self.player.press('r'))
        self.assertEqual(self.settings['local_file'], self.paths['w'].as_posix())
        now[0] += 5.01
        self.player.observe({})
        self.assertEqual(self.settings['local_file'], self.paths['w'].as_posix())
        self.loaded.clear()
        self.assertTrue(self.player.press('e'))
        self.assertTrue(self.loaded.wait(2))
        self.assertEqual(self.settings['local_file'], self.paths['e'].as_posix())
        self.assertFalse(self.player.press('E'))


class KeyboardRoutingTests(unittest.TestCase):
    def test_shared_listener_routes_enter_without_replacing_recall_or_stance(self):
        from league import main
        from lib.global_hotkeys import KeyEvent
        watcher = Mock()
        def subscribe(callback):
            for key in [KeyEvent(None, 'enter'), KeyEvent('Q', ''), KeyEvent('b', '')]:
                callback(key)
            return 17
        stop = threading.Event()
        stop.set()
        with patch.object(main, 'LeagueAPIWatcher', return_value=watcher), \
             patch.object(main.threading, 'Thread'), \
             patch.object(main, 'subscribe_global_hotkeys', side_effect=subscribe), \
             patch.object(main, 'unsubscribe_global_hotkeys') as unsubscribe, \
             patch('league.interface._live', {}):
            main.run(None, stop)
        watcher.on_chat_key.assert_called_once_with()
        watcher.on_stance_key.assert_called_once_with('Q')
        watcher.on_recall_key.assert_called_once_with()
        unsubscribe.assert_called_once_with(17)


if __name__ == '__main__':
    unittest.main()

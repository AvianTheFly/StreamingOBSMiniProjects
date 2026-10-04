"""Gameplay HUD must not leak into loading/results or revive after GameEnd."""
import threading
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from league.core.match_lifecycle import MatchLifecycle
from league.hud_presentation import HudPresentation, HUD_ITEMS
from league.core.league_api import LeagueAPIWatcher


def snapshot(time, ended=False, dead=False):
    return {'gameData': {'gameTime': time},
            'activePlayer': {'riotIdGameName': 'Me'},
            'allPlayers': [{'riotIdGameName': 'Me', 'isDead': dead}],
            'events': {'Events': [{'EventName': 'GameEnd'}] if ended else []}}


class LifecycleTests(unittest.TestCase):
    def test_loading_positive_clock_and_cumulative_end(self):
        state = MatchLifecycle()
        for time in (None, False, float('nan'), -1, 0):
            self.assertFalse(state.observe(snapshot(time)))
        self.assertTrue(state.observe(snapshot(.01)))
        self.assertTrue(state.observe(snapshot(900)))
        self.assertFalse(state.observe(snapshot(901, ended=True)))
        self.assertFalse(state.observe(snapshot(902)))
        self.assertFalse(state.observe(snapshot(903, ended=True)))
        self.assertFalse(state.observe(snapshot(0)))
        self.assertTrue(state.observe(snapshot(1)))

    def test_startup_on_result_never_shows_gameplay(self):
        state = MatchLifecycle()
        self.assertFalse(state.observe(snapshot(1500, ended=True)))
        self.assertFalse(state.observe(snapshot(1501)))

    def test_visibility_keeps_hud_on_death_but_hides_animation(self):
        client = Mock()
        client.get_scene_item_id.side_effect = [Mock(scene_item_id=78), Mock(scene_item_id=90)] * 4
        client.get_scene_item_enabled.return_value.scene_item_enabled = None
        with patch('league.hud_presentation.obs.get_obs', return_value=client):
            hud = HudPresentation()
            hud.hide()
            hud.update(True, True)
            hud.update(True, False)
            hud.hide()
            hud.hide()
        self.assertEqual([call.args[2] for call in client.set_scene_item_enabled.call_args_list],
                         [False, False, True, True, False, False])

    def test_failed_visibility_retries_on_next_poll(self):
        client = Mock()
        client.get_scene_item_id.return_value.scene_item_id = 1
        client.get_scene_item_enabled.return_value.scene_item_enabled = False
        client.set_scene_item_enabled.side_effect = [RuntimeError('offline'), None, None]
        with patch('league.hud_presentation.obs.get_obs', return_value=client):
            hud = HudPresentation()
            hud.update(True, True)
            hud.update(True, True)
        self.assertEqual(len(client.set_scene_item_enabled.call_args_list), 3)

    def test_watcher_skips_loading_and_ends_before_disconnect(self):
        watcher = LeagueAPIWatcher.__new__(LeagueAPIWatcher)
        watcher.stop_event = Mock()
        watcher.stop_event.is_set.side_effect = [False] * 6 + [True]
        watcher.match_lifecycle = MatchLifecycle()
        watcher.hud = Mock()
        watcher.detector = Mock()
        watcher._on_connected = Mock()
        watcher._on_disconnected = Mock()
        watcher._fetch = Mock(side_effect=[snapshot(0), snapshot(1), snapshot(2, dead=True),
                                         snapshot(3, ended=True), snapshot(4), snapshot(5, ended=True)])
        watcher.run()
        self.assertEqual(watcher._on_connected.call_count, 2)
        self.assertEqual(watcher.detector.process.call_count, 2)
        self.assertEqual(watcher._on_disconnected.call_count, 4)
        self.assertEqual([call.kwargs for call in watcher.hud.update.call_args_list],
                         [dict(running=False, alive=True), dict(running=True, alive=True),
                          dict(running=True, alive=False)] + [dict(running=False, alive=True)] * 3)


if __name__ == '__main__':
    unittest.main()

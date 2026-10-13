"""Exact discoveries and local-only delivery, using disposable match data."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from lib.paths import ensure_import_paths
ensure_import_paths()
from league_stats.six_seven import SixSevenFinder, findings
from league_stats.service import Tracker
from league_stats.store import Store
from tools.test_league_stats import snapshot
from hub_ui import updates
import events


class FinderTests(unittest.TestCase):
    def setUp(self):
        self.now = 100
        self.finder = SixSevenFinder(lambda: self.now, lambda: 1700000000 + self.now)
        self.data = snapshot()
        self.finder.observe(self.data, 'match')

    def observe(self):
        self.data['gameData']['gameTime'] += 1.5
        return self.finder.observe(self.data, 'match')

    def test_all_players_and_compact_combined_message(self):
        self.data['allPlayers'][0]['scores'].update(kills=6, deaths=7)
        self.data['allPlayers'][2]['scores'].update(creepScore=67)
        result = self.observe()
        self.assertEqual(result['title'], '🔎 6–7 found!')
        self.assertEqual(result['lines'], ['⚔️ Jinx · 6 kills / 7 deaths', '🌾 Caitlyn · 67 CS'])
        self.assertIsNone(self.observe())
        self.now += 30
        self.assertIsNone(self.observe())

    def test_exact_values_and_missing_data(self):
        for value in (True, '67', 167, 67.1, None, float('nan')):
            self.data['allPlayers'][0]['scores'].update(kills=6, deaths=6, creepScore=value)
            self.assertEqual(findings(self.data), {})
        self.data['gameData']['gameTime'] = 67
        self.assertEqual(findings(self.data), {})

    def test_team_score_either_direction_requires_complete_kills(self):
        self.data['allPlayers'][0]['scores']['kills'] = 5
        self.data['allPlayers'][2]['scores']['kills'] = 7
        self.assertEqual(findings(self.data)['teams'], ('teams', 'Blue 6 · Red 7'))
        self.data['allPlayers'][0]['scores']['kills'] = 6
        self.data['allPlayers'][2]['scores']['kills'] = 6
        self.assertEqual(findings(self.data)['teams'], ('teams', 'Blue 7 · Red 6'))
        del self.data['allPlayers'][1]['scores']['kills']
        self.assertNotIn('teams', findings(self.data))

    def test_restart_baseline_stale_poll_and_new_match(self):
        self.data['allPlayers'][0]['scores']['creepScore'] = 67
        fresh = SixSevenFinder()
        self.assertIsNone(fresh.observe(self.data, 'match'))
        self.assertIsNone(fresh.observe(self.data, 'match'))
        self.data['gameData']['gameTime'] = 599
        self.assertIsNone(self.finder.observe(self.data, 'match'))
        self.data['allPlayers'][0]['scores']['creepScore'] = 66
        self.assertIsNone(self.finder.observe(self.data, 'new'))
        self.data['allPlayers'][0]['scores']['creepScore'] = 67
        self.assertIsNotNone(self.finder.observe({**self.data, 'gameData': {'gameTime': 600}}, 'new'))

    def test_cooldown_rechecks_values_instead_of_delivering_stale_finds(self):
        self.data['allPlayers'][0]['scores']['creepScore'] = 67
        self.assertIsNotNone(self.observe())
        self.data['allPlayers'][2]['scores']['creepScore'] = 67
        self.assertIsNone(self.observe())
        self.data['allPlayers'][2]['scores']['creepScore'] = 68
        self.now += 12
        self.assertIsNone(self.observe())
        self.data['allPlayers'][2]['scores'].update(kills=6, deaths=7)
        self.assertIsNotNone(self.observe())

    def test_finished_game_is_quiet(self):
        self.data['allPlayers'][0]['scores']['creepScore'] = 67
        self.data['gameData']['gameTime'] += 1
        self.assertIsNone(self.finder.observe(self.data, 'match', live=False))

    def test_tracker_to_scoped_browser_stream_and_subscription_cleanup(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            tracker = Tracker(Store(path/'stats.sqlite3'), path/'settings.json')
            with updates.forward_domain_events(), updates.subscription({'hub_event'}) as inbox, patch('lib.twitch_chat.reply') as send:
                tracker.ingest(self.data, account='p', game_id=7)
                data = copy.deepcopy(self.data)
                data['gameData']['gameTime'] += 1
                data['allPlayers'][0]['scores']['creepScore'] = 67
                tracker.ingest(data, account='p', game_id=7)
                message = json.loads(inbox.get_nowait().decode()[6:])
                self.assertEqual(message['payload']['event'], 'chat.overlay.notice')
                self.assertEqual(message['payload']['data']['lines'], ['🌾 Jinx · 67 CS'])
                tracker.ingest(data, account='p', game_id=7)
                self.assertTrue(inbox.empty())
                send.assert_not_called()
            with updates.subscription({'hub_event'}) as inbox:
                events.emit('chat.overlay.notice', kind='six-seven')
                self.assertTrue(inbox.empty())


if __name__ == '__main__':
    unittest.main()

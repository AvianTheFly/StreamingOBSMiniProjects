import unittest
from unittest.mock import Mock
from lib.league_client import LeagueClient
from .queue_state import QueueState, bans_finished
from .test_client_scenes import session


class QueueJourneyTests(unittest.TestCase):
    def setUp(self):
        self.now = 100
        self.state = QueueState(lambda: self.now)

    def observe(self, phase, draft=None, **details):
        self.state.observe(phase, draft, details)
        return self.state.snapshot(True)

    def test_client_clock_roles_ready_check_bans_then_freeze(self):
        row = self.observe('Matchmaking', seconds=63, primary='BOTTOM', secondary='UTILITY')
        self.assertEqual(row['seconds'], 63)
        self.assertEqual(row['roles'], ['BOTTOM', 'UTILITY'])
        self.now += 10
        self.assertEqual(self.observe('ReadyCheck')['seconds'], 73)
        self.now += 5
        self.assertTrue(self.observe('ChampSelect', session('PLANNING', [False]))['active'])
        self.now += 30
        self.assertEqual(self.observe('ChampSelect', session(bans=[False]))['seconds'], 108)
        self.now += 2
        result = self.observe('ChampSelect', session(bans=[True]))
        self.assertFalse(result['active'])
        self.assertEqual(result['seconds'], 110)
        self.now += 5
        self.assertEqual(self.observe('ChampSelect', session('PICK'))['seconds'], 110)

    def test_dodge_after_picks_continues_journey_even_if_client_timer_resets(self):
        self.observe('Matchmaking', seconds=40)
        self.now += 20
        self.observe('ChampSelect', session(bans=[True]))
        self.now += 10
        result = self.observe('Matchmaking', seconds=0)
        self.assertEqual(result['seconds'], 70)
        self.assertTrue(result['running'])
        self.assertEqual(result['journey'], 1)
        self.now += 15
        self.assertEqual(self.observe('ChampSelect', session(bans=[False]))['seconds'], 85)

    def test_broadcast_label_conceals_ready_check_and_bans(self):
        for phase, draft in [('Matchmaking', None), ('ReadyCheck', None),
                             ('ChampSelect', session('PLANNING', [False])),
                             ('ChampSelect', session(bans=[False]))]:
            row = self.observe(phase, draft)
            self.assertTrue(row['active'])
            self.assertEqual(row['status'], 'IN QUEUE')

    def test_transient_dodge_lobby_bridges_but_cancel_resets_immediately(self):
        self.observe('Matchmaking', seconds=20)
        self.observe('ChampSelect', session(bans=[False]))
        self.observe('Lobby')
        self.now += 1
        self.assertEqual(self.observe('Matchmaking', seconds=0)['seconds'], 21)
        result = self.observe('Lobby', search_state='Canceled')
        self.assertEqual(result['seconds'], 0)
        self.assertFalse(result['active'])
        self.now += 10
        self.assertEqual(self.observe('Matchmaking', seconds=0)['seconds'], 0)
        self.assertEqual(self.state.serial, 2)

    def test_uncertain_dodge_lobby_expires_and_game_resets(self):
        self.observe('Matchmaking', seconds=15)
        self.observe('ChampSelect', session(bans=[False]))
        self.observe('Lobby')
        self.now += 2
        self.assertEqual(self.observe('Lobby')['seconds'], 0)
        self.observe('Matchmaking', seconds=4)
        self.assertEqual(self.observe('InProgress')['seconds'], 0)

    def test_missing_data_never_fabricates_roles_or_bad_clock(self):
        result = self.observe('Matchmaking', seconds=float('nan'), primary='someone', secondary={'invalid': True})
        self.assertEqual(result['seconds'], 0)
        self.assertEqual(result['roles'], [])
        self.assertFalse(self.state.snapshot(False)['active'])
        self.now += 3
        self.assertEqual(self.observe('Matchmaking', seconds=9)['seconds'], 9)

    def test_no_bans_modes_require_observed_pick_activity(self):
        self.assertFalse(bans_finished(None))
        self.assertFalse(bans_finished({'timer': {'phase': 'BAN_PICK'}}))
        self.assertFalse(bans_finished(session('PLANNING')))
        self.assertTrue(bans_finished(session('PICK')))
        self.assertFalse(bans_finished(session('PICK', [True, False])))

    def test_rotate_publishes_a_stable_journey_seed_and_visual_mode(self):
        self.observe('Matchmaking', seconds=1)
        self.assertEqual(self.state.snapshot(True, 'rotate')['theme'], 'bear')
        self.assertEqual(self.state.snapshot(True, 'rotate')['theme_mode'], 'rotate')
        self.assertEqual(self.state.snapshot(True, 'phoenix')['theme_mode'], 'phoenix')
        self.observe('ChampSelect', session(bans=[False]))
        self.observe('Matchmaking', seconds=0)
        self.assertEqual(self.state.snapshot(True, 'rotate')['theme'], 'bear')
        self.observe('Lobby', search_state='Canceled')
        self.observe('Matchmaking', seconds=0)
        self.assertEqual(self.state.snapshot(True, 'rotate')['theme'], 'turtle')

    def test_transport_exports_only_local_preferences_and_search_time(self):
        reader = LeagueClient()
        reader.get = Mock(side_effect=[{'timeInQueue': 19, 'searchState': 'Searching', 'private': 'omitted'},
                                      {'localMember': {'firstPositionPreference': 'TOP', 'secondPositionPreference': 'JUNGLE', 'summonerId': 123}}])
        self.assertEqual(reader.queue_details('Matchmaking'), {'seconds': 19, 'search_state': 'Searching', 'roles_known': True, 'primary': 'TOP', 'secondary': 'JUNGLE'})
        reader.get = Mock(side_effect=[OSError('optional failed'), {'localMember': {'firstPositionPreference': 'FILL'}}])
        self.assertEqual(reader.queue_details('Matchmaking')['primary'], 'FILL')
        self.assertEqual(reader.queue_details('InProgress'), {})

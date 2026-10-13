import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

from lib.coordination.scenes import SceneDirector
from lib.coordination.game_policy import GameScenePolicy
from lib.league_client import LeagueClient
from .stage_state import StageState
from .champ_select import project
from .client_scenes import ClientScenes, DEFAULTS
from .test_client_scenes import FakeOBS, session


class StageTests(unittest.TestCase):
    def test_badge_tracks_queue_through_bans_but_not_manual_privacy(self):
        state = StageState()
        for phase, target in [('Matchmaking', 'queue'), ('ReadyCheck', 'queue'), ('ChampSelect', 'queue')]:
            state.client(phase, target, {})
            self.assertTrue(state.snapshot(True)['queue'])
        state.client('ChampSelect', 'champions', {})
        self.assertFalse(state.snapshot(True)['queue'])
        state.client('Lobby', 'queue', {})
        self.assertFalse(state.snapshot(True)['queue'])
        state.client('Matchmaking', 'queue', {})
        self.assertFalse(state.snapshot(False)['queue'])

    def test_loading_waits_for_positive_clock_and_never_reappears_on_disconnect(self):
        state = StageState()
        state.client('GameStart', None, {})
        for value in [None, True, float('nan'), 0]:
            state.live({'gameData': {'gameTime': value}})
            self.assertTrue(state.snapshot(True)['loading'])
        state.live({'gameData': {'gameTime': 1}})
        state.client('InProgress', None, {})
        self.assertFalse(state.snapshot(False)['loading'])
        state.client('Matchmaking', 'queue', {})
        self.assertFalse(state.snapshot(True)['loading'])
        state.client('GameStart', None, {})
        self.assertTrue(state.snapshot(True)['loading'])

    def test_game_admission_contract_withdraws_loading_before_routing(self):
        with tempfile.TemporaryDirectory() as folder:
            obs = FakeOBS(); reader = Mock(); watcher = self.watcher(folder, reader, obs)
            reader.snapshot.return_value = ('GameStart', None); watcher.tick()
            policy = GameScenePolicy()
            policy.register(watcher, automatic_lobbies=lambda: True, hold=lambda **kw: 0,
                            game_started=watcher.game_started)
            policy.game_started()
            watcher.director.request('Game', owner='game', automatic=True)
            watcher.tick()
            self.assertEqual(obs.scene, 'Game')
            self.assertIsNone(watcher.target)
            policy.unregister(watcher)
            watcher.stage.playing = False
            policy.game_started()
            self.assertFalse(watcher.stage.playing)

    def test_loading_retains_draft_then_enriches_gameflow_without_inventing_roles(self):
        state = StageState()
        draft = project({'myTeam': [{'cellId': 0, 'championId': 77, 'obfuscatedSummonerName': 'Gromp', 'assignedPosition': 'jungle'}]}, {'77': {'name': 'Udyr'}})
        state.client('ChampSelect', 'champions', draft)
        state.client('GameStart', None, {})
        self.assertEqual(state.roster[0]['label'], 'Gromp')
        state.client('InProgress', None, {}, {'gameData': {'teamOne': [{'championId': 77, 'summonerName': 'Spirit Walker'}]}}, {'77': {'name': 'Udyr'}})
        self.assertEqual(state.roster[0]['label'], 'Spirit Walker')
        self.assertEqual(state.roster[0]['role'], 'jungle')
        state.client('Lobby', 'idle', {})
        self.assertEqual(state.roster, [])

    def test_chat_uses_exposed_alias_then_stable_slot(self):
        reader = LeagueClient()
        reader.get = lambda path: ([{'id': 'draft', 'type': 'championSelect'}] if path.endswith('conversations') else [
            {'id': 'a', 'type': 'chat', 'body': 'Hi', 'fromSummonerId': 13},
            {'id': 'b', 'type': 'chat', 'body': 'Ready', 'fromSummonerId': 14}])
        data = {'myTeam': [{'summonerId': 13, 'obfuscatedSummonerName': 'Gromp'}, {'summonerId': 14}]}
        self.assertEqual([m['sender'] for m in reader.chat_messages(data)], ['Gromp', 'Teammate 2'])

    def watcher(self, folder, reader, obs):
        path = Path(folder)/'settings.json'
        path.write_text(json.dumps({**copy.deepcopy(DEFAULTS), 'enabled': True, 'loading_scene': 'Test'}))
        return ClientScenes(path, reader=reader, obs_factory=lambda: obs, director=SceneDirector(lambda: obs))

    def test_live_arrival_withdraws_loading_and_unchanged_phase_cannot_reclaim_game(self):
        with tempfile.TemporaryDirectory() as folder:
            obs = FakeOBS(); reader = Mock(); reader.snapshot.return_value = ('GameStart', None)
            watcher = self.watcher(folder, reader, obs)
            watcher.tick()
            self.assertEqual(watcher.target, 'loading')
            watcher.observe_live({'gameData': {'gameTime': 1}})
            watcher.director.request('Game', owner='game', automatic=True)
            watcher.tick()
            self.assertIsNone(watcher.target)
            self.assertEqual(obs.scene, 'Game')

    def test_loading_respects_newer_manual_choice_during_read(self):
        with tempfile.TemporaryDirectory() as folder:
            obs = FakeOBS(); reader = Mock(); watcher = self.watcher(folder, reader, obs)
            def read():
                watcher.director.request('Manual', owner='user', automatic=False)
                return 'GameStart', None
            reader.snapshot.side_effect = read
            watcher.tick()
            self.assertEqual(obs.scene, 'Manual')

    def test_game_clock_releases_manual_loading_even_with_same_client_phase(self):
        with tempfile.TemporaryDirectory() as folder:
            obs = FakeOBS(); reader = Mock(); watcher = self.watcher(folder, reader, obs)
            reader.snapshot.return_value = ('GameStart', None)
            watcher.tick(); watcher.present_stage('loading')
            watcher.game_started()
            watcher.director.request('Game', owner='game', automatic=True)
            watcher.tick()
            self.assertIsNone(watcher.manual_choice)
            self.assertIsNone(watcher.target)
            self.assertEqual(obs.scene, 'Game')

    def test_dodge_withdraws_loading_under_hold(self):
        with tempfile.TemporaryDirectory() as folder:
            obs = FakeOBS(); reader = Mock(); watcher = self.watcher(folder, reader, obs)
            hold = watcher.director.hold_automatic('user')
            reader.snapshot.return_value = ('GameStart', None); watcher.tick()
            reader.snapshot.return_value = ('Matchmaking', None); watcher.tick()
            watcher.director.release_automatic(hold, resume=True)
            self.assertEqual(obs.scene, 'Lobbies')

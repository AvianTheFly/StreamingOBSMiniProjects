import copy
import io
import json
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from lib.league_client import LeagueClient
from lib.coordination.scenes import SceneDirector
from .client_scenes import ClientScenes, DEFAULTS, apply_scene, route
from .champ_select import project, ChampSelectState, THEMES


def session(phase='BAN_PICK', bans=None):
    return {'timer': {'phase': phase}, 'actions': [[
        *([{'type': 'ban', 'completed': b} for b in bans] if bans is not None else []),
        {'type': 'pick', 'completed': False, 'isInProgress': True},
    ]]}


class FakeOBS:
    def __init__(self):
        self.scene = 'Test'
        self.writes = []
        self.items = [dict(sourceName=n, sceneItemId=i, sceneItemEnabled=True, isGroup=True)
                      for i, n in enumerate(['TavernLobby', 'LOL champ select', 'FutureLobby'])]
        self.items.append(dict(sourceName='soundboard', sceneItemId=9, sceneItemEnabled=True))
        self.children = [dict(sourceName=n, sceneItemId=20+i, sceneItemEnabled=True)
                         for i, n in enumerate(DEFAULTS['hidden_queue_sources'])]

    def get_scene_list(self):
        return SimpleNamespace(scenes=[{'sceneName': n} for n in ['Lobbies', 'just screen', 'Test']])

    def get_scene_item_list(self, scene):
        return SimpleNamespace(scene_items=self.items)

    def get_group_scene_item_list(self, group):
        return SimpleNamespace(scene_items=self.children)

    def get_current_program_scene(self):
        return SimpleNamespace(current_program_scene_name=self.scene)

    def set_scene_item_enabled(self, owner, item, enabled):
        self.writes.append((owner, item, enabled))
        for row in self.items + self.children:
            if row['sceneItemId'] == item:
                row['sceneItemEnabled'] = enabled

    def set_current_program_scene(self, scene):
        self.writes.append(('scene', scene))
        self.scene = scene


class ClientSceneTests(unittest.TestCase):
    def test_draft_has_five_picks_and_bans_on_each_side(self):
        draft = {
            'myTeam': [{'cellId': i} for i in range(5)],
            'theirTeam': [{'cellId': i} for i in range(5, 10)],
            'localPlayerCellId': 2,
            'actions': [[
                {'actorCellId': 2, 'type': 'pick', 'championId': 103, 'completed': False},
                {'actorCellId': 7, 'type': 'pick', 'championId': 266, 'completed': True},
                {'actorCellId': 1, 'type': 'ban', 'championId': 238, 'completed': True},
                {'actorCellId': 8, 'type': 'ban', 'championId': 555, 'completed': True},
            ]],
            'bans': {'myTeamBans': [238], 'theirTeamBans': [555]},
            'timer': {'phase': 'PICK', 'adjustedTimeLeftInPhaseInSec': 21},
        }
        result = project(draft, {'103': {'name': 'Ahri'}, '266': {'name': 'Aatrox'}})
        self.assertTrue(all(len(result[key]) == 5 for key in ('allies','enemies','allyBans','enemyBans')))
        self.assertEqual(result['allies'][2]['name'], 'Ahri')
        self.assertFalse(result['allies'][2]['locked'])
        self.assertEqual(result['enemies'][2]['name'], 'Aatrox')
        self.assertTrue(result['enemies'][2]['locked'])
        self.assertEqual(result['allyBans'][0]['championId'], 238)
        self.assertEqual(result['enemyBans'][0]['championId'], 555)
        self.assertEqual(result['localSlot'], 2)

    def test_draft_overlay_redacts_during_bans(self):
        with tempfile.TemporaryDirectory() as folder:
            state = ChampSelectState(folder)
            state.update('ChampSelect', {'gameId': 19, 'myTeam': [{'cellId': 0, 'championId': 103}]},
                         'random', [{'id': '1', 'body': 'private', 'sender': '2'}])
            hidden = state.snapshot(False)
            self.assertEqual(hidden['chat'], [])
            self.assertEqual(hidden['draft']['allies'][0]['championId'], 0)
            self.assertIn(state.snapshot(True)['theme'], THEMES)

    def test_draft_timer_counts_down_between_client_events(self):
        with tempfile.TemporaryDirectory() as folder:
            state = ChampSelectState(folder)
            draft = {'gameId': 19, 'timer': {'phase': 'PICK', 'adjustedTimeLeftInPhaseInSec': 30}}
            with patch('league_api.champ_select.time.monotonic', return_value=100):
                state.update('ChampSelect', draft)
            with patch('league_api.champ_select.time.monotonic', return_value=103.2):
                self.assertEqual(state.snapshot(True)['draft']['seconds'], 27)
                state.update('ChampSelect', draft)
            with patch('league_api.champ_select.time.monotonic', return_value=105):
                self.assertEqual(state.snapshot(True)['draft']['seconds'], 25)
            draft['timer']['adjustedTimeLeftInPhaseInSec'] = 40
            with patch('league_api.champ_select.time.monotonic', return_value=106):
                state.update('ChampSelect', draft)
                self.assertEqual(state.snapshot(True)['draft']['seconds'], 40)

    def test_live_timer_uses_milliseconds_and_turn_timestamp(self):
        with tempfile.TemporaryDirectory() as folder:
            state = ChampSelectState(folder)
            draft = {'gameId': 19, 'timer': {'phase': 'BAN_PICK',
                     'adjustedTimeLeftInPhase': 30000, 'internalNowInEpochMs': 100000}}
            with patch('league_api.champ_select.time.monotonic', return_value=10), \
                 patch('league_api.champ_select.time.time', return_value=103):
                state.update('ChampSelect', draft)
                self.assertEqual(state.snapshot(True)['draft']['seconds'], 27)
            with patch('league_api.champ_select.time.monotonic', return_value=15):
                self.assertEqual(state.snapshot(True)['draft']['seconds'], 22)
            draft['timer']['internalNowInEpochMs'] = 120000
            with patch('league_api.champ_select.time.monotonic', return_value=20), \
                 patch('league_api.champ_select.time.time', return_value=120):
                state.update('ChampSelect', draft)
                self.assertEqual(state.snapshot(True)['draft']['seconds'], 30)

    def test_custom_champion_scene_keeps_queue_group_private(self):
        obs = FakeOBS()
        original_scenes = obs.get_scene_list
        obs.get_scene_list = lambda: SimpleNamespace(scenes=[*original_scenes().scenes,
                                                               {'sceneName': 'League Champion Select World'}])
        settings = {**DEFAULTS, 'champion_scene': 'League Champion Select World'}
        apply_scene(obs, settings, 'queue')
        self.assertEqual(obs.scene, 'Lobbies')
        self.assertFalse(obs.items[1]['sceneItemEnabled'])
        apply_scene(obs, settings, 'champions')
        self.assertEqual(obs.scene, 'League Champion Select World')
        self.assertFalse(obs.items[1]['sceneItemEnabled'])

    def test_only_champion_select_chat_is_exposed(self):
        reader = LeagueClient()
        responses = {
            '/lol-chat/v1/conversations': [
                {'id': 'friend', 'type': 'chat'},
                {'id': 'draft-room', 'type': 'championSelect'}],
            '/lol-chat/v1/conversations/draft-room/messages': [
                {'id': '1', 'body': 'Ready to pick?', 'fromSummonerId': 42, 'type': 'chat'},
                {'id': '2', 'body': 'system notice', 'type': 'system'}],
        }
        reader.get = lambda path: responses[path]
        messages = reader.chat_messages({'chatDetails': {'chatRoomName': 'draft-room',
                                                         'chatRoomPassword': 'secret'},
                                         'localPlayerCellId': 0,
                                         'myTeam': [{'cellId': 0, 'summonerId': 42}]})
        self.assertEqual(messages, [{'id': '1', 'body': 'Ready to pick?', 'sender': 'YOU'}])
        self.assertNotIn('secret', str(messages))

    def test_chat_room_jid_and_groupchat_message(self):
        reader = LeagueClient()
        reader.get = lambda path: (
            [{'id': 'other', 'type': 'chat'},
             {'id': 'draft-room@conference.local', 'type': 'championSelect'}]
            if path == '/lol-chat/v1/conversations' else
            [{'id': '3', 'body': 'test message', 'type': 'groupchat'}])
        self.assertEqual(reader.chat_messages({'chatDetails': {'chatRoomName': 'draft-room'}}),
                         [{'id': '3', 'body': 'test message', 'sender': 'TEAM'}])

    def test_phase_routes_and_bans_wait_for_both_teams(self):
        for phase in ['Matchmaking', 'ReadyCheck']:
            self.assertEqual(route(phase), 'queue')
        self.assertEqual(route('ChampSelect', session('PLANNING', [False])), 'queue')
        self.assertEqual(route('ChampSelect', session(bans=[True, False])), 'queue')
        self.assertEqual(route('ChampSelect', session(bans=[True, True])), 'champions')
        self.assertEqual(route('ChampSelect', session()), 'queue')
        self.assertEqual(route('ChampSelect', session('PICK')), 'champions')
        self.assertEqual(route('ChampSelect', session('PLANNING')), 'queue')
        self.assertEqual(route('ChampSelect', session('FINALIZATION')), 'champions')
        for phase in ['None', 'Lobby', 'WaitingForStats', 'EndOfGame']:
            self.assertEqual(route(phase), 'idle')
        for phase in ['InProgress', 'GameStart', 'Reconnect', 'Unknown']:
            self.assertIsNone(route(phase))
        self.assertEqual(route('ChampSelect', None), 'queue')

    def test_existing_groups_and_child_visibility_without_touching_other_sources(self):
        obs = FakeOBS()
        apply_scene(obs, DEFAULTS, 'queue')
        self.assertEqual(obs.scene, 'Lobbies')
        self.assertEqual([i['sceneItemEnabled'] for i in obs.items[:3]], [True, False, False])
        self.assertTrue(obs.items[-1]['sceneItemEnabled'])
        self.assertTrue(all(not i['sceneItemEnabled'] for i in obs.children))
        apply_scene(obs, DEFAULTS, 'champions')
        self.assertEqual([i['sceneItemEnabled'] for i in obs.items[:3]], [False, True, False])
        apply_scene(obs, DEFAULTS, 'idle')
        self.assertEqual(obs.scene, 'just screen')

    def test_missing_source_is_reported_before_any_obs_mutation(self):
        obs = FakeOBS(); obs.children.pop()
        with self.assertRaisesRegex(ValueError, 'missing'):
            apply_scene(obs, DEFAULTS, 'queue')
        self.assertEqual(obs.writes, [])

    def make_watcher(self, folder, reader, obs, now):
        path = Path(folder) / 'settings.json'
        path.write_text(json.dumps({**copy.deepcopy(DEFAULTS), 'enabled': True}))
        return ClientScenes(path, reader=reader, obs_factory=lambda: obs, clock=lambda: now[0],
                            director=SceneDirector(lambda: obs))

    def test_queue_bans_picks_dodge_without_reasserting_over_manual_scene(self):
        with tempfile.TemporaryDirectory() as folder:
            reader = Mock(); obs = FakeOBS(); now = [0]
            watcher = self.make_watcher(folder, reader, obs, now)
            reader.snapshot.return_value = ('Matchmaking', None); watcher.tick()
            watcher.director.request('Manual', owner='user', automatic=False); writes = len(obs.writes)
            watcher.apply_pending(verify_active=True)
            self.assertEqual(obs.scene, 'Manual'); self.assertEqual(len(obs.writes), writes)
            reader.snapshot.return_value = ('ChampSelect', session(bans=[False])); watcher.tick()
            self.assertEqual(obs.scene, 'Manual'); self.assertEqual(len(obs.writes), writes)
            reader.snapshot.return_value = ('ChampSelect', session(bans=[True])); watcher.tick()
            self.assertEqual(obs.scene, 'Lobbies')
            reader.snapshot.return_value = ('Lobby', None); watcher.tick()
            self.assertEqual(obs.scene, 'just screen')

    def test_active_draft_does_not_reclaim_another_scene_choice(self):
        with tempfile.TemporaryDirectory() as folder:
            reader = Mock(); obs = FakeOBS(); now = [0]
            watcher = self.make_watcher(folder, reader, obs, now)
            watcher.settings['champion_scene'] = 'League Champion Select World'
            original_scenes = obs.get_scene_list
            obs.get_scene_list = lambda: SimpleNamespace(scenes=[*original_scenes().scenes,
                                                                   {'sceneName': 'League Champion Select World'}])
            reader.snapshot.return_value = ('ChampSelect', session('PICK'))
            reader.chat_messages.return_value = []
            watcher.tick()
            self.assertEqual(obs.scene, 'League Champion Select World')
            obs.scene = 'Test'
            watcher.apply_pending(verify_active=True)
            self.assertEqual(obs.scene, 'Test')
            obs.scene = 'InstantReplay'
            watcher.apply_pending(verify_active=True)
            self.assertEqual(obs.scene, 'InstantReplay')

    def test_replay_active_defers_phase_change_until_playback_ends(self):
        with tempfile.TemporaryDirectory() as folder:
            reader = Mock(); obs = FakeOBS(); now = [0]
            watcher = self.make_watcher(folder, reader, obs, now)
            reader.snapshot.return_value = ('Lobby', None); watcher.tick()
            reader.snapshot.return_value = ('Matchmaking', None)
            lease = watcher.director.reserve('replay', 'InstantReplay', 'Test')
            watcher.director.activate(lease)
            with patch.dict('instant_replay.interface._live', {'replay_active': [True]}):
                writes = len(obs.writes)
                watcher.tick(); watcher.tick()
                self.assertEqual(obs.scene, 'InstantReplay')
                self.assertEqual(len(obs.writes), writes)
                self.assertEqual(watcher.target, 'queue')
                self.assertEqual(watcher.applied, 'idle')
            # Playback flag can clear just before the replay scene exits.
            watcher.tick(); self.assertEqual(obs.scene, 'InstantReplay')
            watcher.director.finish(lease)
            watcher.tick(); self.assertEqual(obs.scene, 'Lobbies')
            writes = len(obs.writes)
            watcher.tick(); watcher.tick()
            self.assertEqual(len(obs.writes), writes)

    def test_replay_scene_is_not_interrupted_by_manual_hide_or_show(self):
        with tempfile.TemporaryDirectory() as folder:
            reader = Mock(); obs = FakeOBS(); now = [0]
            watcher = self.make_watcher(folder, reader, obs, now)
            reader.snapshot.return_value = ('Lobby', None)
            obs.scene = 'InstantReplay'
            with self.assertRaisesRegex(ValueError, 'Instant Replay'):
                watcher.hide_now()
            with self.assertRaisesRegex(ValueError, 'Instant Replay'):
                watcher.show_screen()
            self.assertEqual(obs.scene, 'InstantReplay')

    def test_client_outage_keeps_private_scene_and_game_untouched(self):
        with tempfile.TemporaryDirectory() as folder:
            reader = Mock(); obs = FakeOBS(); now = [0]
            watcher = self.make_watcher(folder, reader, obs, now)
            reader.snapshot.return_value = ('Matchmaking', None); watcher.tick()
            reader.snapshot.side_effect = OSError('closed'); watcher.tick()
            now[0] = 4; watcher.tick(); self.assertEqual(obs.scene, 'Lobbies')
            now[0] = 6; watcher.tick(); self.assertEqual(obs.scene, 'Lobbies')
            self.assertIn('keeping current scene private', watcher.status)
            watcher.show_screen(); self.assertEqual(obs.scene, 'just screen')
            reader.snapshot.side_effect = None
            reader.snapshot.return_value = ('InProgress', None)
            watcher.director.request('Test', owner='game')
            watcher.tick()
            reader.snapshot.side_effect = OSError('closed'); watcher.tick()
            now[0] = 20; watcher.tick(); self.assertEqual(obs.scene, 'Test')
            reader.snapshot.side_effect = None
            reader.snapshot.return_value = ('EndOfGame', None); watcher.tick()
            self.assertEqual(obs.scene, 'just screen')

    def test_manual_hide_before_find_match_holds_until_queue_then_restores_after_dodge(self):
        with tempfile.TemporaryDirectory() as folder:
            reader = Mock(); obs = FakeOBS(); now = [0]
            watcher = self.make_watcher(folder, reader, obs, now)
            reader.snapshot.return_value = ('Lobby', None)
            watcher.tick(); self.assertEqual(obs.scene, 'just screen')
            state = watcher.hide_now()
            self.assertTrue(state['privacy_armed']); self.assertEqual(obs.scene, 'Lobbies')
            watcher.tick(); self.assertEqual(obs.scene, 'Lobbies')
            reader.snapshot.return_value = ('Matchmaking', None); watcher.tick()
            self.assertFalse(watcher.privacy_armed)
            reader.snapshot.return_value = ('ReadyCheck', None); watcher.tick()
            self.assertEqual(obs.scene, 'Lobbies')
            reader.snapshot.return_value = ('ChampSelect', None); watcher.tick()
            self.assertEqual(obs.scene, 'Lobbies')
            reader.snapshot.return_value = ('ChampSelect', session(bans=[False, True])); watcher.tick()
            self.assertEqual(obs.scene, 'Lobbies')
            reader.snapshot.return_value = ('ChampSelect', session(bans=[True, True])); watcher.tick()
            self.assertTrue(obs.items[1]['sceneItemEnabled'])
            reader.snapshot.return_value = ('Lobby', None); watcher.tick()
            self.assertEqual(obs.scene, 'just screen')
            watcher.hide_now(); watcher.show_screen()
            self.assertFalse(watcher.privacy_armed); self.assertEqual(obs.scene, 'just screen')

    def test_hide_now_refuses_game_and_show_screen_refuses_active_queue(self):
        with tempfile.TemporaryDirectory() as folder:
            reader = Mock(); obs = FakeOBS(); now = [0]
            watcher = self.make_watcher(folder, reader, obs, now)
            reader.snapshot.return_value = ('InProgress', None)
            with self.assertRaises(ValueError): watcher.hide_now()
            reader.snapshot.return_value = ('Matchmaking', None)
            with self.assertRaises(ValueError): watcher.show_screen()
            self.assertEqual(obs.writes, [])

    def test_retry_failure_and_pause_persist_without_scene_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            reader = Mock(); reader.snapshot.return_value = ('Matchmaking', None)
            obs = FakeOBS(); now = [0]; watcher = self.make_watcher(folder, reader, obs, now)
            watcher.obs_factory = Mock(side_effect=RuntimeError('OBS offline'))
            watcher.tick(); self.assertEqual(watcher.error, 'OBS offline')
            watcher.obs_factory = lambda: obs
            now[0] = 6; watcher.tick(); self.assertIsNone(watcher.error)
            with patch('lib.settings_backups.SettingsBackups') as backup:
                watcher.configure({'enabled': False}); backup.return_value.snapshot.assert_called_once()
            reader.snapshot.return_value = ('Lobby', None); watcher.tick()
            self.assertEqual(obs.scene, 'Lobbies')
            self.assertFalse(json.loads(watcher.path.read_text())['enabled'])
            for body in [{'enabled': 'yes'}, {'enabled': True, 'extra': 1}]:
                with self.assertRaises(ValueError): watcher.configure(body)

    def test_lockfile_credentials_rotate_and_only_loopback_is_requested(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'lockfile'
            path.write_text('LeagueClient:1:49983:first:https')
            reader = LeagueClient(); reader.path = path; reader.opener = Mock()
            reader.opener.open.side_effect = lambda *a, **k: io.BytesIO(b'"Lobby"')
            self.assertEqual(reader.snapshot(), ('Lobby', None))
            first = reader.opener.open.call_args.args[0]
            path.write_text('LeagueClient:1:49984:second:https'); reader.snapshot()
            second = reader.opener.open.call_args.args[0]
            self.assertEqual(second.full_url, 'https://127.0.0.1:49984/lol-gameflow/v1/gameflow-phase')
            self.assertNotEqual(first.headers['Authorization'], second.headers['Authorization'])

    def test_champ_session_endpoint_delay_keeps_scene_private(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'lockfile'
            path.write_text('LeagueClient:1:49983:first:https')
            reader = LeagueClient(); reader.path = path; reader.opener = Mock()
            def response(request, **kwargs):
                if request.full_url.endswith('/session'):
                    raise OSError('session not ready')
                return io.BytesIO(b'"ChampSelect"')
            reader.opener.open.side_effect = response
            phase, data = reader.snapshot()
            self.assertEqual((phase, data), ('ChampSelect', None))
            self.assertEqual(route(phase, data), 'queue')

    def test_client_event_subscription_and_filter(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'lockfile'
            path.write_text('LeagueClient:1:49983:first:https')
            reader = LeagueClient(); reader.path = path
            connection = Mock()
            with patch('lib.league_client.websocket.create_connection', return_value=connection) as create:
                self.assertIs(reader.connect_events(), connection)
            self.assertEqual(create.call_args.args[0], 'wss://127.0.0.1:49983/')
            self.assertNotIn('first', str(create.call_args))
            connection.send.assert_called_once_with('[5, "OnJsonApiEvent"]')
            connection.settimeout.assert_called_once_with(.5)
            self.assertTrue(reader.relevant_event('[8,"OnJsonApiEvent",{"uri":"/lol-gameflow/v1/gameflow-phase"}]'))
            self.assertTrue(reader.relevant_event('[8,"OnJsonApiEvent",{"uri":"/lol-champ-select/v1/session"}]'))
            self.assertTrue(reader.relevant_event('[8,"OnJsonApiEvent",{"uri":"/lol-chat/v1/conversations"}]'))
            self.assertFalse(reader.relevant_event('garbage'))

    def test_event_loop_reads_initial_and_relevant_events_only(self):
        with tempfile.TemporaryDirectory() as folder:
            obs = FakeOBS(); now = [0]; stop = threading.Event()
            reader = Mock(); reader.snapshot.side_effect = [('Lobby', None), ('Lobby', None), ('Matchmaking', None)]
            reader.relevant_event = LeagueClient.relevant_event
            events = iter(['[8,"OnJsonApiEvent",{"uri":"/lol-chat/v1/conversations"}]',
                           '[8,"OnJsonApiEvent",{"uri":"/lol-gameflow/v1/gameflow-phase"}]'])
            connection = Mock()
            def receive():
                message = next(events)
                if 'gameflow-phase' in message:
                    stop.set()
                return message
            connection.recv.side_effect = receive
            reader.connect_events.return_value = connection
            watcher = self.make_watcher(folder, reader, obs, now)
            watcher.run(stop, threading.Event())
            self.assertEqual(reader.snapshot.call_count, 3)
            self.assertEqual(obs.scene, 'Lobbies')
            connection.close.assert_called_once()


if __name__ == '__main__':
    unittest.main()

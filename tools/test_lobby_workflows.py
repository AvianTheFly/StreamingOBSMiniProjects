"""Exercise real client policy, lobby preparation and scene leases together."""
import copy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from lib.coordination.lobbies import LobbyCatalog
from lib.coordination.scenes import SceneDirector
from lib.display_capture import CAPTURE_SCENE, CAPTURE_SOURCE
from league_api.client_scenes import ClientScenes, DEFAULTS
from league_api.test_client_scenes import session


class WorldOBS:
    names = ('TavernLobby', 'ForgeLobby', 'StormCoastLobby', 'PhoenixObservatoryLobby')

    def __init__(self):
        self.scene = 'Test'
        self.writes = []
        self.items = [dict(sourceName=n, sceneItemId=i, sceneItemEnabled=i == 0,
                           isGroup=n == 'TavernLobby') for i, n in enumerate(self.names)]
        self.items.extend([dict(sourceName='LOL champ select', sceneItemId=10, sceneItemEnabled=False),
                           dict(sourceName='soundboard', sceneItemId=11, sceneItemEnabled=True)])
        self.capture = [dict(sourceName=CAPTURE_SOURCE, sceneItemId=99, sceneItemEnabled=True)]
        self.children = [dict(sourceName='league client', sceneItemId=50, sceneItemEnabled=True)]

    def get_scene_list(self):
        return SimpleNamespace(scenes=[{'sceneName': n} for n in
                                       ('Test', 'Lobbies', 'just screen', 'Draft', 'InstantReplay')])

    def get_scene_item_list(self, name):
        return SimpleNamespace(scene_items=self.capture if name == CAPTURE_SCENE else self.items)

    def get_group_scene_item_list(self, name):
        return SimpleNamespace(scene_items=self.children)

    def get_current_program_scene(self):
        return SimpleNamespace(current_program_scene_name=self.scene)

    def set_current_program_scene(self, name):
        self.scene = name; self.writes.append(('scene', name))

    def set_scene_item_enabled(self, scene, identifier, enabled):
        self.writes.append((scene, identifier, enabled))
        for row in self.items + self.capture + self.children:
            if row['sceneItemId'] == identifier:
                row['sceneItemEnabled'] = enabled

    def selected(self):
        return [r['sourceName'] for r in self.items if r['sourceName'] in self.names and r['sceneItemEnabled']]


class LobbyWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(); self.addCleanup(self.folder.cleanup)
        self.obs = WorldOBS(); self.reader = Mock(); self.reader.chat_messages.return_value = []
        self.director = SceneDirector(lambda: self.obs)
        self.path = Path(self.folder.name) / 'client.json'
        self.path.write_text(json.dumps({**copy.deepcopy(DEFAULTS), 'enabled': True,
                                        'idle_presentation': 'lobby', 'champion_scene': 'Draft',
                                        'personal_extension': {'keep': 17}}))
        self.remaining = 0
        self.watcher = ClientScenes(self.path, self.reader, lambda: self.obs,
                                    scene_hold=lambda **kw: self.remaining, director=self.director)
        catalog = LobbyCatalog(); catalog.publish('worlds', 'Lobbies', self.obs.names,
                                                   exclusions=('LOL champ select',))
        patcher = patch('league_api.scene_routing.lobby_catalog', catalog)
        patcher.start(); self.addCleanup(patcher.stop)

    def phase(self, phase, draft=None):
        self.reader.snapshot.return_value = (phase, draft); self.watcher.tick()

    def test_idle_queue_draft_game_result_flow_rotates_only_on_entry(self):
        self.phase('Lobby'); first = self.obs.selected()
        self.assertEqual(len(first), 1); self.assertEqual(self.obs.scene, 'Lobbies')
        self.assertFalse(self.obs.capture[0]['sceneItemEnabled'])
        self.assertTrue(self.obs.items[-1]['sceneItemEnabled'])
        self.phase('Matchmaking'); queue = self.obs.selected(); self.assertNotEqual(first, queue)
        before = list(self.obs.writes)
        self.phase('ReadyCheck'); self.phase('ChampSelect', session(bans=[False]))
        self.assertEqual(self.obs.writes, before)
        self.phase('ChampSelect', session(bans=[True])); self.assertEqual(self.obs.scene, 'Draft')
        self.phase('InProgress'); self.director.request('Test', owner='game')
        self.remaining = 6.5; self.phase('WaitingForStats')
        self.assertEqual(self.obs.scene, 'Test')
        self.phase('EndOfGame'); self.assertEqual(self.obs.scene, 'Test')
        self.remaining = 0; self.watcher.apply_pending()
        self.assertEqual(self.obs.scene, 'Lobbies'); self.assertNotEqual(self.obs.selected(), queue)
        before = list(self.obs.writes)
        self.phase('Lobby'); self.phase('None'); self.watcher.apply_pending(verify_active=True)
        self.assertEqual(self.obs.writes, before)

    def test_new_manual_choice_during_result_hold_cancels_idle_without_hiding_screen(self):
        self.phase('InProgress'); self.remaining = 5; self.phase('WaitingForStats')
        self.director.request('just screen', owner='user', automatic=False)
        before = list(self.obs.writes); self.remaining = 0
        self.watcher.apply_pending(); self.phase('Lobby')
        self.assertEqual(self.obs.writes, before)
        self.assertTrue(self.obs.capture[0]['sceneItemEnabled'])
        self.assertEqual(self.obs.scene, 'just screen')
        self.phase('Matchmaking'); self.assertEqual(self.obs.scene, 'Lobbies')

    def test_pending_idle_waits_for_replay_and_survives_owned_return(self):
        self.phase('InProgress')
        lease = self.director.reserve('replay', 'InstantReplay', 'Test'); self.director.activate(lease)
        before = list(self.obs.writes); self.phase('EndOfGame')
        self.assertEqual(self.obs.writes, before)
        self.director.finish(lease); self.watcher.apply_pending()
        self.assertEqual(self.obs.scene, 'Lobbies')

    def test_manual_choice_during_replay_prevents_late_idle(self):
        self.phase('InProgress')
        lease = self.director.reserve('replay', 'InstantReplay', 'Test'); self.director.activate(lease)
        self.phase('EndOfGame'); self.director.request('Draft', owner='user', automatic=False)
        before = list(self.obs.writes); self.director.finish(lease); self.watcher.apply_pending()
        self.assertEqual(self.obs.writes, before); self.assertEqual(self.obs.scene, 'Draft')

    def test_scene_choice_during_slow_phase_read_rejects_result_before_preparation(self):
        self.phase('InProgress')
        def read():
            self.director.request('Draft', owner='user', automatic=False)
            return 'EndOfGame', None
        self.reader.snapshot.side_effect = read; self.watcher.tick()
        self.assertEqual(self.obs.writes, [('scene', 'Draft')])

    def test_show_screen_reveals_same_lobby_and_polling_preserves_it(self):
        self.phase('Lobby'); before = self.obs.selected()
        self.watcher.show_screen(); self.phase('Lobby')
        self.assertEqual(self.obs.selected(), before)
        self.assertTrue(self.obs.capture[0]['sceneItemEnabled'])
        self.assertEqual(self.obs.scene, 'Lobbies')
        self.phase('Matchmaking'); self.assertFalse(self.obs.capture[0]['sceneItemEnabled'])

    def test_settings_keep_custom_idle_scene_unknown_data_and_malformed_file(self):
        self.phase('InProgress')
        self.watcher.configure({'idle_presentation': 'scene'})
        saved = json.loads(self.path.read_text())
        self.assertEqual(saved['idle_scene'], 'just screen')
        self.assertEqual(saved['personal_extension'], {'keep': 17})
        self.phase('EndOfGame'); self.assertEqual(self.obs.scene, 'just screen')
        self.path.write_text('{personal broken file')
        with self.assertRaises(ValueError): self.watcher.configure({'idle_presentation': 'lobby'})
        self.assertEqual(self.path.read_text(), '{personal broken file')

    def test_art_expansion_leaves_existing_location_placements_and_layers_untouched(self):
        from tools import install_lobby_scenes as installer
        art = Path(self.folder.name)
        for layer in ('base', 'foreground', 'foreground-cutout'):
            (art / f'personal-{layer}.png').write_bytes(b'art')
        client = Mock()
        client.get_scene_list.return_value = SimpleNamespace(scenes=[{'sceneName': n} for n in
                                           ('Lobbies', CAPTURE_SCENE, 'FaceCamWithProps', 'PersonalLobby')])
        layers = ('PersonalLobby Base', CAPTURE_SCENE, 'FaceCamWithProps',
                  'PersonalLobby Foreground', installer.CHAT_SOURCE)
        rows = [dict(sourceName=n, sceneItemId=i, sceneItemTransform={'positionX': 999},
                      sceneItemEnabled=False) for i, n in enumerate(layers)]
        client.get_scene_item_list.side_effect = lambda name: SimpleNamespace(scene_items=
            [dict(sourceName='PersonalLobby', sceneItemId=45)] if name == 'Lobbies' else rows)
        with patch.object(installer, 'ART', art):
            installer.install_locations(client, [('PersonalLobby', 'personal', (0, 0, 100, 100),
                                                  (0, 0, 100, 100), (0, 0, 100, 100))])
        for method in ('set_scene_item_transform', 'set_scene_item_index', 'set_scene_item_enabled',
                       'set_scene_item_locked', 'create_input', 'create_scene_item', 'set_input_settings'):
            getattr(client, method).assert_not_called()


if __name__ == '__main__':
    unittest.main()

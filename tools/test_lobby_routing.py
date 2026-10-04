"""Lobby ownership, deferred preparation and shared desktop visibility regressions."""
import queue
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from lib.coordination.scenes import SceneDirector
from lib.coordination.lobbies import LobbyCatalog, prepare_lobby
from lib.display_capture import set_visible, CAPTURE_SCENE, CAPTURE_SOURCE
from lib.paths import ensure_import_paths
ensure_import_paths()


class FakeOBS:
    def __init__(self):
        self.scene = 'Test'
        self.items = [dict(sourceName=n, sceneItemId=i, sceneItemEnabled=i == 0)
                      for i, n in enumerate(('TavernLobby', 'ForgeLobby', 'SanctuaryLobby',
                                              'LOL champ select', 'soundboard'))]
        self.items[-1]['sceneItemEnabled'] = True
        self.capture = [dict(sourceName=CAPTURE_SOURCE, sceneItemId=99, sceneItemEnabled=True)]
        self.writes = []

    def get_scene_item_list(self, scene):
        return SimpleNamespace(scene_items=self.capture if scene == CAPTURE_SCENE else self.items)

    def get_current_program_scene(self):
        return SimpleNamespace(current_program_scene_name=self.scene)

    def set_current_program_scene(self, scene):
        self.scene = scene
        self.writes.append(('scene', scene))

    def set_scene_item_enabled(self, scene, item_id, enabled):
        self.writes.append((scene, item_id, enabled))
        for row in self.get_scene_item_list(scene).scene_items:
            if row['sceneItemId'] == item_id:
                row['sceneItemEnabled'] = enabled


class LobbyRoutingTests(unittest.TestCase):
    names = ('TavernLobby', 'ForgeLobby', 'SanctuaryLobby')

    def test_initial_scene_observation_reads_without_writing_or_claiming(self):
        obs=FakeOBS();director=SceneDirector(lambda:obs)
        director.observing(True)
        self.assertEqual(director.refresh_observation(),obs.scene)
        self.assertEqual(obs.writes,[])
        self.assertEqual(director.snapshot()['revision'],0)
        self.assertIsNone(director.snapshot()['temporary_owner'])
        obs.scene='Manual'
        director.refresh_observation()
        self.assertEqual(director.snapshot()['manual_revision'],1)
        self.assertEqual(obs.writes,[])

    def test_random_entry_avoids_current_location_and_preserves_overlays(self):
        obs = FakeOBS()
        picked = prepare_lobby(obs, 'Lobbies', self.names, exclusions=('LOL champ select',), chooser=lambda n: n[0])
        self.assertEqual(picked, 'ForgeLobby')
        self.assertTrue(obs.items[-1]['sceneItemEnabled'])
        self.assertEqual([i['sourceName'] for i in obs.items[:-1] if i['sceneItemEnabled']], ['ForgeLobby'])

    def test_stale_return_never_mutates_lobby_or_screen(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        revision = director.snapshot()['revision']
        director.request('Manual', owner='user', automatic=False)
        before = list(obs.writes)
        self.assertFalse(director.request('Lobbies', owner='return', expected_revision=revision,
            prepare=lambda c: prepare_lobby(c, 'Lobbies', self.names, hide_screen=True)))
        self.assertEqual(obs.writes, before)

    def test_manual_guard_survives_temporary_activation_and_return(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        manual = director.snapshot()['manual_revision']
        lease = director.reserve('replay', 'InstantReplay', 'Test')
        director.activate(lease); director.finish(lease)
        self.assertTrue(director.request('Lobbies', owner='idle', expected_manual_revision=manual,
            prepare=lambda c: prepare_lobby(c, 'Lobbies', self.names, hide_screen=True)))
        self.assertEqual(obs.scene, 'Lobbies'); self.assertFalse(obs.capture[0]['sceneItemEnabled'])

    def test_same_scene_manual_selection_invalidates_delayed_visibility(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        manual = director.snapshot()['manual_revision']
        director.request('Test', owner='user', automatic=False)
        before = list(obs.writes)
        self.assertFalse(director.request('Lobbies', owner='idle', expected_manual_revision=manual,
            prepare=lambda c: prepare_lobby(c, 'Lobbies', self.names, hide_screen=True)))
        self.assertEqual(obs.writes, before)

    def test_observed_outside_choice_invalidates_old_but_accepts_new_transition(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        director.request('Test', owner='initial')
        old = director.snapshot()['manual_revision']
        obs.scene = 'Manual'; director.observe('Manual')
        current = director.snapshot()['manual_revision']
        self.assertFalse(director.request('Lobbies', owner='old', expected_manual_revision=old))
        self.assertTrue(director.request('Lobbies', owner='new', expected_manual_revision=current))

    def test_deferred_lobby_prepares_only_when_temporary_owner_finishes(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        lease = director.reserve('replay', 'InstantReplay', 'Test'); director.activate(lease)
        before = list(obs.writes)
        self.assertFalse(director.request('Lobbies', owner='return', defer=True,
            prepare=lambda c: prepare_lobby(c, 'Lobbies', self.names, selected='ForgeLobby')))
        self.assertEqual(obs.writes, before)
        director.finish(lease)
        self.assertEqual(obs.scene, 'Lobbies')
        self.assertTrue(obs.items[1]['sceneItemEnabled'])

    def test_deliberate_choice_invalidates_queued_return(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        lease = director.reserve('replay', 'InstantReplay', 'Test'); director.activate(lease)
        director.request('Lobbies', owner='return', defer=True,
            prepare=lambda c: prepare_lobby(c, 'Lobbies', self.names))
        director.request('Manual', owner='user', automatic=False)
        before = list(obs.writes); director.finish(lease)
        self.assertEqual(obs.writes, before)
        self.assertEqual(obs.scene, 'Manual')

    def test_new_lifecycle_withdraws_its_deferred_game_without_cancelling_other_owner(self):
        obs = FakeOBS(); director = SceneDirector(lambda: obs)
        lease = director.reserve('replay', 'InstantReplay', 'Test'); director.activate(lease)
        director.request('Game', owner='voice', defer=True)
        self.assertFalse(director.cancel_pending('league'))
        self.assertTrue(director.cancel_pending('voice'))
        before = list(obs.writes)
        director.finish(lease)
        self.assertEqual(obs.scene, 'Test')
        self.assertEqual(obs.writes[len(before):], [('scene', 'Test')])

    def test_missing_lobby_is_validated_before_desktop_mutation(self):
        obs = FakeOBS()
        with self.assertRaises(ValueError):
            prepare_lobby(obs, 'Lobbies', ('MissingLobby',), hide_screen=True)
        self.assertEqual(obs.writes, [])

    def test_catalog_publishes_complete_snapshots_and_unregisters(self):
        catalog = LobbyCatalog()
        catalog.publish('voice', 'Lobbies', self.names, exclusions=('draft',))
        old = catalog.snapshot('Lobbies')
        catalog.publish('voice', 'Lobbies', ('NewLobby',))
        self.assertEqual(old[0], self.names)
        self.assertEqual(catalog.snapshot('Lobbies')[0], ('NewLobby',))
        catalog.unregister('voice'); self.assertEqual(catalog.snapshot('Lobbies'), ((), ()))

    def test_offline_group_migration_preserves_personal_fields_and_gameplay(self):
        from tools.migrate_lobby_groups import migrate
        original = {'sources': [
            {'name': CAPTURE_SCENE, 'id': 'scene', 'uuid': 'capture'},
            {'name': 'Hub Desktop Panel', 'id': 'scene', 'uuid': 'panel'},
            {'name': 'Test', 'settings': {'items': [{'name': 'Display Capture', 'source_uuid': 'raw', 'visible': True}]}},
            {'name': 'Display Capture', 'settings': {'monitor': 'personal'}, 'filters': [{'private': 42}]}],
            'groups': [{'name': 'TavernLobby', 'settings': {'items': [
                {'name': 'DESKTOP 3D SCREEN', 'source_uuid': 'old', 'id': 18, 'visible': False,
                 'transform': {'scaleX': -.7}, 'unknown': {'custom': 'preserved'}}]}}]}
        updated, changes = migrate(original)
        self.assertEqual(updated['sources'], original['sources'])
        row = updated['groups'][0]['settings']['items'][0]
        self.assertEqual(row['id'], 18); self.assertEqual(row['transform'], {'scaleX': -.7})
        self.assertEqual(row['unknown'], {'custom': 'preserved'})
        self.assertEqual(row['source_uuid'], 'panel'); self.assertTrue(row['visible'])
        self.assertEqual(original['groups'][0]['settings']['items'][0]['name'], 'DESKTOP 3D SCREEN')
        self.assertEqual(migrate(updated)[1], [])

    def test_screen_toggle_only_writes_inner_capture_and_is_idempotent(self):
        obs = FakeOBS(); set_visible(False, client=obs); set_visible(False, client=obs)
        set_visible(True, client=obs)
        self.assertEqual(obs.writes, [(CAPTURE_SCENE, 99, False), (CAPTURE_SCENE, 99, True)])
        self.assertEqual(obs.scene, 'Test')

    def test_voice_discovery_does_not_include_overlays_or_missing_aliases(self):
        from scene_voice_switcher.inventory import _discover_lobbies
        obs = FakeOBS()
        with patch('scene_voice_switcher.inventory.obs.get_obs', return_value=obs):
            lobbies = _discover_lobbies()
            self.assertEqual(set(lobbies), set(self.names))
            from scene_voice_switcher.commands import _match_lobbies_source
            self.assertEqual(_match_lobbies_source('sanctuary lobby', lobbies), 'SanctuaryLobby')

    def test_hotkeys_dispatch_in_press_order_and_release_subscription(self):
        from hub_ui.hotkeys import hub_hotkey_loop
        from lib.global_hotkeys import KeyEvent
        callbacks = []; calls = []; done = threading.Event(); stop = threading.Event()
        configured = {'hub_hotkeys': {n: {'enabled': True, 'sequence': s}
                                     for n, s in [('show_screen', '*-'), ('hide_screen', '-*')]}}
        def dispatch(*, action_id, source):
            calls.append(action_id)
            if len(calls) == 2:
                done.set()
        with patch('hub_ui.hotkeys.hub_settings.load_settings', return_value=configured), \
             patch('lib.global_hotkeys.subscribe_global_hotkeys', side_effect=lambda c: callbacks.append(c) or 1), \
             patch('lib.global_hotkeys.unsubscribe_global_hotkeys') as unsub, \
             patch('hub_ui.hotkeys.commands.run_hub_action', side_effect=dispatch):
            worker = threading.Thread(target=hub_hotkey_loop, args=(stop,)); worker.start()
            try:
                # Subscription happens before the queue worker; queued keys must retain order.
                for _ in range(100):
                    if callbacks: break
                    stop.wait(.01)
                for ch in '*--*': callbacks[0](KeyEvent(ch, ''))
                self.assertTrue(done.wait(2))
                self.assertEqual(calls, ['show_screen', 'hide_screen'])
            finally:
                stop.set(); worker.join(3)
            unsub.assert_called_once_with(1)
            self.assertFalse(worker.is_alive())


if __name__ == '__main__':
    unittest.main()

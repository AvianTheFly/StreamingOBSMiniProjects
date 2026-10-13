import copy
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from lib.display_capture import apply_content, CAPTURE_SCENE
from lib.coordination.lobbies import LobbyCatalog
from scene_voice_switcher.screen_content import SOURCES, ORIGINAL_UDYR, blueprint, choice, install, select


class LobbyScreenTests(unittest.TestCase):
    def setUp(self):
        self.rows = [dict(sourceName=name, sceneItemEnabled=i == 1, sceneItemId=i)
                     for i, name in enumerate(SOURCES.values())]
        self.rows.append(dict(sourceName='Personal overlay', sceneItemEnabled=True, sceneItemId=80))
        self.client = Mock()
        self.client.get_scene_item_list.return_value = SimpleNamespace(scene_items=self.rows)
        def enabled(scene, identifier, value):
            self.assertEqual(scene, CAPTURE_SCENE)
            next(r for r in self.rows if r['sceneItemId'] == identifier)['sceneItemEnabled'] = value
        self.client.set_scene_item_enabled.side_effect = enabled

    def test_each_choice_is_exclusive_inside_display_and_preserves_overlay(self):
        for selected in SOURCES:
            apply_content(blueprint({'screen_content': selected}), client=self.client)
            self.assertEqual([r['sourceName'] for r in self.rows if r['sceneItemEnabled']],
                             [SOURCES[selected], 'Personal overlay'])
        self.client.set_input_settings.assert_not_called()
        self.client.set_scene_item_transform.assert_not_called()
        self.client.set_current_program_scene.assert_not_called()

    def test_missing_and_duplicate_destinations_fail_before_visibility_writes(self):
        self.rows[:] = [r for r in self.rows if r['sourceName'] != SOURCES['udyr']]
        with self.assertRaises(ValueError): apply_content(blueprint({'screen_content': 'udyr'}), client=self.client)
        self.client.set_scene_item_enabled.assert_not_called()
        self.rows.extend([dict(sourceName=SOURCES['udyr']), dict(sourceName=SOURCES['udyr'])])
        with self.assertRaises(ValueError): apply_content(blueprint({'screen_content': 'udyr'}), client=self.client)
        self.client.set_scene_item_enabled.assert_not_called()

    def test_unconfigured_data_preserves_existing_display_until_install(self):
        self.assertIsNone(blueprint({'personal': True}))
        with self.assertRaises(ValueError): choice({'screen_content': 'bad personal value'})

    def test_scenery_only_hides_supported_media_and_preserves_personal_overlay(self):
        apply_content(blueprint({'screen_content': 'none'}), client=self.client)
        self.assertEqual([r['sourceName'] for r in self.rows if r['sceneItemEnabled']], ['Personal overlay'])
        self.client.set_input_settings.assert_not_called()
        self.client.set_scene_item_transform.assert_not_called()
        apply_content(blueprint({'screen_content': 'udyr'}), client=self.client)
        self.assertTrue(next(r for r in self.rows if r['sourceName'] == SOURCES['udyr'])['sceneItemEnabled'])

    def test_frame_visibility_reads_real_media_and_parent_not_saved_choice(self):
        from scene_voice_switcher.screen_content import visibility
        parent = [dict(sourceName=CAPTURE_SCENE, sceneItemEnabled=True)]
        with patch('obs.containers.container_items', return_value=SimpleNamespace(scene_items=parent)):
            self.assertTrue(visibility('ForgeLobby', client=self.client)['visible'])
            for row in self.rows:
                if row['sourceName'] in SOURCES.values(): row['sceneItemEnabled'] = False
            self.assertFalse(visibility('ForgeLobby', client=self.client)['visible'])
            self.rows[0]['sceneItemEnabled'] = True
            self.assertTrue(visibility('ForgeLobby', client=self.client)['visible'])
            parent[0]['sceneItemEnabled'] = False
            self.assertFalse(visibility('ForgeLobby', client=self.client)['visible'])

    def test_duplicate_choice_is_rejected_before_personal_settings_are_saved(self):
        self.rows.append(dict(sourceName=SOURCES['udyr'], sceneItemId=100))
        with patch('obs.get_obs', return_value=self.client), \
             patch('scene_voice_switcher.screen_content.SettingsBackups') as backups, \
             patch('scene_voice_switcher.screen_content.update_json') as save:
            with self.assertRaises(ValueError): select('udyr')
        backups.assert_not_called(); save.assert_not_called()
        self.client.set_scene_item_enabled.assert_not_called()

    def test_published_display_selection_is_complete_and_immutable(self):
        catalog = LobbyCatalog()
        spec = blueprint({'screen_content': 'udyr'})
        catalog.publish('feature', 'Lobbies', ['World'], layouts={'World': {'display_content': spec}})
        spec['selected'] = 'changed'
        self.assertEqual(catalog.layout('World')['display_content']['selected'], SOURCES['udyr'])

    def test_install_adds_only_missing_references_without_changing_original_media(self):
        self.rows[:] = self.rows[1:3]
        self.client.get_input_list.return_value = SimpleNamespace(inputs=[{'inputName': n} for n in SOURCES.values()])
        self.client.create_scene_item.side_effect = [SimpleNamespace(scene_item_id=10), SimpleNamespace(scene_item_id=11)]
        with patch('scene_voice_switcher.screen_content.SettingsBackups'):
            install(self.client)
        self.assertEqual(self.client.create_scene_item.call_count, 2)
        self.assertTrue(all(c.args[2] is False for c in self.client.create_scene_item.call_args_list))
        self.client.set_input_settings.assert_not_called()
        self.client.set_input_volume.assert_not_called()
        self.client.set_current_program_scene.assert_not_called()

    def test_udyr_migration_creates_independent_unfiltered_input_and_retires_only_display_link(self):
        original = {'local_file': 'personal.mp4', 'looping': True, 'future': 17}
        self.rows[:] = [r for r in self.rows if r['sourceName'] != SOURCES['udyr']]
        self.rows.append(dict(sourceName=ORIGINAL_UDYR, sceneItemId=90, sceneItemEnabled=True))
        self.client.get_input_list.return_value = SimpleNamespace(inputs=[
            {'inputName': ORIGINAL_UDYR, 'inputKind': 'ffmpeg_source'},
            *[{'inputName': n} for k, n in SOURCES.items() if k != 'udyr']])
        self.client.get_input_settings.return_value = SimpleNamespace(input_settings=original)
        self.client.get_input_volume.return_value = SimpleNamespace(input_volume_db=-7)
        self.client.get_input_mute.return_value = SimpleNamespace(input_muted=True)
        self.client.create_input.return_value = SimpleNamespace(scene_item_id=91)
        with patch('scene_voice_switcher.screen_content.SettingsBackups') as backups:
            install(self.client)
        backups.return_value.snapshot.assert_called_once()
        self.client.create_input.assert_called_once_with(
            CAPTURE_SCENE, SOURCES['udyr'], 'ffmpeg_source', original, False)
        self.client.set_input_volume.assert_called_once_with(SOURCES['udyr'], vol_db=-7)
        self.client.set_input_mute.assert_called_once_with(SOURCES['udyr'], True)
        self.client.set_scene_item_enabled.assert_called_once_with(CAPTURE_SCENE, 90, False)
        self.client.set_scene_item_transform.assert_called_once()
        self.assertEqual(self.client.set_scene_item_transform.call_args.args[1], 91)
        self.client.set_input_settings.assert_not_called()
        self.client.create_source_filter.assert_not_called()
        self.client.remove_source_filter.assert_not_called()
        self.client.remove_input.assert_not_called()
        self.client.set_current_program_scene.assert_not_called()
        self.assertTrue(next(r for r in self.rows if r['sourceName'] == 'Personal overlay')['sceneItemEnabled'])

    def test_old_tilted_reference_cannot_overlap_new_display_choice(self):
        self.rows.append(dict(sourceName=ORIGINAL_UDYR, sceneItemId=90, sceneItemEnabled=True))
        apply_content(blueprint({'screen_content': 'udyr'}), client=self.client)
        self.assertFalse(self.rows[-1]['sceneItemEnabled'])
        self.assertTrue(next(r for r in self.rows if r['sourceName'] == SOURCES['udyr'])['sceneItemEnabled'])

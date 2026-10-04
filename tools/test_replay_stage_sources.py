"""Replay references existing camera/capture resources and observes availability."""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from instant_replay import obs_stage, api
from pathlib import Path


class ReplayStageSourcesTests(unittest.TestCase):
    def test_install_references_camera_scene_without_changing_its_inputs(self):
        client = Mock()
        client.get_video_settings.return_value = SimpleNamespace(base_width=1920, base_height=1080)
        client.get_input_list.return_value = SimpleNamespace(inputs=[
            {'inputName': 'Display Capture', 'inputKind': 'monitor_capture'},
            {'inputName': 'lens studio', 'inputKind': 'window_capture'}])
        client.get_scene_list.return_value = SimpleNamespace(scenes=[{'sceneName': 'FaceCamWithProps'}])
        client.get_scene_item_list.return_value = SimpleNamespace(scene_items=[
            {'sourceName': 'Display Capture', 'inputKind': 'monitor_capture', 'sceneItemEnabled': True}])
        items = {'InstantReplayMedia': 1, 'Recording Audio - No Music': 2, 'Hub Display Capture': 3}
        def create(scene, name, *args):
            self.assertEqual(scene, 'InstantReplay')
            items[name] = len(items) + 1
        client.create_input.side_effect = create
        with patch.object(obs_stage, '_game_source'), patch.object(obs_stage, '_camera_source'), \
             patch.object(obs_stage.obs, 'get_obs', return_value=client), \
             patch.object(obs_stage.obs, 'list_sources', side_effect=lambda scene: dict(items)), \
             patch.object(obs_stage.obs, 'create_scene_item', side_effect=create) as reference, \
             patch.object(obs_stage.obs, 'set_source_transform') as place:
            available = obs_stage.install()
        self.assertTrue(available['camera_available'])
        reference.assert_any_call('InstantReplay', 'FaceCamWithProps', False)
        self.assertNotIn('FaceCamWithProps', [call.args[1] for call in client.create_input.call_args_list])
        self.assertTrue(all(call.args[0] == 'InstantReplay' for call in place.call_args_list))
        client.set_input_settings.assert_not_called()
        client.set_source_filter_settings.assert_not_called()
        client.set_source_filter_enabled.assert_not_called()

    def test_camera_availability_uses_enabled_capture_content(self):
        client = Mock()
        camera = {'inputKind': 'window_capture', 'sceneItemEnabled': True,
                  'sceneItemTransform': {'sourceWidth': 0}}
        def rows(scene):
            return SimpleNamespace(scene_items=[camera] if scene == 'FaceCamWithProps' else [])
        client.get_scene_item_list.side_effect = rows
        with patch.object(obs_stage, '_camera_source', 'FaceCamWithProps'), \
             patch.object(obs_stage.obs, 'get_obs', return_value=client):
            self.assertFalse(obs_stage.availability()['camera_online'])
            camera['sceneItemTransform']['sourceWidth'] = 1280
            self.assertTrue(obs_stage.availability()['camera_online'])
            camera['sceneItemEnabled'] = False
            self.assertFalse(obs_stage.availability()['camera_online'])
        client.set_scene_item_enabled.assert_not_called()


class ReplaySequenceApiTests(unittest.TestCase):
    def test_all_saved_paths_are_validated_before_a_single_sequence_is_started(self):
        handler = Mock()
        with patch.dict(api._live, {'play_sequence': handler, 'playback_busy': lambda: False}, clear=True), \
             patch.object(api.library, 'resolve', side_effect=[Path('one.mkv'), Path('two.mkv')]) as resolve, \
             patch.object(api.threading, 'Thread') as worker:
            api.play({'paths': ['one', 'two'], 'mode': 'showcase'})
        self.assertEqual(resolve.call_count, 2)
        self.assertEqual(worker.call_args.kwargs['args'], (['one.mkv', 'two.mkv'],))
        self.assertEqual(worker.call_args.kwargs['kwargs'], {'mode': 'showcase', 'presentation': 'highlights'})
        worker.return_value.start.assert_called_once()

    def test_invalid_or_ambiguous_sequence_never_starts_partial_playback(self):
        with patch.dict(api._live, {'play_sequence': Mock(), 'playback_busy': lambda: False}, clear=True), \
             patch.object(api.threading, 'Thread') as worker:
            for body in ({'paths': []}, {'paths': ['one'], 'group_id': 'group'}, {'paths': 'one'}):
                with self.assertRaises(ValueError):
                    api.play(body)
            with patch.object(api.library, 'resolve', side_effect=[Path('one.mkv'), ValueError('missing cut')]):
                with self.assertRaises(ValueError):
                    api.play({'paths': ['one', 'missing']})
            worker.assert_not_called()


if __name__ == '__main__':
    unittest.main()

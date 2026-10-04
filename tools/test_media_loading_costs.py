"""Offline loading regressions; no OBS connection or real media decoding."""
import sys
import os
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.shared_media import layout_rules, single_source_state
from hub_ui import replay_media
from obs import media as interaction, sources
from lib import media_metadata


class LoadingTests(unittest.TestCase):
    def setUp(self):
        media_metadata.clear_metadata_cache()

    def test_media_properties_skip_noop_and_respect_live_changes(self):
        client = Mock()
        current = {'looping': False, 'speed_percent': 90, 'hw_decode': True}
        client.get_input_settings.return_value.input_settings = current
        with patch.object(interaction, 'get_obs', return_value=client):
            interaction.configure_media_source_properties('player', looping=False)
            client.set_input_settings.assert_not_called()
            current['looping'] = True  # A manual edit must not be hidden by a cache.
            interaction.configure_media_source_properties('player', looping=False)
            client.set_input_settings.assert_called_once_with(
                'player', {'looping': False}, overlay=True)

    def test_editor_and_playback_share_media_metadata_cache(self):
        from lib.hotkey_editor import server
        result = SimpleNamespace(returncode=0, stdout='{"streams":[{"width":1280,"height":720}]}')
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'clip.mp4'
            path.write_bytes(b'original')
            original = path.stat()
            with patch.object(media_metadata.subprocess, 'run', return_value=result) as probe:
                self.assertEqual(layout_rules.probe_dimension_key(path), '1280x720')
                self.assertEqual(server._probe_media_dimensions(path),
                                 {'width': 1280, 'height': 720, 'dimension_key': '1280x720'})
                probe.assert_called_once()
                path.write_bytes(b'replaced media')
                os.utime(path, ns=(original.st_atime_ns, original.st_mtime_ns))
                self.assertEqual(server._probe_media_dimensions(path)['width'], 1280)
                self.assertEqual(probe.call_count, 2)

    def test_editor_and_playback_share_placement_rules_and_honor_zero_scale(self):
        from lib.hotkey_editor import server
        self.assertIs(server._safe_transform, layout_rules.safe_transform)
        self.assertIs(server._obs_transform_from_rule, layout_rules.obs_transform_from_rule)
        transform = server._obs_transform_from_rule({'positionX': 15, 'positionY': 20,
                                                      'cropLeft': 5, 'cropTop': 6,
                                                      'scaleX': 0, 'scaleY': 0})
        self.assertEqual((transform['positionX'], transform['positionY']), (15, 20))

    def test_nonfinite_layout_values_never_reach_obs(self):
        transform = layout_rules.safe_transform({'positionX': float('nan'),
                                                  'scaleX': float('inf'),
                                                  'alignment': float('-inf'),
                                                  'positionY': 25})
        self.assertNotIn('positionX', transform)
        self.assertNotIn('scaleX', transform)
        self.assertEqual(transform['alignment'], 5)
        self.assertEqual(transform['positionY'], 25)

    def test_dimensions_cached_until_file_changes(self):
        result = SimpleNamespace(returncode=0, stdout='{"streams":[{"width":1280,"height":720}]}')
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'clip.mp4'
            path.write_bytes(b'original')
            with patch.object(media_metadata.subprocess, 'run', return_value=result) as probe:
                self.assertEqual(layout_rules.probe_dimension_key(path), '1280x720')
                self.assertEqual(layout_rules.probe_dimension_key(path), '1280x720')
                probe.assert_called_once()
                path.write_bytes(b'replaced media')
                self.assertEqual(layout_rules.probe_dimension_key(path), '1280x720')
                self.assertEqual(probe.call_count, 2)

    def test_failed_probe_is_retried(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'clip.mp4'
            path.touch()
            with patch.object(media_metadata.subprocess, 'run', side_effect=OSError) as probe:
                self.assertEqual(layout_rules.probe_dimension_key(path), '')
                self.assertEqual(layout_rules.probe_dimension_key(path), '')
                self.assertEqual(probe.call_count, 2)

    def test_identical_filters_are_not_rebuilt_but_changed_filters_are(self):
        filters = [{'name': 'Key', 'kind': 'color_key_filter', 'enabled': True, 'settings': {'similarity': 100}}]
        with patch.object(single_source_state, '_snapshot_filters', return_value=filters), \
             patch.object(single_source_state.obs, 'remove_source_filter') as remove, \
             patch.object(single_source_state.obs, 'create_source_filter') as create, \
             patch.object(single_source_state.obs, 'set_source_filter_enabled'), \
             patch.object(single_source_state.obs, 'set_source_filter_settings'):
            single_source_state._apply_filters('player', filters)
            remove.assert_not_called()
            create.assert_not_called()
            single_source_state._apply_filters('player', [])
            remove.assert_called_once_with('player', 'Key')

    def test_saved_filter_settings_replace_removed_keys_without_recreating_chain(self):
        current = [{'name': 'Key', 'kind': 'color_key_filter', 'enabled': True,
                    'settings': {'similarity': 100, 'opacity': 25}},
                   {'name': 'Crop', 'kind': 'crop_filter', 'enabled': True,
                    'settings': {'left': 12}}]
        desired = deepcopy(current)
        desired[0]['settings'] = {'similarity': 120}
        with patch.object(single_source_state, '_snapshot_filters', return_value=current), \
             patch.object(single_source_state.obs, 'remove_source_filter') as remove, \
             patch.object(single_source_state.obs, 'create_source_filter') as create, \
             patch.object(single_source_state.obs, 'set_source_filter_enabled') as enable, \
             patch.object(single_source_state.obs, 'set_source_filter_settings') as update, \
             patch.object(single_source_state.obs, 'get_obs') as client:
            single_source_state._apply_filters('player', desired)
        remove.assert_not_called()
        create.assert_not_called()
        enable.assert_not_called()
        client.assert_not_called()
        update.assert_called_once_with('player', 'Key', {'similarity': 120}, overlay=False)

    def test_filter_enable_and_order_edits_keep_instances_and_settings(self):
        current = [{'name': 'Key', 'kind': 'color_key_filter', 'enabled': True, 'settings': {}},
                   {'name': 'Crop', 'kind': 'crop_filter', 'enabled': True, 'settings': {}}]
        desired = list(reversed(deepcopy(current)))
        desired[1]['enabled'] = False
        with patch.object(single_source_state, '_snapshot_filters', return_value=current), \
             patch.object(single_source_state.obs, 'remove_source_filter') as remove, \
             patch.object(single_source_state.obs, 'create_source_filter') as create, \
             patch.object(single_source_state.obs, 'set_source_filter_enabled') as enable, \
             patch.object(single_source_state.obs, 'set_source_filter_settings') as update, \
             patch.object(single_source_state.obs, 'get_obs') as client:
            single_source_state._apply_filters('player', desired)
        remove.assert_not_called()
        create.assert_not_called()
        update.assert_not_called()
        enable.assert_called_once_with('player', 'Key', False)
        client.return_value.set_source_filter_index.assert_called_once_with('player', 'Crop', 0)

    def test_structural_filter_swap_replaces_only_changed_type_and_restores_order(self):
        current = [{'name': 'Key', 'kind': 'color_key_filter', 'enabled': True, 'settings': {}},
                   {'name': 'Crop', 'kind': 'crop_filter', 'enabled': True, 'settings': {}}]
        desired = deepcopy(current)
        desired[0].update(kind='chroma_key_filter', enabled=False, settings={'similarity': 120})
        # Removing Key retains Crop; the newly created Key is appended by OBS.
        after_create = [current[1], desired[0]]
        with patch.object(single_source_state, '_snapshot_filters', side_effect=[current, after_create]), \
             patch.object(single_source_state.obs, 'remove_source_filter') as remove, \
             patch.object(single_source_state.obs, 'create_source_filter') as create, \
             patch.object(single_source_state.obs, 'set_source_filter_enabled') as enable, \
             patch.object(single_source_state.obs, 'set_source_filter_settings') as update, \
             patch.object(single_source_state.obs, 'get_obs') as client:
            single_source_state._apply_filters('player', desired)
        remove.assert_called_once_with('player', 'Key')
        create.assert_called_once_with('player', 'Key', 'chroma_key_filter', {'similarity': 120})
        enable.assert_called_once_with('player', 'Key', False)
        update.assert_not_called()
        client.return_value.set_source_filter_index.assert_called_once_with('player', 'Key', 0)

    def test_default_filter_edits_merge_but_saved_snapshots_can_reset(self):
        with patch.object(sources, 'get_obs') as client:
            sources.set_source_filter_settings('player', 'Key', {'similarity': 120})
            self.assertTrue(client.return_value.set_source_filter_settings.call_args.kwargs['overlay'])
            sources.set_source_filter_settings('player', 'Key', {}, overlay=False)
            self.assertFalse(client.return_value.set_source_filter_settings.call_args.kwargs['overlay'])

    def test_preview_failure_cleans_partial_and_limits_filters(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'preview.mp4'
            partial = output.with_suffix('.partial.mp4')
            partial.touch()
            with patch.object(replay_media, 'CACHE', Path(folder)), \
                 patch.object(replay_media.jobs, 'run', return_value=SimpleNamespace(returncode=1)) as run:
                with self.assertRaises(ValueError):
                    replay_media._convert(Path('source.mp4'), output)
            command = run.call_args.args[0]
            self.assertEqual(command[command.index('-filter_threads') + 1], '1')
            self.assertFalse(partial.exists())


if __name__ == '__main__':
    unittest.main()

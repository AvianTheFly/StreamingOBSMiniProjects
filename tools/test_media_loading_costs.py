"""Offline loading regressions; no OBS connection or real media decoding."""
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.shared_media import layout_rules, single_source_state
from hub_ui import replay_media
from obs import interaction


class LoadingTests(unittest.TestCase):
    def setUp(self):
        layout_rules._probe_dimension_key.cache_clear()

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

    def test_dimensions_cached_until_file_changes(self):
        result = SimpleNamespace(returncode=0, stdout='{"streams":[{"width":1280,"height":720}]}')
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'clip.mp4'
            path.write_bytes(b'original')
            with patch.object(layout_rules.subprocess, 'run', return_value=result) as probe:
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
            with patch.object(layout_rules.subprocess, 'run', side_effect=OSError) as probe:
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

    def test_preview_failure_cleans_partial_and_limits_filters(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'preview.mp4'
            partial = output.with_suffix('.partial.mp4')
            partial.touch()
            with patch.object(replay_media, 'CACHE', Path(folder)), \
                 patch.object(replay_media.subprocess, 'run', return_value=SimpleNamespace(returncode=1)) as run:
                with self.assertRaises(ValueError):
                    replay_media._convert(Path('source.mp4'), output)
            command = run.call_args.args[0]
            self.assertEqual(command[command.index('-filter_threads') + 1], '1')
            self.assertFalse(partial.exists())


if __name__ == '__main__':
    unittest.main()

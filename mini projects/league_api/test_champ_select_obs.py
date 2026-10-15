"""Draft browser recovery preserves personal OBS presentation settings."""
import unittest
from unittest.mock import Mock, patch
from .champ_select_obs import SOURCE, URL, recover_browser


class DraftBrowserRecoveryTests(unittest.TestCase):
    def test_refresh_after_server_start_repairs_delivery_and_frame_rate_only(self):
        client = Mock()
        client.send.side_effect = [
            {'inputs': [{'inputName': SOURCE, 'inputKind': 'browser_source'}]},
            {'inputSettings': {'url': 'old', 'restart_when_active': False,
                               'width': 1500, 'css': 'personal'}}, {}, {}]
        with patch('league_api.champ_select_obs.SettingsBackups') as backups:
            self.assertTrue(recover_browser(client))
            backups.return_value.snapshot.assert_called_once()
        self.assertEqual(client.send.call_args_list[2].args, ('SetInputSettings', {
            'inputName': SOURCE, 'inputSettings': {'url': URL, 'restart_when_active': True, 'fps': 60, 'fps_custom': True},
            'overlay': True}))
        self.assertEqual(client.send.call_args_list[3].args[0], 'PressInputPropertiesButton')

    def test_missing_optional_browser_creates_nothing(self):
        client = Mock()
        client.send.return_value = {'inputs': []}
        self.assertFalse(recover_browser(client))
        client.send.assert_called_once()

    def test_correct_settings_refresh_without_rewriting(self):
        client = Mock()
        client.send.side_effect = [
            {'inputs': [{'inputName': SOURCE, 'inputKind': 'browser_source'}]},
            {'inputSettings': {'url': URL, 'restart_when_active': True, 'fps': 60, 'fps_custom': True}}, {}]
        with patch('league_api.champ_select_obs.SettingsBackups') as backups:
            self.assertTrue(recover_browser(client))
            backups.assert_not_called()
        self.assertEqual(client.send.call_count, 3)

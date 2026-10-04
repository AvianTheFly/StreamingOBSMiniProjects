"""Main live-profile workflows without editing user settings."""
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from lib.shared_media.runtime_profiles import RuntimeProfiles
from lib.shared_media.controls import asset_volume_db


class RuntimeProfileTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.cfg = SimpleNamespace(project_name='test', trigger_max_interval=.5,
            manual_trigger_map={'@': 'fallback'}, interface_hotkeys={})
        self.default = SimpleNamespace(profile_name='default', hotkeys={'@': 'hooray'},
            interface_hotkeys={'pause': 'p'}, project_volume_db=-5.5)
        self.other = SimpleNamespace(profile_name='other', hotkeys={'@': 'other song'},
            interface_hotkeys={'pause': 'q'}, project_volume_db=-8)
        self.loader = Mock(side_effect=lambda name: self.other if name == 'other' else self.default)
        self.profiles = RuntimeProfiles(self.cfg, self.root, loader=self.loader)
        summary = patch('lib.shared_media.runtime_profiles.load_project_profile_summaries',
            return_value=[{'name': 'default', 'trigger_sequences': '123'},
                          {'name': 'other', 'trigger_sequences': '456'}])
        summary.start()
        self.addCleanup(summary.stop)

    def test_profile_selection_updates_manual_and_action_bindings_and_keeps_volume(self):
        self.profiles.reload(force=True)
        self.assertEqual(self.profiles.manual_map(), {'@': 'hooray'})
        self.assertTrue(self.profiles.action_triggers['pause'][0].register_key('p'))
        self.assertTrue(self.profiles.activate('other'))
        self.assertEqual(self.profiles.manual_map(), {'@': 'other song'})
        self.assertTrue(self.profiles.action_triggers['pause'][0].register_key('q'))
        self.assertEqual(self.profiles.active_settings[0].project_volume_db, -8)
        self.profiles.reload(force=True)
        self.assertEqual(self.profiles.active_profile_name, ['other'])
        self.assertEqual(self.default.project_volume_db, -5.5)

    def test_reload_reads_only_when_either_profile_file_changes(self):
        hotkeys, editor = self.root / 'hotkeys.json', self.root / 'hotkeys_editor.json'
        hotkeys.write_text('{}')
        editor.write_text('{}')
        os.utime(hotkeys, ns=(1000000000, 1000000000))
        os.utime(editor, ns=(2000000000, 2000000000))
        self.assertTrue(self.profiles.reload())
        self.loader.reset_mock()
        self.assertFalse(self.profiles.reload())
        self.loader.assert_not_called()
        hotkeys.write_text('{"@":"updated"}')
        os.utime(hotkeys, ns=(1500000000, 1500000000))
        self.assertTrue(self.profiles.reload())
        self.loader.assert_called_once_with('default')

    def test_asset_levels_keep_individual_offsets_and_use_latest_project_volume(self):
        self.cfg.project_volume_db = 1
        self.cfg.profile_volume_db = 2
        self.cfg.file_volume_offsets = {'a': -1, 'b': 2}
        settings = SimpleNamespace(project_volume_db=-5.5, profile_volume_db=.5,
            file_volume_offsets={'a': -3, 'b': 4}, sound_categories={'a': ['hype'], 'b': ['hype']},
            category_volume_db={'hype': -2})
        self.assertEqual(asset_volume_db(self.cfg, settings, 'a'), -8)
        self.assertEqual(asset_volume_db(self.cfg, settings, 'b'), 2)
        settings.project_volume_db = -2
        self.assertEqual(asset_volume_db(self.cfg, settings, 'a'), -4.5)
        self.assertEqual(settings.file_volume_offsets, {'a': -3, 'b': 4})


if __name__ == '__main__':
    unittest.main()

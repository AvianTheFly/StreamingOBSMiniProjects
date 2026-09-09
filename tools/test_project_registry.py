"""Discovery contracts using synthetic modules; never start the Hub or touch OBS."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import project_registry
from lib.editor_config import editor_defaults


class EditorDiscoveryTests(unittest.TestCase):
    def discover(self, folder, config_module):
        with patch.object(project_registry, 'iter_project_dirs', return_value=[folder]), \
             patch.object(project_registry, 'ensure_import_paths'), \
             patch.object(project_registry.importlib, 'import_module', return_value=config_module) as importer:
            result = project_registry.discover_editor_projects()
            importer.assert_called_once_with(folder.name + '.config')
            return result

    def test_discovery_preserves_explicit_editor_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / 'soundboard'
            folder.mkdir()
            (folder / 'config.py').touch()
            config = SimpleNamespace(asset_dir=folder / 'assets', valid_extensions={'.wav', '.mp4'},
                trigger_sequences=[['/', '*'], ['x']], project_volume_db=-13.5,
                profile_volume_db=0, manual_hotkeys_enabled=False,
                features={'obs_layout_enabled': False}, interface_hotkeys={'@': 'hooray'})
            projects = self.discover(folder, SimpleNamespace(CONFIG=config))
            project = projects['soundboard']
            self.assertEqual(project.error, '')
            self.assertEqual(project.hotkeys_file, folder / 'hotkeys.json')
            defaults = json.loads(json.dumps(project.config_defaults))
            self.assertEqual(defaults['asset_dir'], str(folder / 'assets'))
            self.assertEqual(defaults['valid_extensions'], ['.mp4', '.wav'])
            self.assertEqual(defaults['trigger_sequences'], '/ * ; x')
            self.assertEqual(defaults['project_volume_db'], -13.5)
            self.assertEqual(defaults['profile_volume_db'], 0)
            self.assertFalse(defaults['manual_hotkeys_enabled'])
            self.assertFalse(defaults['obs_layout_enabled'])
            self.assertEqual(defaults['interface_hotkeys'], {'@': 'hooray'})

    def test_profile_discovery_keeps_its_own_defaults(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / 'config.py').touch()
            payload = {'key': 'custom', 'asset_dir': str(folder),
                       'hotkeys_file': str(folder / 'custom.json'),
                       'config_defaults': {'project_volume_db': -19}}
            projects = self.discover(folder, SimpleNamespace(discover_editor_projects=lambda: [payload]))
            self.assertEqual(projects['custom'].config_defaults, {'project_volume_db': -19})
            self.assertEqual(projects['custom'].hotkeys_file, folder / 'custom.json')

    def test_minimal_config_retains_legacy_fallbacks(self):
        defaults = editor_defaults(SimpleNamespace())
        self.assertEqual(defaults['default_volume_db'], '')
        self.assertEqual(defaults['project_volume_db'], 0.0)
        self.assertEqual(defaults['trigger_sequences'], '')
        self.assertTrue(defaults['manual_hotkeys_enabled'])
        self.assertFalse(defaults['random_commands_enabled'])


if __name__ == '__main__':
    unittest.main()

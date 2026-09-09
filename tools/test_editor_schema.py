"""Offline contracts for editor metadata and the package's lazy entry point."""
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.hotkey_editor.schema import CONFIG_FIELDS, config_fields_for_project


class EditorSchemaTests(unittest.TestCase):
    def test_voice_field_only_appears_for_supporting_projects(self):
        plain = config_fields_for_project({})
        voice = config_fields_for_project({'config_defaults': {'voice_commands': []}})
        self.assertEqual(plain, CONFIG_FIELDS)
        self.assertNotIn('voice_commands', [field['key'] for field in plain])
        self.assertEqual(voice[-1]['key'], 'voice_commands')
        voice.pop()
        self.assertEqual(config_fields_for_project({}), plain)

    def test_fields_have_unique_keys_and_required_metadata(self):
        keys = [field['key'] for field in CONFIG_FIELDS]
        self.assertEqual(len(keys), len(set(keys)))
        for field in CONFIG_FIELDS:
            for name in ('section', 'key', 'label', 'type', 'help'):
                self.assertTrue(field[name], (field['key'], name))

    def test_metadata_import_does_not_load_server_and_public_api_is_preserved(self):
        # A fresh interpreter checks import isolation; a fake server verifies the
        # legacy export without importing or starting application infrastructure.
        code = '''
import sys, types
import lib.hotkey_editor.schema
assert 'lib.hotkey_editor.server' not in sys.modules
assert 'obs' not in sys.modules
server = types.ModuleType('lib.hotkey_editor.server')
server.run_editor = object()
sys.modules[server.__name__] = server
from lib.hotkey_editor import run_editor
assert run_editor is server.run_editor
'''
        subprocess.run([sys.executable, '-c', code], cwd=ROOT, check=True,
                       capture_output=True, text=True)


if __name__ == '__main__':
    unittest.main()

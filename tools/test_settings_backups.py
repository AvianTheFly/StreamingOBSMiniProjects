import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.settings_backups import SettingsBackups


class BackupTests(unittest.TestCase):
    def test_versions_recovery_and_valid_user_edits(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict('os.environ', {'APPDATA': ''}):
            root = Path(folder) / 'repo'
            history = SettingsBackups(root, Path(folder) / 'history')
            settings = root / 'mini projects/soundboard/hotkeys_editor.json'
            settings.parent.mkdir(parents=True)
            settings.write_text('{"volume": -12}')
            history.snapshot()
            settings.write_text('{"volume": -8}')
            history.recover_missing()
            self.assertEqual(json.loads(settings.read_text())['volume'], -8)
            history.snapshot()
            settings.write_text('{')
            history.snapshot()
            settings.unlink()
            history.recover_missing()
            self.assertEqual(json.loads(settings.read_text())['volume'], -8)
            versions = list((history.backup_root / settings.relative_to(root)).glob('*.json'))
            self.assertEqual(len(versions), 3)  # two versions plus latest


if __name__ == '__main__':
    unittest.main()

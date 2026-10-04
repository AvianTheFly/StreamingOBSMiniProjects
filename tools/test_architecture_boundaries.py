"""Enforce shared ownership and import isolation for future extensions."""
import subprocess
import sys
import unittest

from tools.check_architecture import ROOT, check, inspect_source


class ArchitectureBoundaryTests(unittest.TestCase):
    def test_supported_application_respects_shared_owners(self):
        checked, errors = check()
        self.assertGreater(checked, 100)
        self.assertEqual(errors, [])

    def test_scene_bypass_and_peer_import_are_rejected(self):
        source = 'from instant_replay.interface import _live\nclient.set_current_program_scene("Game")'
        errors = inspect_source(source, 'mini projects/soundboard/main.py')
        self.assertEqual(len(errors), 2)
        self.assertFalse(inspect_source('client.set_current_program_scene("Game")', 'lib/coordination/scenes.py'))

    def test_imports_start_no_workers_sockets_or_settings_writes(self):
        script = '''
from lib.paths import ensure_import_paths, load_project_env
ensure_import_paths(); load_project_env()
import socket, threading
from unittest.mock import patch
from pathlib import Path
with patch.object(threading.Thread, 'start', side_effect=AssertionError('worker at import')), \\
     patch.object(socket.socket, 'connect', side_effect=AssertionError('connection at import')), \\
     patch.object(socket.socket, 'bind', side_effect=AssertionError('server at import')), \\
     patch.object(Path, 'write_text', side_effect=AssertionError('settings write at import')):
    import coordinator, hub_rules, shared, hub
    import lib.hotkey_editor.server, lib.shared_media.media_project
    import instant_replay.main, league_api.main, soundboard.main, specific_song.main
    import league_stats.main, lib.twitch_chat
'''
        result = subprocess.run([sys.executable, '-X', 'utf8', '-c', script],
                                cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()

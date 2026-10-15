"""Enforce shared ownership and import isolation for future extensions."""
import subprocess
import sys
import unittest

from tools.check_architecture import ROOT, check, inspect_source


class ArchitectureBoundaryTests(unittest.TestCase):
    def test_supported_application_respects_shared_owners(self):
        checked, errors = check()
        self.assertGreater(checked, 0, 'The checker must inspect runtime modules')
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

    def test_imported_or_captured_operations_cannot_bypass_ownership(self):
        sources = [
            'from obsws_python import ReqClient as Client\nClient()',
            'from obsws_python import EventClient\nEventClient()',
            'connect = obs.ReqClient\nconnect()',
            'change_scene = client.set_current_program_scene\nworker.submit(change_scene)',
            'pause = registry.pause_all\nworker.submit(pause)',
            'resume = registry.resume_all',
            'complete = coordinator.announce_finished',
            'admit = coordinator.request_to_play',
            'client.send(param="SetCurrentProgramScene", data={})',
        ]
        for source in sources:
            with self.subTest(source=source):
                self.assertEqual(len(inspect_source(source, 'mini projects/soundboard/main.py')), 1)

    def test_declared_adapter_still_cannot_read_private_state(self):
        for source in ('from instant_replay.interface import _live as state',
                       'import instant_replay.interface as replay\nstate = replay._live'):
            with self.subTest(source=source):
                errors = inspect_source(source, 'hub_ui/routes/replay.py')
                self.assertEqual(len(errors), 1)
                self.assertIn('private live state', errors[0][1])

    def test_public_contracts_and_real_transport_owners_remain_allowed(self):
        examples = [
            ('from obsws_python import EventClient\nEventClient()', 'obs/outputs.py'),
            ('from obsws_python import ReqClient as Client\nClient()', 'obs/client.py'),
            ('switch = client.set_current_program_scene\nswitch("Game")', 'lib/coordination/scenes.py'),
            ('from instant_replay.api import status\nstatus()', 'hub_ui/routes/replay.py'),
            ('ticket.finish()\ncoordinator.manual_action("music", "pause")', 'hub_ui/commands.py'),
        ]
        for source, owner in examples:
            with self.subTest(owner=owner):
                self.assertEqual(inspect_source(source, owner), [])


if __name__ == '__main__':
    unittest.main()

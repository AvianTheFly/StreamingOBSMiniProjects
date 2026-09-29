"""Startup contracts without connecting to OBS or starting real module listeners."""
import subprocess
import sys
import threading
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import main
from lib.hotkey_editor import server as editor


class HubStartupTests(unittest.TestCase):
    def test_imports_do_not_parse_arguments_or_start_process_services(self):
        result = subprocess.run([sys.executable, '-c', '''
import sys, threading, webbrowser
sys.argv = ['host', '--unrelated-host-option']
argv, threads, browser = sys.argv[:], threading.enumerate(), webbrowser.open
import main, hub, log
assert sys.argv == argv
assert threading.enumerate() == threads
assert webbrowser.open is browser
assert not log._started
'''], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def run_modules(self, obs_ready, *, wait_for_obs=True):
        projects = [SimpleNamespace(name=name) for name in ('league_api', 'soundboard')]
        with ExitStack() as stack:
            mocks = {name: stack.enter_context(patch.object(main, name)) for name in (
                '_configure_runtime', '_check_obs_connection', 'discover_runnable_projects',
                'filter_projects', '_print_project_table', '_print_runtime_options',
                '_start_voice', '_start_projects')}
            stack.enter_context(patch('lib.settings_backups.start_settings_backups'))
            stack.enter_context(patch.dict(sys.modules, hub_rules=Mock()))
            background = stack.enter_context(patch.object(main.threading, 'Thread'))
            mocks['_check_obs_connection'].return_value = obs_ready
            mocks['discover_runnable_projects'].return_value = projects
            mocks['filter_projects'].return_value = projects
            stop = threading.Event()
            result = main.run_hub(stop, only=['soundboard'], skip=['love_me'],
                                  debug=True, wait_for_obs=wait_for_obs)
            mocks['_configure_runtime'].assert_called_once_with(True)
            if obs_ready:
                self.assertEqual(result, projects)
                mocks['_start_voice'].assert_called_once_with(stop)
                mocks['_start_projects'].assert_called_once_with(projects, stop)
                self.assertEqual(mocks['filter_projects'].call_args.kwargs['only'], {'soundboard'})
                self.assertEqual(mocks['filter_projects'].call_args.kwargs['skip'], {'love_me'})
                background.assert_not_called()
            elif not wait_for_obs:
                self.assertEqual(result, [])
                mocks['discover_runnable_projects'].assert_not_called()
                mocks['_start_voice'].assert_not_called()
                background.assert_not_called()
            else:
                self.assertEqual(result, projects)
                mocks['_start_projects'].assert_called_once_with(projects[:1], stop)
                mocks['_start_voice'].assert_not_called()
                background.return_value.start.assert_called_once_with()
                with patch('obs.get_obs'), patch.object(stop, 'wait', return_value=False):
                    background.call_args.kwargs['target']()
                mocks['_start_voice'].assert_called_once_with(stop)
                self.assertEqual(mocks['_start_projects'].call_args.args, (projects[1:], stop))

    def test_online_startup(self):
        self.run_modules(True)

    def test_cli_fails_fast_without_obs(self):
        self.run_modules(False, wait_for_obs=False)

    def test_ui_starts_offline_module_and_defers_the_rest(self):
        self.run_modules(False)

    def test_debug_updates_already_started_logger(self):
        with patch.object(main, 'ensure_import_paths'), patch.object(main, 'load_project_env'), \
             patch.object(main.log, 'start'), patch.object(main.log, 'set_level') as level, \
             patch('lib.process_priority.raise_priority'), patch.dict(main.os.environ):
            main._configure_runtime(True)
            level.assert_called_once_with(main.log.DEBUG)


class EditorLifecycleTests(unittest.TestCase):
    def test_standalone_and_embedded_lifecycle(self):
        for embedded in (False, True):
            with self.subTest(embedded=embedded), \
                 patch.object(editor, '_make_handler'), \
                 patch.object(editor, '_find_free_port', return_value=8765), \
                 patch.object(editor.http.server, 'HTTPServer') as factory, \
                 patch.object(editor.threading, 'Thread') as watcher, \
                 patch.object(editor.threading, 'Timer') as timer, patch('obs.get_obs'):
                server = factory.return_value
                stop = threading.Event() if embedded else None
                server.serve_forever.side_effect = KeyboardInterrupt
                editor.run_editor(asset_dir=Path('.'), hotkeys_file=Path('hotkeys.json'),
                                  valid_extensions={'.wav'}, project_name='Test',
                                  open_browser=not embedded, stop_event=stop)
                server.server_close.assert_called_once_with()
                server.serve_forever.assert_called_once_with()
                if embedded:
                    timer.assert_not_called()
                    watcher.return_value.start.assert_called_once_with()
                    stop.set()
                    watcher.call_args.kwargs['target']()
                    server.shutdown.assert_called_once_with()
                else:
                    timer.return_value.start.assert_called_once_with()
                    watcher.assert_not_called()


if __name__ == '__main__':
    unittest.main()

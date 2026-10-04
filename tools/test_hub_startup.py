"""Startup contracts without connecting to OBS or starting real module listeners."""
import subprocess
import queue
import sys
import threading
import time
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import main
from lib.hotkey_editor import server as editor


class ProjectReadinessTests(unittest.TestCase):
    def project(self, name, run):
        return SimpleNamespace(name=name, module=SimpleNamespace(run=run), queue=queue.Queue(), thread=None)

    def test_early_module_exit_does_not_wait_for_readiness_timeout(self):
        called = threading.Event()
        def ready(inbox, stop, startup_event):
            startup_event.set()
            called.set()
        projects = [self.project('ended', lambda inbox, stop: None), self.project('ready', ready)]
        started = time.monotonic()
        main._start_projects(projects, threading.Event())
        self.assertTrue(called.is_set())
        self.assertLess(time.monotonic() - started, 1)
        for project in projects:
            project.thread.join(2)

    def test_already_stopped_hub_starts_no_modules(self):
        stop = threading.Event()
        stop.set()
        run = Mock()
        main._start_projects([self.project('test', run)], stop)
        run.assert_not_called()

    def test_shutdown_interrupts_module_readiness_wait(self):
        stop, entered = threading.Event(), threading.Event()
        def run(inbox, stop):
            entered.set()
            stop.wait(2)
        project = self.project('loading', run)
        thread = threading.Thread(target=main._start_projects, args=([project], stop))
        thread.start()
        self.assertTrue(entered.wait(2))
        stop.set()
        thread.join(1)
        self.assertFalse(thread.is_alive())
        project.thread.join(2)


class HubStartupTests(unittest.TestCase):
    def test_supported_hub_owns_shutdown_of_started_services(self):
        import hub
        projects = [Mock()]
        captured = []
        def start(stop, **kwargs):
            captured.append(stop)
            return projects
        args = SimpleNamespace(only=None, skip=None, debug=False, no_editor=True,
                               port=7420, editor_port=8765, no_browser=True)
        monitor, ui_thread, preparation, chat_reader = Mock(), Mock(), Mock(), Mock()
        with patch.object(main, 'run_hub', side_effect=start), \
             patch.object(main, '_wait_for_shutdown', side_effect=lambda stop: stop.set()), \
             patch.object(main, '_join_projects') as join_projects, \
             patch('lib.performance_monitor.start_performance_monitor', return_value=monitor), \
             patch('lib.asset_preparation.preparation.start', return_value=preparation), \
             patch('lib.twitch_chat.start', return_value=chat_reader) as chat_start, \
             patch('hub_ui.server.HubUIServer'), \
             patch.object(hub.threading, 'Thread', return_value=ui_thread), \
             patch('lib.twitch_redemptions.start_viewer_rewards'), \
             patch('lib.twitch_stream_settings.service.service.start') as twitch_start, \
             patch('lib.twitch_stream_settings.service.service.join') as twitch_join, \
             patch('lib.chat_overlay.startup.startup.start') as overlay_start, \
             patch('lib.chat_overlay.startup.startup.join') as overlay_join, \
             patch('coordinator.coordinator.shutdown'), \
             patch('lib.global_hotkeys.shutdown_global_hotkeys') as shutdown_keys:
            hub._run(args)
        self.assertTrue(captured[0].is_set())
        join_projects.assert_called_once_with(projects)
        ui_thread.join.assert_called_once_with(timeout=5)
        monitor.join.assert_called_once_with(timeout=3)
        preparation.join.assert_called_once_with(timeout=4)
        chat_start.assert_called_once_with(captured[0])
        chat_reader.join.assert_called_once_with()
        shutdown_keys.assert_called_once()
        twitch_start.assert_called_once_with(captured[0], port=7420)
        twitch_join.assert_called_once()
        overlay_start.assert_called_once()
        overlay_join.assert_called_once()

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
        projects = [SimpleNamespace(name=name,module=SimpleNamespace(REQUIRES_OBS=name=='soundboard'))
                    for name in ('league_api','league_stats','twitch_commands','soundboard')]
        with ExitStack() as stack:
            mocks = {name: stack.enter_context(patch.object(main, name)) for name in (
                '_configure_runtime', '_check_obs_connection', 'discover_runnable_projects',
                'filter_projects', '_print_project_table', '_print_runtime_options',
                '_start_voice', '_start_projects')}
            stack.enter_context(patch('lib.settings_backups.start_settings_backups'))
            budget_bind = stack.enter_context(patch('lib.media_jobs.jobs.bind'))
            stack.enter_context(patch('lib.browser_effects.start_browser_effects'))
            stack.enter_context(patch('lib.coordination.scene_events.start_scene_events'))
            stack.enter_context(patch('coordinator.coordinator.bind'))
            stack.enter_context(patch.dict(sys.modules, hub_rules=Mock()))
            background = stack.enter_context(patch.object(main.threading, 'Thread'))
            mocks['_check_obs_connection'].return_value = obs_ready
            mocks['discover_runnable_projects'].return_value = projects
            mocks['filter_projects'].return_value = projects
            stop = threading.Event()
            result = main.run_hub(stop, only=['soundboard'], skip=['love_me'],
                                  debug=True, wait_for_obs=wait_for_obs)
            mocks['_configure_runtime'].assert_called_once_with(True)
            budget_bind.assert_called_once_with(stop)
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
                mocks['_start_projects'].assert_called_once_with(projects[:3], stop)
                mocks['_start_voice'].assert_not_called()
                background.return_value.start.assert_called_once_with()
                with patch('obs.get_obs'), patch.object(stop, 'wait', return_value=False):
                    background.call_args.kwargs['target']()
                mocks['_start_voice'].assert_called_once_with(stop)
                self.assertEqual(mocks['_start_projects'].call_args.args, (projects[3:], stop))

    def test_online_startup(self):
        self.run_modules(True)

    def test_cli_fails_fast_without_obs(self):
        self.run_modules(False, wait_for_obs=False)

    def test_ui_starts_offline_module_and_defers_the_rest(self):
        self.run_modules(False)

    def test_obs_dependency_is_explicit_metadata_not_a_project_name(self):
        from lib.hub_runtime.projects import partition_obs_projects
        independent=SimpleNamespace(name='any_feature',module=SimpleNamespace(REQUIRES_OBS=False))
        unknown=SimpleNamespace(name='league_stats',module=SimpleNamespace())
        invalid=SimpleNamespace(name='bad_metadata',module=SimpleNamespace(REQUIRES_OBS=0))
        ready,pending=partition_obs_projects([independent,unknown,invalid])
        self.assertEqual(ready,[independent]);self.assertEqual(pending,[unknown,invalid])

    def test_tracking_and_chat_declare_their_obs_independent_lifetimes(self):
        from league_stats import main as stats_main
        from twitch_commands import main as chat_main
        self.assertIs(stats_main.REQUIRES_OBS,False)
        self.assertIs(chat_main.REQUIRES_OBS,False)

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

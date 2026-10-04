"""Persistence and worker cleanup checks using temporary data and fake devices."""
import io
import json
import queue
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from lib.json_store import write_json
from lib.global_hotkeys import _SubprocessHotkeyBus, KeyEvent
from lib.project_settings import shift_project_volume_db
from lib.shared_media.playback_worker import PlaybackWorker
from hub_ui import hotkeys, settings, server
from hub_ui.routes.controls import ControlRoutes
from coordinator import PlayCoordinator, CoordinationRule
from voice import listener
import events


class PersistenceTests(unittest.TestCase):
    def test_failed_publish_retains_previous_file_and_removes_temporary(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'settings.json'
            path.write_text('{"personal": true}')
            with patch('lib.json_store.os.replace', side_effect=PermissionError('locked')):
                with self.assertRaises(PermissionError):
                    write_json(path, {'personal': False})
            self.assertEqual(json.loads(path.read_text()), {'personal': True})
            self.assertEqual(list(Path(folder).iterdir()), [path])

    def test_concurrent_writers_publish_complete_files_without_shared_temporaries(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'settings.json'
            with ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(lambda i: write_json(path, {'value': i, 'text': 'é' * 1000}), range(20)))
            saved = json.loads(path.read_text(encoding='utf-8'))
            self.assertIn(saved['value'], range(20))
            self.assertEqual(saved['text'], 'é' * 1000)
            self.assertEqual(list(Path(folder).iterdir()), [path])

    def test_nonfinite_bulk_volume_never_changes_personalized_settings(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'hotkeys_editor.json'
            before = '{"profiles":{"default":{"project_volume_db":-5.5}}}'
            path.write_text(before)
            for delta in (float('nan'), float('inf'), float('-inf')):
                self.assertFalse(shift_project_volume_db(Path(folder), delta))
            self.assertEqual(path.read_text(), before)

    def test_profile_endpoint_rejects_nonfinite_volume_before_touching_files(self):
        from hub_ui.routes.profiles import ProfileRoutes
        handler = Mock()
        handler._body.return_value = {'project': 'soundboard', 'project_volume_db': 'NaN'}
        with patch('hub_ui.routes.profiles.write_json') as write:
            ProfileRoutes._post_editor_profiles(handler)
        handler._err.assert_called_once_with(400, 'Volumes must be finite numbers')
        write.assert_not_called()

    def test_editor_invalid_volume_cannot_reset_existing_level(self):
        from lib.hotkey_editor import server as editor
        handler_class = editor._make_handler(current={'proj': {}}, all_projects=[], server_ref=[None])
        handler = Mock()
        with patch.object(editor, '_load_editor_state') as load:
            handler_class._handle_save(handler, {'project_volume_db': 'invalid'})
        handler._json_err.assert_called_once_with('Volumes must be finite numbers')
        load.assert_not_called()

    def test_rule_write_failure_leaves_live_rules_unchanged(self):
        coordinator = PlayCoordinator()
        old = CoordinationRule('soundboard', ['specific_song'])
        coordinator.add_rule(old)
        handler = Mock()
        handler._body.return_value = {'rules': [{'requester': 'instant_replay', 'pause': []}]}
        with patch('coordinator.coordinator', coordinator), \
             patch('hub_ui.routes.controls.write_json', side_effect=OSError('disk unavailable')):
            ControlRoutes._post_rules(handler)
        handler._err.assert_called_once()
        handler._json.assert_not_called()
        self.assertEqual(coordinator.get_rules(), [old])

    def test_invalid_rule_update_never_clears_current_rules(self):
        coordinator = PlayCoordinator()
        old = CoordinationRule('soundboard', ['specific_song'])
        coordinator.add_rule(old)
        with patch('coordinator.coordinator', coordinator):
            with self.assertRaises(ValueError):
                settings.apply_rules_from_list([{'requester': 'valid'}, 'invalid'])
        self.assertEqual(coordinator.get_rules(), [old])

    def test_malformed_body_cannot_become_empty_settings(self):
        for payload in (b'{broken', b'[]', b'null', b'"text"'):
            handler = SimpleNamespace(headers={'Content-Length': str(len(payload))},
                                      rfile=io.BytesIO(payload))
            with self.assertRaises(server.InvalidRequestBody):
                server._Handler._body(handler)

    def test_post_reports_invalid_body_as_client_error(self):
        handler = Mock()
        handler._route_post.side_effect = server.InvalidRequestBody('Invalid JSON')
        server._Handler.do_POST(handler)
        handler._err.assert_called_once_with(400, 'Invalid JSON')

    def test_static_files_cannot_escape_application_directory(self):
        handler = Mock()
        server._Handler._static(handler, '/../server.py')
        handler._err.assert_called_once_with(404, 'Not found')
        handler.wfile.write.assert_not_called()


class WorkerCleanupTests(unittest.TestCase):
    def bus(self):
        with patch('lib.global_hotkeys.atexit.register'):
            return _SubprocessHotkeyBus()

    def test_old_worker_queue_cannot_dispatch_into_replacement(self):
        bus = self.bus()
        old, new = Mock(), Mock()
        old_queue, new_queue = queue.Queue(), queue.Queue()
        event = KeyEvent('x', '')
        for inbox in (old_queue, new_queue):
            inbox.put(event)
            inbox.put(None)
        callback = Mock()
        bus._callbacks[1] = callback
        bus._proc = new
        bus._dispatch_loop(old, old_queue)
        callback.assert_not_called()
        bus._dispatch_loop(new, new_queue)
        callback.assert_called_once_with(event)

    def test_failed_playback_thread_start_does_not_leave_worker_permanently_busy(self):
        worker = PlaybackWorker('cleanup-test')
        with patch('lib.shared_media.playback_worker.threading.Thread') as thread:
            thread.return_value.start.side_effect = RuntimeError('cannot start')
            with self.assertRaises(RuntimeError):
                worker.submit(Mock())
        self.assertFalse(worker.busy)
        ran = threading.Event()
        self.assertTrue(worker.submit(lambda cancelled: ran.set()).wait(2))
        self.assertTrue(ran.is_set())

    def test_browser_server_start_failure_releases_port_and_runtime(self):
        from lib.browser_effects import runtime
        fake_server = Mock()
        with patch.object(runtime, '_server', None), \
             patch.object(runtime, 'ThreadingHTTPServer', return_value=fake_server), \
             patch.object(runtime.threading, 'Thread') as thread:
            thread.return_value.start.side_effect = RuntimeError('cannot start')
            with self.assertRaises(RuntimeError):
                runtime.start_browser_effects(threading.Event())
            fake_server.server_close.assert_called_once()
            self.assertIsNone(runtime._server)

    def test_viewer_service_construction_failure_releases_port(self):
        from lib.twitch_redemptions import service
        fake_server = Mock()
        with patch.object(service, 'ThreadingHTTPServer', return_value=fake_server), \
             patch.object(service, 'RewardBridge', side_effect=RuntimeError('bad storage')):
            with self.assertRaises(RuntimeError):
                service.start_viewer_rewards(threading.Event())
        fake_server.server_close.assert_called_once()

    def test_browser_shutdown_watcher_failure_releases_running_server(self):
        from lib.browser_effects import runtime
        fake_server, broken, remaining = Mock(), Mock(), Mock()
        broken.stop.side_effect = RuntimeError('channel cleanup failed')
        with patch.object(runtime, '_server', None), \
             patch.object(runtime, '_channels', {'broken': broken, 'remaining': remaining}), \
             patch.object(runtime, 'ThreadingHTTPServer', return_value=fake_server), \
             patch.object(runtime.threading, 'Thread') as thread:
            thread.return_value.start.side_effect = [None, RuntimeError('no watcher')]
            with self.assertRaises(RuntimeError):
                runtime.start_browser_effects(threading.Event())
            remaining.stop.assert_called_once()
            fake_server.shutdown.assert_called_once()
            fake_server.server_close.assert_called_once()
            self.assertIsNone(runtime._server)

    def test_partial_viewer_startup_stops_its_workers_and_releases_server(self):
        from lib.twitch_redemptions import service
        for failed_start in range(5):
            with self.subTest(failed_start=failed_start):
                parent_stop = threading.Event()
                fake_server, bridge = Mock(), Mock()
                bridge.socket.close.side_effect = RuntimeError('socket already closed')
                with patch.object(service, 'ThreadingHTTPServer', return_value=fake_server), \
                     patch.object(service, 'RewardBridge', return_value=bridge) as create, \
                     patch.object(service.threading, 'Thread') as thread:
                    thread.return_value.start.side_effect = [None] * failed_start + [RuntimeError('no thread')]
                    with self.assertRaises(RuntimeError):
                        service.start_viewer_rewards(parent_stop)
                    self.assertTrue(create.call_args.args[0].is_set())
                    self.assertFalse(parent_stop.is_set())
                    fake_server.server_close.assert_called_once()
                    self.assertEqual(fake_server.shutdown.call_count, int(failed_start > 0))

    def test_worker_eof_closes_pipe_and_ends_dispatch_thread(self):
        bus = self.bus()
        proc = SimpleNamespace(stdout=io.StringIO('{"char":"x","name":""}\n'))
        bus._proc = proc
        inbox = queue.Queue()
        received = []
        bus._callbacks[1] = received.append
        dispatch = threading.Thread(target=bus._dispatch_loop, args=(proc, inbox), daemon=True)
        dispatch.start()
        bus._reader_loop(proc, inbox)
        dispatch.join(2)
        self.assertFalse(dispatch.is_alive())
        self.assertTrue(proc.stdout.closed)
        self.assertEqual(received, [KeyEvent('x', '')])

    def test_shutdown_closes_parent_pipe_and_waits_for_worker(self):
        bus = self.bus()
        proc = Mock()
        proc.poll.return_value = None
        bus._proc = proc
        bus.shutdown()
        proc.stdin.close.assert_called_once()
        proc.wait.assert_called_once_with(timeout=2.0)
        proc.kill.assert_not_called()
        self.assertIsNone(bus._proc)

    def test_keyboard_thread_start_failure_releases_child_and_unread_pipes(self):
        bus = self.bus()
        proc = Mock()
        proc.poll.return_value = None
        with patch('lib.global_hotkeys.subprocess.Popen', return_value=proc), \
             patch('lib.global_hotkeys.threading.Thread') as thread:
            thread.return_value.start.side_effect = RuntimeError('no thread')
            with self.assertRaises(RuntimeError):
                bus._ensure_started()
        self.assertIsNone(bus._proc)
        proc.stdin.close.assert_called_once()
        proc.wait.assert_called_once_with(timeout=2.0)
        proc.stdout.close.assert_called_once()
        proc.stderr.close.assert_called_once()

    def test_partial_keyboard_start_failure_releases_unread_stdout(self):
        bus = self.bus()
        proc = Mock()
        proc.poll.return_value = None
        with patch('lib.global_hotkeys.subprocess.Popen', return_value=proc), \
             patch('lib.global_hotkeys.threading.Thread') as thread:
            thread.return_value.start.side_effect = [None, None, RuntimeError('no reader')]
            with self.assertRaises(RuntimeError):
                bus._ensure_started()
        self.assertIsNone(bus._proc)
        proc.stdout.close.assert_called_once()
        self.assertIsNone(bus._queue.get_nowait())

    def test_unsubscribe_does_not_accumulate_empty_event_entries(self):
        callback = Mock()
        name = 'test.cleanup.only'
        events.unsubscribe(name, callback)
        self.assertNotIn(name, events._listeners)
        events.subscribe(name, callback)
        events.unsubscribe(name, callback)
        self.assertNotIn(name, events._listeners)

    def test_already_stopped_voice_completes_processing_without_inference(self):
        done = Mock()
        with patch.object(listener, '_recording', False), \
             patch.object(listener, '_transcribe_and_send') as transcribe:
            listener.stop_and_transcribe(Mock(), 'instant_replay', on_complete=done)
        done.assert_called_once()
        transcribe.assert_not_called()

    def test_hotkeys_reload_once_per_file_change_and_pick_up_new_binding(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'hub_settings.json'
            write_json(path, {'hub_hotkeys': {}, 'hub_workflows': []})
            stop, subscribed, fired = threading.Event(), threading.Event(), threading.Event()
            callbacks = []
            def subscribe(callback):
                callbacks.append(callback)
                subscribed.set()
                return 1
            with patch.object(settings, '_SETTINGS_FILE', path), \
                 patch.object(settings, 'load_settings', wraps=settings.load_settings) as load, \
                 patch('lib.global_hotkeys.subscribe_global_hotkeys', side_effect=subscribe), \
                 patch('lib.global_hotkeys.unsubscribe_global_hotkeys'), \
                 patch('hub_ui.commands.run_hub_action', side_effect=lambda **kw: fired.set()):
                worker = threading.Thread(target=hotkeys.hub_hotkey_loop, args=(stop,), daemon=True)
                worker.start()
                try:
                    self.assertTrue(subscribed.wait(2))
                    for _ in range(20):
                        callbacks[0](KeyEvent('x', ''))
                    self.assertEqual(load.call_count, 1)
                    write_json(path, {'hub_hotkeys': {'abort_all_audio': {
                        'enabled': True, 'sequence': 'z'}}, 'hub_workflows': []})
                    callbacks[0](KeyEvent('z', ''))
                    self.assertTrue(fired.wait(2))
                    self.assertEqual(load.call_count, 2)
                finally:
                    stop.set()
                    worker.join(2)
                self.assertFalse(worker.is_alive())


if __name__ == '__main__':
    unittest.main()

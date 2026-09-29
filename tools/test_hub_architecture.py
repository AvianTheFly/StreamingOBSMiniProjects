"""Hub boundaries exercised without real OBS, keyboard hooks or user-file writes."""
import http.client
import json
import queue
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from hub_ui import audio, commands, hotkeys, project_status, server, settings, updates


class HubArchitectureTests(unittest.TestCase):
    def test_importing_ui_has_no_runtime_side_effects(self):
        result = subprocess.run([sys.executable, '-c', '''
import threading, socket, unittest.mock as mock
before = threading.enumerate()
with mock.patch.object(socket.socket, 'bind', side_effect=AssertionError('socket at import')):
    import hub_ui.server, hub_ui.audio, hub_ui.commands, hub_ui.hotkeys
assert threading.enumerate() == before
assert not any(t.name.startswith('hub_ui:') for t in threading.enumerate())
'''], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_event_forwarding_is_scoped_and_slow_browser_is_bounded(self):
        import events
        with updates.subscription() as slow, updates.subscription() as fast:
            for _ in range(200):
                slow.put_nowait(b'old')
            with updates.forward_domain_events():
                events.emit('game.connected', test=True)
                payload = json.loads(fast.get_nowait().decode().removeprefix('data: '))
                self.assertEqual(payload, {'type': 'hub_event', 'payload': {
                    'event': 'game.connected', 'data': {'test': True}}})
                self.assertEqual(slow.qsize(), 200)
            events.emit('game.connected', test=True)
            with self.assertRaises(queue.Empty):
                fast.get_nowait()
        self.assertNotIn(slow, updates._sse_clients)
        self.assertNotIn(fast, updates._sse_clients)

    def test_commands_share_dispatch_and_notifications(self):
        with updates.subscription() as inbox, patch('hub_actions.run_project_action',
                return_value={'ok': True}) as dispatch:
            result = commands.run_project_action('soundboard', 'pause', source='hotkey')
            dispatch.assert_called_once_with('soundboard', 'pause')
            self.assertTrue(result['ok'])
            payload = json.loads(inbox.get_nowait().decode().removeprefix('data: '))['payload']
            self.assertEqual(payload['action'], 'project:soundboard:pause')
            self.assertEqual(payload['source'], 'hotkey')

    def test_hotkey_configuration_keeps_disabled_and_empty_sequences_inactive(self):
        data = {'hub_hotkeys': {
            'yes': {'enabled': True, 'sequence': 'a+b'},
            'no': {'enabled': False, 'sequence': 'xy'},
            'empty': {'enabled': True, 'sequence': ''}},
            'hub_workflows': [{'id': 'flow', 'enabled': True, 'sequence': 'zz'}]}
        with patch.object(settings, 'load_settings', return_value=data):
            self.assertEqual(list(hotkeys.hub_hotkey_configs()), ['yes'])
            self.assertEqual(list(hotkeys.hub_workflow_configs()), ['flow'])
            self.assertEqual(hotkeys.parse_hotkey_sequence('a+b'), ['a', 'b'])

    def test_bind_failure_starts_no_ui_workers_or_subscriptions(self):
        with patch.object(server.http.server, 'ThreadingHTTPServer', side_effect=OSError('busy')), \
             patch.object(server.threading, 'Thread') as thread, \
             patch.object(updates, 'forward_domain_events') as forward:
            with self.assertRaises(OSError):
                server.HubUIServer(port=0).serve(threading.Event())
            thread.assert_not_called()
            forward.assert_not_called()

    def test_partial_worker_startup_releases_socket_and_subscriptions(self):
        http_server = server.http.server.ThreadingHTTPServer(('127.0.0.1', 0), server._Handler)
        local_stops = []
        real_thread = threading.Thread
        def thread_factory(**kwargs):
            if kwargs['name'] == 'hub_ui:poll':
                local_stops.append(kwargs['args'][0])
                return real_thread(target=lambda: kwargs['args'][0].wait(), daemon=True)
            worker = Mock()
            worker.is_alive.return_value = False
            if kwargs['name'] == 'hub_ui:hotkeys':
                worker.start.side_effect = RuntimeError('worker startup failed')
            return worker

        with updates.subscription() as inbox, \
             patch.object(server.http.server, 'ThreadingHTTPServer', return_value=http_server), \
             patch.object(server.threading, 'Thread', side_effect=thread_factory):
            with self.assertRaisesRegex(RuntimeError, 'worker startup failed'):
                server.HubUIServer(port=0).serve(threading.Event())
            self.assertTrue(local_stops[0].is_set())
            self.assertEqual(http_server.socket.fileno(), -1)
            import events
            events.emit('game.connected')
            self.assertTrue(inbox.empty())

    def test_failed_sse_connection_releases_browser_queue(self):
        handler = Mock()
        handler.wfile.write.side_effect = BrokenPipeError()
        before = list(updates._sse_clients)
        with patch.object(project_status, 'all_statuses', return_value=[]):
            updates.stream(handler)
        self.assertEqual(updates._sse_clients, before)

    def test_real_http_routes_and_shutdown_preserve_contract(self):
        stop = threading.Event()
        poll_started, keys_started = threading.Event(), threading.Event()
        worker_stops = []

        def worker(local_stop, ready):
            worker_stops.append(local_stop)
            ready.set()
            local_stop.wait()

        with tempfile.TemporaryDirectory() as folder:
            saved_path = Path(folder) / 'hub_settings.json'
            saved_path.write_text(json.dumps({'custom': 'keep me', 'hub_hotkeys': {}}))
            http_server = server.http.server.ThreadingHTTPServer(('127.0.0.1', 0), server._Handler)
            port = http_server.server_port
            errors = []
            def serve():
                try:
                    server.HubUIServer(port=port, editor_port=9876).serve(stop)
                except Exception as exc:
                    errors.append(exc)

            with patch.object(server.http.server, 'ThreadingHTTPServer', return_value=http_server), \
                 patch.object(settings, '_SETTINGS_FILE', saved_path), \
                 patch.object(updates, 'poll_loop', side_effect=lambda s: worker(s, poll_started)), \
                 patch.object(hotkeys, 'hub_hotkey_loop', side_effect=lambda s: worker(s, keys_started)), \
                 patch.object(project_status, 'all_statuses', return_value=[{'name': 'soundboard'}]), \
                 patch('lib.project_registry.discover_editor_projects', return_value={}), \
                 patch('lib.project_registry.discover_runnable_projects', return_value=[]), \
                 patch.object(server.AudioRoutes, '_get_obs_audio', autospec=True,
                              side_effect=lambda h: h._json(200, {'inputs': []})), \
                 patch.object(audio, 'sync_audio_memory_from_obs', return_value=set()), \
                 patch.object(audio, 'love_me_audio_payload', return_value=None), \
                 patch('hub_actions.run_project_action', return_value={'ok': True}) as command:
                thread = threading.Thread(target=serve, daemon=True)
                thread.start()
                try:
                    self.assertTrue(poll_started.wait(2))
                    self.assertTrue(keys_started.wait(2))
                    def request(path, body=None):
                        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
                        try:
                            connection.request('GET' if body is None else 'POST', path,
                                               body=None if body is None else json.dumps(body),
                                               headers={'Content-Type': 'application/json'})
                            response = connection.getresponse()
                            data = response.read()
                            return response.status, dict(response.getheaders()), data
                        finally:
                            connection.close()

                    for path in ['/api/status', '/api/settings', '/api/hub-actions',
                                 '/api/editor-profiles', '/api/audio', '/api/obs/audio',
                                 '/api/projects', '/api/info', '/api/projects/soundboard']:
                        code, _, body = request(path)
                        self.assertEqual(code, 200, path)
                        self.assertIsInstance(json.loads(body), (dict, list))
                    self.assertEqual(json.loads(request('/api/settings')[2])['custom'], 'keep me')
                    self.assertEqual(json.loads(request('/api/info')[2])['editor_port'], 9876)
                    self.assertEqual(request('/editor')[1]['Location'], 'http://localhost:9876')
                    self.assertEqual(request('/api/projects/missing')[0], 404)
                    self.assertEqual(request('/api/project-actions/soundboard/pause', {})[0], 200)
                    command.assert_called_once_with('soundboard', 'pause')
                    self.assertEqual(request('/api/audio', {'project': 'soundboard', 'project_volume_db': 'NaN'})[0], 400)
                    stream = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
                    try:
                        stream.request('GET', '/api/events')
                        response = stream.getresponse()
                        self.assertEqual(response.status, 200)
                        self.assertIn('text/event-stream', response.getheader('Content-Type'))
                        event = json.loads(response.readline().decode().removeprefix('data: '))
                        self.assertEqual(event['type'], 'status_update')
                        self.assertEqual(event['payload']['projects'], [{'name': 'soundboard'}])
                        response.close()
                    finally:
                        stream.close()
                finally:
                    stop.set()
                    thread.join(4)
                self.assertFalse(thread.is_alive())
                self.assertEqual(errors, [])
                self.assertTrue(all(s.is_set() for s in worker_stops))
                self.assertEqual(http_server.socket.fileno(), -1)


if __name__ == '__main__':
    unittest.main()

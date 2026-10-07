"""Notification wakeups, bounded HTTP waits and settings-preserving owner moves."""
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.request import urlopen

from lib.paths import ensure_import_paths
ensure_import_paths()
from twitch_celebrations import service as module
from twitch_celebrations.http_server import handler


class CelebrationTransportTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        for mocked in (patch.object(module,'ROOT',self.root), patch.object(module,'Twitch'),
                       patch('lib.settings_backups.SettingsBackups')):
            mocked.start()
            self.addCleanup(mocked.stop)
        self.service = module.Service(threading.Event())
        self.addCleanup(self.service.close)

    def waiter(self, revision):
        waiting = threading.Event()
        original = self.service._changed.wait
        def wait(timeout=None):
            waiting.set()
            return original(timeout)
        results = []
        with patch.object(self.service._changed,'wait',side_effect=wait):
            worker = threading.Thread(target=lambda: results.append(self.service.wait_overlay(revision)))
            worker.start()
            self.assertTrue(waiting.wait(1))
        self.addCleanup(worker.join,2)
        return worker,results

    def test_idle_wait_releases_lock_and_event_starts_only_once(self):
        first = self.service.wait_overlay(-1)
        worker,results = self.waiter(first['revision'])
        self.assertTrue(worker.is_alive())
        self.assertTrue(self.service.receive('follow','Fixture viewer'))
        worker.join(.5)
        self.assertFalse(worker.is_alive())
        shown = results[0]['active']
        self.assertEqual(shown['name'],'Fixture viewer')
        again = self.service.wait_overlay(results[0]['revision'])
        self.assertEqual(shown['id'],again['active']['id'])
        self.assertFalse(self.service.engine.queue)

    def test_settings_controls_and_shutdown_wake_waiters(self):
        for action in (lambda:self.service.set_paused(True),self.service.clear,
                       lambda:self.service.save({'volume':.4}),self.service.close):
            revision = self.service.wait_overlay(-1)['revision']
            worker,result = self.waiter(revision)
            action()
            worker.join(.5)
            self.assertFalse(worker.is_alive())
            self.assertIsNone(result[0]['active'])
        self.assertFalse(self.service.receive('raid','After shutdown'))

    def test_save_merges_unknown_external_fields_and_preserves_malformed_data(self):
        path = self.root/'settings.json'
        path.write_text(json.dumps({'custom_owner_note':'preserve','volume':.1}))
        self.service.save({'muted':True})
        self.assertEqual(json.loads(path.read_text())['custom_owner_note'],'preserve')
        self.assertEqual(self.service.settings['volume'],.1)
        path.write_text('{broken')
        with self.assertRaises(ValueError):
            self.service.save({'volume':.3})
        self.assertEqual(path.read_text(),'{broken')

    def test_http_wait_is_bounded_and_returns_only_complete_viewer_state(self):
        server = ThreadingHTTPServer(('127.0.0.1',0),handler(self.service,self.root,0))
        port = server.server_port
        server.RequestHandlerClass = handler(self.service,self.root,port)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            url=f'http://127.0.0.1:{port}/api/overlay?after='
            with urlopen(url+'-1',timeout=2) as r:
                initial=json.load(r)
            start=time.monotonic()
            with urlopen(url+str(initial['revision']),timeout=2) as r:
                result=json.load(r)
            self.assertGreater(time.monotonic()-start,.8)
            self.assertEqual(result,initial)
            self.assertEqual(set(result),{'active','settings','revision'})
        finally:
            self.service.close()
            server.shutdown()
            server.server_close()
            thread.join(2)


if __name__ == '__main__':
    unittest.main()

"""Idle notification, control handoffs and bounded HTTP wait contracts."""
import json
import queue
import sys
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.service import SpotifyState
from spotify.http_server import make_server


class SpotifyNotificationTests(unittest.TestCase):
    def test_capture_clock_is_complete_and_stale_audio_has_no_clock(self):
        from spotify.audio_analysis import quiet_features
        state = SpotifyState()
        clock = time.perf_counter()
        state.publish_audio([.2]*48, quiet_features(), clock, .1, True)
        snapshot = state.snapshot()
        self.assertEqual(snapshot['sample_time'], clock)
        self.assertEqual(snapshot['audio_revision'], 1)
        state.audio_updated = time.monotonic() - 1
        self.assertIsNone(state.snapshot()['sample_time'])

    def test_idle_waiters_release_state_lock_and_wake_together_on_playback(self):
        state = SpotifyState()
        media = dict(playing=False, title='Song', artist='Artist', error='')
        state.set_media(**media)
        after = state.snapshot()['revision']
        waiting, results = queue.Queue(), queue.Queue()
        original = state._changed.wait

        def wait(*args, **kwargs):
            waiting.put(True)
            return original(*args, **kwargs)

        threads = [threading.Thread(target=lambda: results.put(state.wait_snapshot(after))) for _ in range(3)]
        with patch.object(state._changed, 'wait', side_effect=wait):
            try:
                for worker in threads:
                    worker.start()
                for _ in threads:
                    waiting.get(timeout=2)
                # Regular state reads and media heartbeats remain available while clients sleep.
                self.assertFalse(state.snapshot()['playing'])
                state.set_media(**media)
                self.assertEqual(state.snapshot()['revision'], after)
                self.assertTrue(results.empty(), 'unchanged idle heartbeats must not create poll churn')
                state.set_media(**{**media, 'playing': True})
                for _ in threads:
                    self.assertTrue(results.get(timeout=.5)['playing'])
            finally:
                state.set_media(playing=False, title='', artist='', error='Hub stopped')
                for worker in threads:
                    worker.join(2)
                    self.assertFalse(worker.is_alive())

    def test_hidden_resume_and_freshness_recovery_publish_new_revision(self):
        state = SpotifyState()
        media = dict(playing=True, title='Song', artist='Artist', error='')
        state.set_media(**media)
        state.set_hidden(True)
        after = state.snapshot()['revision']
        state.set_hidden(True)
        self.assertEqual(state.snapshot()['revision'], after)
        state.set_hidden(False)
        self.assertTrue(state.wait_snapshot(after)['playing'])
        state.updated -= 3
        self.assertFalse(state.snapshot()['playing'])
        after = state.snapshot()['revision']
        state.set_media(**media)
        restored = state.wait_snapshot(after)
        self.assertTrue(restored['playing'])
        self.assertGreater(restored['revision'], after)

    def test_active_audio_never_enters_condition_wait(self):
        state = SpotifyState()
        state.set_media(playing=True, title='Song', artist='Artist', error='')
        with patch.object(state._changed, 'wait', side_effect=AssertionError('active poll blocked')):
            self.assertTrue(state.wait_snapshot(state.snapshot()['revision'])['playing'])

    def test_idle_wait_has_bounded_timeout_without_another_worker(self):
        state = SpotifyState()
        finished = threading.Event()
        worker = threading.Thread(target=lambda: (state.wait_snapshot(0, timeout=100), finished.set()))
        worker.start()
        try:
            self.assertFalse(finished.wait(.1))
            self.assertTrue(finished.wait(1.4), 'disconnects must release idle handlers within one second')
        finally:
            worker.join(2)

    def test_audio_wait_wakes_on_complete_latest_sample_and_releases_lock(self):
        state = SpotifyState()
        state.set_media(playing=True, title='Song', artist='Artist', error='')
        waiting, result = threading.Event(), queue.Queue()
        original = state._changed.wait
        def wait(*args, **kwargs):
            waiting.set()
            return original(*args, **kwargs)
        worker = threading.Thread(target=lambda: result.put(state.wait_audio(0)))
        with patch.object(state._changed, 'wait', side_effect=wait):
            try:
                worker.start()
                self.assertTrue(waiting.wait(1))
                self.assertEqual(state.snapshot()['audio_revision'], 0)
                state.publish_audio([.3]*48, {'energy': .7}, time.perf_counter(), .4, True)
                snapshot = result.get(timeout=.15)
                self.assertEqual(snapshot['audio_revision'], 1)
                self.assertEqual(snapshot['bands'], [.3]*48)
                self.assertEqual(snapshot['energy'], .7)
                self.assertTrue(snapshot['timestamp_valid'])
                self.assertLess(snapshot['sample_age_ms'], 150)
            finally:
                worker.join(1)
                self.assertFalse(worker.is_alive())
        # Slow clients receive only the newest complete frame, never a backlog.
        state.publish_audio([.5]*48, {'energy': .8}, time.perf_counter(), .5)
        state.publish_audio([.9]*48, {'energy': .9}, time.perf_counter(), .6)
        with patch.object(state._changed, 'wait', side_effect=AssertionError('latest sample blocked')):
            self.assertEqual(state.wait_audio(1)['bands'], [.9]*48)

    def test_audio_wait_is_bounded_and_pause_interrupts(self):
        state = SpotifyState()
        media = dict(playing=True, title='Song', artist='Artist', error='')
        state.set_media(**media)
        began = time.monotonic()
        state.wait_audio(0, timeout=100)
        self.assertLess(time.monotonic()-began, .5)
        waiting, result = threading.Event(), queue.Queue()
        original = state._changed.wait
        def wait(*args, **kwargs):
            waiting.set()
            return original(*args, **kwargs)
        worker = threading.Thread(target=lambda: result.put(state.wait_audio(0)))
        with patch.object(state._changed, 'wait', side_effect=wait):
            try:
                worker.start()
                self.assertTrue(waiting.wait(1))
                state.set_media(**{**media, 'playing': False})
                self.assertFalse(result.get(timeout=.15)['playing'])
            finally:
                worker.join(1)
                self.assertFalse(worker.is_alive())

    def test_interface_controls_notify_state_owner(self):
        from spotify.interface import SpotifyInterface, _live
        state = SpotifyState()
        with patch.dict(_live, {'state': state}, clear=True):
            interface = SpotifyInterface()
            after = state.snapshot()['revision']
            interface.pause()
            self.assertTrue(state.hidden)
            self.assertGreater(state.snapshot()['revision'], after)
            interface.resume()
            self.assertFalse(state.hidden)


class SpotifyHTTPWaitTests(unittest.TestCase):
    def setUp(self):
        self.state = SpotifyState()
        self.server = make_server(self.state, 0)
        self.worker = threading.Thread(target=self.server.serve_forever)
        self.worker.start()
        self.root = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.state.set_media(playing=False, title='', artist='', error='Hub stopped')
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(2)

    def test_http_idle_request_wakes_on_media_change_without_blocking_other_reads(self):
        waiting, received = threading.Event(), queue.Queue()
        original = self.state._changed.wait

        def wait(*args, **kwargs):
            waiting.set()
            return original(*args, **kwargs)

        def request():
            try:
                with urlopen(self.root + '/api/state?after=0', timeout=3) as response:
                    received.put(json.load(response))
            except Exception as exc:
                received.put(exc)

        client = threading.Thread(target=request)
        with patch.object(self.state._changed, 'wait', side_effect=wait):
            try:
                client.start()
                self.assertTrue(waiting.wait(2))
                with urlopen(self.root + '/api/state', timeout=1) as response:
                    self.assertFalse(json.load(response)['playing'])
                self.state.set_media(playing=True, title='Immediate', artist='Artist', error='')
                data = received.get(timeout=.5)
                self.assertIsInstance(data, dict)
                self.assertTrue(data['playing'])
                self.assertEqual(data['title'], 'Immediate')
            finally:
                client.join(3)
                self.assertFalse(client.is_alive())

    def test_invalid_revision_rejected_and_stale_revision_returns_current_snapshot(self):
        for parameter in ('after', 'audio_after'):
            for value in ('', 'wrong'):
                with self.assertRaises(HTTPError) as error:
                    urlopen(self.root + '/api/state?' + parameter + '=' + value, timeout=1)
                self.assertEqual(error.exception.code, 400)
        with urlopen(self.root + '/api/state?after=-1', timeout=1) as response:
            self.assertEqual(json.load(response)['revision'], 0)
        with urlopen(self.root + '/api/state?audio_after=-1&after=0', timeout=1) as response:
            self.assertEqual(json.load(response)['audio_revision'], 0)


if __name__ == '__main__':
    unittest.main()

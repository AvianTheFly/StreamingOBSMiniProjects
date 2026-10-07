"""Bounded browser change delivery, concurrent control and stale identities."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import threading
import time
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
import json
from urllib.request import urlopen
from urllib.error import HTTPError
from lib.browser_effects.session import Channel
from lib.browser_effects.http_server import handler


class ChannelWaitTests(unittest.TestCase):
    def waiters(self, channel, count, change):
        # Observe entry into Condition.wait rather than guessing when a worker ran.
        entered = threading.Barrier(count + 1)
        original = channel.changed.wait

        def wait(timeout=None):
            # A barrier under the lock would deadlock. Notify the test via one
            # event per waiter, then let Condition.wait release the channel lock.
            signals[threading.get_ident()].set()
            return original(timeout)

        signals = {}
        signals_lock = threading.Lock()
        def reader():
            signal = threading.Event()
            with signals_lock:
                signals[threading.get_ident()] = signal
            entered.wait(timeout=2)
            return channel.wait_snapshot(channel.revision)

        with patch.object(channel.changed, 'wait', side_effect=wait), ThreadPoolExecutor(count) as pool:
            futures = [pool.submit(reader) for _ in range(count)]
            entered.wait(timeout=2)
            for signal in list(signals.values()):
                self.assertTrue(signal.wait(1))
            # Acquiring the channel lock also proves each reader released it.
            change()
            return [f.result(timeout=1) for f in futures]

    def test_idle_readers_wake_together_for_play_without_holding_lock(self):
        channel = Channel()
        rows = self.waiters(channel, 3, lambda: channel.begin('cue',Path('cue.wav'),{}))
        self.assertEqual(len({r['active']['id'] for r in rows}), 1)
        self.assertTrue(all(r['ready'] and r['revision'] == 1 for r in rows))

    def test_pause_resume_and_stop_notify_current_generation(self):
        channel = Channel()
        identity = channel.begin('cue', Path('cue.wav'), {})
        for paused in (True, False):
            rows = self.waiters(channel, 1, lambda: channel.pause(paused))
            self.assertEqual(rows[0]['active']['paused'], paused)
        rows = self.waiters(channel, 1, lambda: channel.stop(identity))
        self.assertIsNone(rows[0]['active'])

    def test_stale_ack_and_stop_cannot_change_replacement_revision(self):
        channel = Channel()
        old = channel.begin('old',Path('old.wav'),{})
        new = channel.begin('new',Path('new.wav'),{})
        revision = channel.revision
        self.assertFalse(channel.acknowledge(old,'ended'))
        channel.stop(old)
        self.assertEqual(channel.revision, revision)
        self.assertEqual(channel.snapshot()['active']['id'], new)

    def test_timeout_heartbeats_and_mismatched_revision_returns_immediately(self):
        channel = Channel()
        began = time.monotonic()
        state = channel.wait_snapshot(channel.revision, .04)
        self.assertGreaterEqual(time.monotonic()-began,.03)
        self.assertTrue(state['ready'])
        with patch.object(channel.changed,'wait',side_effect=AssertionError('Must not wait')):
            self.assertEqual(channel.wait_snapshot(999)['revision'], state['revision'])

    def test_duplicate_playing_ack_does_not_wake_idle_http(self):
        channel = Channel()
        identity = channel.begin('cue',Path('cue.wav'),{})
        channel.acknowledge(identity,'playing')
        revision = channel.revision
        channel.acknowledge(identity,'playing')
        self.assertEqual(channel.revision, revision)

    def test_http_notification_legacy_reads_and_invalid_revisions(self):
        channel = Channel()
        server = ThreadingHTTPServer(('127.0.0.1',0), handler(lambda _:channel,0))
        server.RequestHandlerClass = handler(lambda _:channel,server.server_port)
        worker = threading.Thread(target=server.serve_forever)
        worker.start()
        url = f'http://127.0.0.1:{server.server_port}/api/state/soundboard'
        def read(path=url):
            with urlopen(path,timeout=2) as response:
                return json.load(response)
        try:
            initial = read()
            waiting = threading.Event()
            original = channel.changed.wait
            def wait(timeout=None):
                waiting.set()
                return original(timeout)
            with patch.object(channel.changed,'wait',side_effect=wait), ThreadPoolExecutor(1) as pool:
                future = pool.submit(read,url+f"?after={initial['revision']}")
                self.assertTrue(waiting.wait(1))
                self.assertIsNone(read()['active'])  # Legacy HTTP request is not blocked.
                identity = channel.begin('cue',Path('cue.wav'),{})
                self.assertEqual(future.result(timeout=1)['active']['id'],identity)
            for query in ('-1','nan','1.5'):
                with self.assertRaises(HTTPError) as error:
                    read(url+'?after='+query)
                self.assertEqual(error.exception.code,400)
        finally:
            channel.stop()
            server.shutdown()
            server.server_close()
            worker.join(2)


if __name__ == '__main__':
    unittest.main()

"""Causal aperture, frequency fidelity, packet cadence and persistent HTTP lifetime."""
import http.client
import asyncio
import json
import sys
import threading
import time
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.audio_analysis import AudioAnalysis
from spotify.service import SpotifyState
from spotify.presentation_state import PresentationState
from spotify.audio_worker import capture_entry, capture_worker, relay_audio
from spotify.audio_channel import AudioChannel
import multiprocessing
import itertools
from spotify.audio_analysis import quiet_features
from spotify.http_server import make_server
from spotify.media_notifications import MediaNotifications


class MediaEvents:
    source_app_user_model_id = 'Spotify.exe'

    def __init__(self):
        self.callbacks = {}
        self.next_token = 0

    def __getattr__(self, name):
        if name.startswith('add_'):
            def add(callback):
                self.next_token += 1
                self.callbacks[self.next_token] = callback
                return self.next_token
            return add
        if name.startswith('remove_'):
            return lambda token: self.callbacks.pop(token)
        raise AttributeError(name)


class MediaEventTests(unittest.IsolatedAsyncioTestCase):
    async def test_playback_events_wake_without_the_quarter_second_poll_delay(self):
        notifications = MediaNotifications(asyncio.get_running_loop())
        manager, session = MediaEvents(), MediaEvents()
        try:
            notifications.bind_manager(manager)
            notifications.bind_session(session)
            notifications.begin()
            began = time.perf_counter()
            notifier = threading.Thread(target=next(iter(session.callbacks.values())), args=(None, None))
            notifier.start()
            await notifications.wait()
            notifier.join(1)
            self.assertLess(time.perf_counter()-began, .15)
        finally:
            notifications.close()
        self.assertFalse(manager.callbacks)
        self.assertFalse(session.callbacks)

    async def test_session_replacement_removes_previous_event_tokens(self):
        notifications = MediaNotifications(asyncio.get_running_loop())
        manager, old, new = MediaEvents(), MediaEvents(), MediaEvents()
        try:
            notifications.bind_manager(manager)
            notifications.bind_session(old)
            self.assertEqual(len(old.callbacks), 2)
            notifications.bind_session(new)
            self.assertFalse(new.callbacks, 'ordinary heartbeats retain the current subscription')
            next(iter(manager.callbacks.values()))(None, None)
            await notifications.wait()
            notifications.bind_session(new)
            self.assertFalse(old.callbacks)
            self.assertEqual(len(new.callbacks), 2)
        finally:
            notifications.close()
        self.assertFalse(new.callbacks)

    async def test_media_recovery_releases_all_bindings_before_replacement(self):
        notifications = MediaNotifications(asyncio.get_running_loop())
        manager, session = MediaEvents(), MediaEvents()
        notifications.bind_manager(manager)
        notifications.bind_session(session)
        notifications.reset()
        self.assertFalse(manager.callbacks)
        self.assertFalse(session.callbacks)
        notifications.bind_manager(manager)
        notifications.bind_session(session)
        self.assertEqual(len(session.callbacks), 2)
        notifications.close()


def fixture_worker(channel, stop):
    channel.set_status(42)
    features = quiet_features()
    features['energy'] = .9
    channel.publish_audio([.9]*48, features, time.perf_counter(), .5, True)
    stop.wait(5)


def stubborn_fixture_worker(channel, stop):
    fixture_worker(channel, stop)
    time.sleep(10)  # Simulate a driver stuck after cancellation.


def fixture_capture(sink, stop):
    sink.set_status(42)
    features = quiet_features()
    features['energy'] = .4
    while not stop.is_set():
        sink.publish_audio([.4]*48, features, time.perf_counter(), .1, True)
        stop.wait(.01)


def fixture_presentation(channel, stop):
    from spotify.audio_runtime import run_audio_presentation
    run_audio_presentation(channel, stop, capture=fixture_capture)


class FixtureProcess:
    def __init__(self, child):
        self.child = child
        self.closed_after_exit = False

    def __getattr__(self, name):
        return getattr(self.child, name)

    def close(self):
        self.closed_after_exit = not self.child.is_alive()
        self.child.close()


class FixtureContext:
    def __init__(self, stubborn=False):
        self.native = multiprocessing.get_context('spawn')
        self.children = []
        self.stubborn = stubborn

    def __getattr__(self, name):
        return getattr(self.native, name)

    def Process(self, target, args, name):
        child = FixtureProcess(self.native.Process(target=stubborn_fixture_worker if self.stubborn else fixture_worker,
                                                  args=args, name=name))
        self.children.append(child)
        return child


class PresentationContext(FixtureContext):
    def Process(self, target, args, name):
        child = FixtureProcess(self.native.Process(target=fixture_presentation, args=args, name=name))
        self.children.append(child)
        return child


class RealtimeTests(unittest.TestCase):
    def test_isolated_http_serves_latest_audio_and_hub_visibility_controls(self):
        state, stop, context = PresentationState(), threading.Event(), PresentationContext()
        relay = threading.Thread(target=relay_audio, args=(state, stop), kwargs=dict(context=context, port=0))
        relay.start()
        client = None
        try:
            deadline = time.monotonic()+5
            while state.channel is None and time.monotonic() < deadline:
                time.sleep(.01)
            self.assertIsNotNone(state.channel)
            self.assertTrue(state.channel.ready.wait(5))
            state.set_media(playing=True, title='Isolated fixture', artist='No speaker output', error='')
            client = http.client.HTTPConnection('127.0.0.1', state.channel.port.value, timeout=1)
            def wait_playing(playing):
                deadline = time.monotonic()+1
                while time.monotonic() < deadline:
                    client.request('GET', '/api/state')
                    result = json.loads(client.getresponse().read())
                    if result['playing'] is playing:
                        return result
                    time.sleep(.02)
                self.fail('Visibility control did not reach the isolated HTTP owner')
            playing = wait_playing(True)
            self.assertEqual(playing['title'], 'Isolated fixture')
            self.assertEqual(playing['bands'], [.4]*48)
            self.assertGreater(playing['audio_revision'], 0)
            # A busy Hub can retain its mailbox lock while descheduled. The
            # native browser stream must continue to receive fresh complete data.
            with state.channel.lock:
                client.request('GET', '/api/state')
                first = json.loads(client.getresponse().read())
                time.sleep(.2)
                client.request('GET', '/api/state')
                fresh = json.loads(client.getresponse().read())
                self.assertGreater(fresh['audio_revision'], first['audio_revision']+8)
                self.assertLess(fresh['sample_age_ms'], 35)
            state.set_hidden(True)
            wait_playing(False)
            state.set_hidden(False)
            wait_playing(True)
        finally:
            if client:
                client.close()
            stop.set()
            relay.join(3)
        self.assertFalse(relay.is_alive())
        self.assertTrue(context.children[0].closed_after_exit)

    def test_mailbox_is_fixed_latest_only_and_complete(self):
        channel = AudioChannel(multiprocessing.get_context('spawn'))
        features = quiet_features()
        channel.set_status(42)
        for value in range(100):
            features['energy'] = value/100
            channel.publish_audio([value/100]*48, features, time.perf_counter(), .1, True)
        message = channel.read(0)
        bands, values, _, _, valid, _ = channel.unpack(message['values'])
        self.assertEqual(bands, [.99]*48)
        self.assertEqual(values['energy'], .99)
        self.assertTrue(valid)
        self.assertEqual(message['audio_generation'], 100)
        self.assertIsNone(channel.read(message['generation']))

    def test_owned_child_publishes_and_joins_before_relay_returns(self):
        state, stop, context = PresentationState(), threading.Event(), FixtureContext()
        publish = state.publish_audio
        def received(*args):
            publish(*args)
            stop.set()
        began = time.monotonic()
        with patch.object(state, 'publish_audio', side_effect=received):
            relay_audio(state, stop, context=context)
        self.assertEqual(len(context.children), 1)
        self.assertTrue(context.children[0].closed_after_exit)
        self.assertEqual(state.bands, [.9]*48)
        self.assertLess(time.monotonic()-began, 5)

    def test_abrupt_parent_exit_does_not_leave_a_capture(self):
        from types import SimpleNamespace
        with patch('spotify.audio_worker.multiprocessing.parent_process', return_value=SimpleNamespace(is_alive=lambda: False)), \
             patch('spotify.audio_worker.spotify_pid', side_effect=AssertionError('orphan started capture')):
            capture_worker(None, threading.Event())

    def test_native_capture_uses_a_fresh_mta_thread(self):
        import comtypes as COM
        from spotify.audio_runtime import run_audio_presentation
        owner = threading.get_ident()
        visited = []
        stop = threading.Event()
        def capture(*args):
            self.assertNotEqual(threading.get_ident(), owner)
            COM.CoInitializeEx(COM.COINIT_MULTITHREADED)
            try:
                visited.append(True)
            finally:
                COM.CoUninitialize()
            stop.set()
        run_audio_presentation(AudioChannel(multiprocessing.get_context('spawn'), 0), stop, capture=capture)
        self.assertEqual(visited, [True])

    def test_stuck_child_is_terminated_before_resource_reuse(self):
        state, stop, context = PresentationState(), threading.Event(), FixtureContext(stubborn=True)
        with patch.object(state, 'publish_audio', side_effect=lambda *args: stop.set()):
            began = time.monotonic()
            relay_audio(state, stop, context=context)
        self.assertEqual(len(context.children), 1)
        self.assertTrue(context.children[0].closed_after_exit)
        self.assertLess(time.monotonic()-began, 5)

    def test_short_apertures_react_while_bass_resolution_is_preserved(self):
        for frequency, deadline in ((90, 32), (800, 18), (6000, 10)):
            tone = (.04*np.sin(2*np.pi*frequency*np.arange(2048)/44100))[:, None]
            target = AudioAnalysis().analyze(tone, realtime=True)[0]
            lane = int(np.argmax(target))
            hit = None
            for ms in range(2, 49, 2):
                count = min(2048, int(ms*44.1))
                samples = np.zeros((2048, 1))
                samples[-count:] = tone[:count]
                bands, features = AudioAnalysis().analyze(samples, realtime=True)
                if hit is None and bands[lane] >= target[lane]*.9:
                    hit = ms
                self.assertTrue(np.isfinite(bands).all())
                self.assertGreaterEqual(features['energy'], 0)
            self.assertIsNotNone(hit)
            self.assertLessEqual(hit, deadline, str(frequency))

    def test_vector_reduction_matches_reference_slices_for_odd_windows(self):
        from spotify.audio_analysis import _spectral_plan, spectrum
        samples = np.random.default_rng(71).normal(0, .02, (2049, 2))
        window, _, slices, _, _ = _spectral_plan(len(samples), 44100)
        transform = np.fft.rfft(samples*window[:, None], axis=0)
        magnitude = np.sqrt(np.mean(np.abs(transform)**2, axis=1))/len(samples)
        levels = [magnitude[s].max() if magnitude[s].size else 0. for s in slices]
        expected = np.clip((20*np.log10(np.maximum(levels, 1e-12))+75)/60, 0, 1)
        np.testing.assert_allclose(spectrum(samples, 44100), expected, atol=1e-12)

    def test_absolute_amplitude_and_stereo_survive_each_aperture(self):
        t = np.arange(2048)/44100
        for frequency in (90, 800, 6000):
            tone = .04*np.sin(2*np.pi*frequency*t)
            centered, _ = AudioAnalysis().analyze(np.column_stack((tone, tone)), realtime=True)
            opposed, features = AudioAnalysis().analyze(np.column_stack((tone, -tone)), realtime=True)
            quiet, _ = AudioAnalysis().analyze(np.column_stack((tone*.1, -tone*.1)), realtime=True)
            lane = int(np.argmax(centered))
            self.assertAlmostEqual(centered[lane], opposed[lane], delta=1e-6)
            self.assertAlmostEqual(opposed[lane]-quiet[lane], 1/3, delta=.01)
            self.assertGreater(features['voice_widths'][lane//6], .9)
        bass = .03*np.sin(2*np.pi*86*t)
        upper = .009*np.sin(2*np.pi*3200*t)
        soft = AudioAnalysis().analyze((bass+upper)[:, None], realtime=True)[0]
        heavy = AudioAnalysis().analyze((bass*10+upper)[:, None], realtime=True)[0]
        lane = int(np.argmax(soft[32:40]))+32
        self.assertAlmostEqual(soft[lane], heavy[lane], delta=.015)

    def test_loudness_release_uses_recent_audio_instead_of_old_window(self):
        x = np.full((2048, 2), .1)
        x[-256:] = 0
        _, features = AudioAnalysis().analyze(x, realtime=True)
        self.assertEqual(features['energy'], 0)

    def test_every_fresh_packet_is_published_without_rate_gate_or_backlog(self):
        stop = threading.Event()
        state = SpotifyState()
        published = []
        packets = [np.full((4096, 2), .05, dtype=np.float32)]
        packets += [np.full((441, 2), .01*(i+1), dtype=np.float32) for i in range(9)]
        @contextmanager
        def capture(pid):
            yield lambda: packets.pop(0)
        def publish(bands, features, *args):
            published.append(features['energy'])
            if not packets:
                stop.set()
        with patch('spotify.audio_worker.spotify_pid', return_value=42) as discover, \
             patch('spotify.audio_worker.psutil.Process') as process, \
             patch('spotify.audio_worker.time.monotonic', side_effect=itertools.count(0, 3)), \
             patch('spotify.audio_worker.capture_process', capture), \
             patch.object(state, 'publish_audio', side_effect=publish), \
             patch.object(state, 'set_status', create=True):
            capture_worker(state, stop)
            discover.assert_called_once()
            self.assertEqual(process.return_value.is_running.call_count, 10)
        self.assertEqual(len(published), 10)
        self.assertTrue(all(b > a for a, b in zip(published[1:], published[2:])))

    def test_http_reuses_worker_without_delayed_ack_and_releases_on_shutdown(self):
        state = SpotifyState()
        server = make_server(state, 0)
        worker = threading.Thread(target=server.serve_forever)
        worker.start()
        client = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=2)
        try:
            timings, sockets = [], []
            for _ in range(12):
                start = time.perf_counter()
                client.request('GET', '/api/state')
                response = client.getresponse()
                self.assertEqual(response.version, 11)
                self.assertFalse(json.loads(response.read())['playing'])
                timings.append(time.perf_counter()-start)
                sockets.append(client.sock)
            self.assertTrue(all(s is sockets[0] for s in sockets))
            self.assertLess(sorted(timings)[6], .025, 'small responses must not wait for delayed ACK')
            # Leave the persistent connection open: shutdown must still join it.
            start = time.perf_counter()
            server.shutdown()
            server.server_close()
            worker.join(1)
            self.assertFalse(worker.is_alive())
            self.assertLess(time.perf_counter()-start, 4)
        finally:
            client.close()
            if worker.is_alive():
                server.shutdown()
                server.server_close()
                worker.join(2)


if __name__ == '__main__':
    unittest.main()

"""Exercise the real media loop with deterministic Windows session notifications."""
import asyncio
import sys
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify import service
from spotify.media_notifications import MediaNotifications


class Session:
    source_app_user_model_id = 'Spotify.exe'

    def __init__(self):
        self.title, self.playing, self.reads = 'First', True, 0
        self.callbacks = {}
        self.on_read = None

    def add_playback_info_changed(self, callback):
        self.callbacks['play'] = callback
        return 'play'

    def add_media_properties_changed(self, callback):
        self.callbacks['metadata'] = callback
        return 'metadata'

    def remove_playback_info_changed(self, token):
        self.callbacks.pop(token)

    remove_media_properties_changed = remove_playback_info_changed

    def get_playback_info(self):
        return SimpleNamespace(playback_status=self.playing)

    async def try_get_media_properties_async(self):
        self.reads += 1
        props = SimpleNamespace(title=self.title, artist='Artist')
        if self.on_read:
            self.on_read()
            await asyncio.sleep(0)
        return props


class ObservationTests(unittest.IsolatedAsyncioTestCase):
    async def run_loop(self, steps, on_tick=None, on_read=None):
        session = Session()
        session.on_read = (lambda: on_read(session)) if on_read else None
        manager = SimpleNamespace(get_sessions=lambda: [session],
                                  add_sessions_changed=lambda cb: 1,
                                  remove_sessions_changed=lambda token: None)
        async def request():
            return manager
        windows = SimpleNamespace(GlobalSystemMediaTransportControlsSessionManager=SimpleNamespace(request_async=request),
                                  GlobalSystemMediaTransportControlsSessionPlaybackStatus=SimpleNamespace(PLAYING=True))
        stop, state, seen = threading.Event(), service.SpotifyState(), []
        clock = [0.]
        async def wait(notifications):
            seen.append(dict(state.media))
            clock[0] += .5
            if on_tick:
                on_tick(session, len(seen))
            await asyncio.sleep(0)  # Deliver queued callbacks on their owner loop.
            if len(seen) >= steps:
                stop.set()
        with patch.dict(sys.modules, {'winrt.windows.media.control': windows}), \
             patch.object(MediaNotifications, 'wait', wait), \
             patch.object(service, 'time', SimpleNamespace(monotonic=lambda: clock[0], perf_counter=time.perf_counter)):
            await service.watch_media(state, stop)
        self.assertFalse(session.callbacks)
        self.assertFalse(state.snapshot()['playing'])
        return session, seen

    async def test_idle_metadata_reads_are_bounded_with_fallback(self):
        session, seen = await self.run_loop(20)
        self.assertEqual(session.reads, 2, 'ten seconds needs two metadata reads, not forty')
        self.assertTrue(all(s['title'] == 'First' and s['playing'] for s in seen))

    async def test_track_event_refreshes_immediately_and_pause_keeps_cached_title(self):
        def tick(session, n):
            if n == 1:
                session.title = 'Second'
                session.callbacks['metadata']()
            if n == 2:
                session.playing = False
                session.callbacks['play']()
        session, seen = await self.run_loop(4, tick)
        self.assertEqual([s['title'] for s in seen], ['First', 'Second', 'Second', 'Second'])
        self.assertEqual([s['playing'] for s in seen], [True, True, False, False])
        self.assertEqual(session.reads, 2)

    async def test_event_during_metadata_read_cannot_mark_old_title_current(self):
        def read(session):
            if session.reads == 1:
                session.title = 'Changed during read'
                session.callbacks['metadata']()
                session.playing = False
        session, seen = await self.run_loop(3, on_read=read)
        self.assertEqual(session.reads, 2)
        self.assertFalse(seen[0]['playing'], 'pause must be read after awaited metadata')
        self.assertEqual(seen[1]['title'], 'Changed during read')

    async def test_missed_metadata_event_repairs_on_fallback(self):
        def tick(session, n):
            if n == 1:
                session.title = 'Missed event'
        session, seen = await self.run_loop(12, tick)
        self.assertEqual(session.reads, 2)
        self.assertEqual(seen[10]['title'], 'Missed event')

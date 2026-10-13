"""Deterministic Spotify lease races; no live media or OBS commands."""
import asyncio
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.playback_control import PlaybackControl
from lib import audio_focus, media_metadata
from lib.shared_media.asset_playback import AssetPlayback

PLAYING, PAUSED, STOPPED = 'playing', 'paused', 'stopped'


class Session:
    def __init__(self, status=PLAYING):
        self.status, self.title = status, 'Same song'
        self.pauses = self.plays = 0
        self.pause_result = True
        self.on_props = None
        self.pause_error = None

    def get_playback_info(self):
        return SimpleNamespace(playback_status=self.status)

    async def try_get_media_properties_async(self):
        if self.on_props:
            await self.on_props()
        return SimpleNamespace(title=self.title, artist='Artist')

    async def try_pause_async(self):
        self.pauses += 1
        if self.pause_result:
            self.status = PAUSED
        if self.pause_error:
            raise self.pause_error
        return self.pause_result

    async def try_play_async(self):
        self.plays += 1
        self.status = PLAYING
        return True


class ControlTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.loop = asyncio.get_running_loop()
        self.wakes = asyncio.Queue()
        self.control = PlaybackControl(lambda: self.loop.call_soon_threadsafe(self.wakes.put_nowait, True))
        self.session = Session()

    async def pending(self, cancelled=lambda: False):
        while not self.wakes.empty():
            self.wakes.get_nowait()
        task = asyncio.create_task(asyncio.to_thread(self.control.acquire, cancelled))
        await asyncio.wait_for(self.wakes.get(), 1)
        return task

    async def reconcile(self, sessions=None):
        sessions = [self.session] if sessions is None else sessions
        await self.control.reconcile(sessions, sessions[0] if sessions else None, PLAYING, PAUSED)

    async def acquire(self):
        task = await self.pending()
        await self.reconcile()
        return await asyncio.wait_for(task, 1)

    async def test_overlap_resumes_only_after_last_release_and_release_is_idempotent(self):
        first = await self.acquire()
        second = await self.acquire()
        self.assertEqual(self.session.pauses, 1)
        first(); first()
        await self.reconcile()
        self.assertEqual(self.session.plays, 0)
        second()
        await self.reconcile()
        self.assertEqual(self.session.plays, 1)

    async def test_preexisting_pause_no_session_and_rejected_pause_never_play(self):
        self.session.status = PAUSED
        release = await self.acquire()
        release(); await self.reconcile()
        self.assertEqual((self.session.pauses, self.session.plays), (0, 0))
        self.session.status, self.session.pause_result = PLAYING, False
        release = await self.acquire()
        release(); await self.reconcile()
        self.assertEqual((self.session.pauses, self.session.plays), (1, 0))
        task = await self.pending()
        await self.reconcile([])
        release = await task
        release(); await self.reconcile([])

    async def test_cancel_before_admission_and_during_native_pause(self):
        cancel = threading.Event()
        task = await self.pending(cancel.is_set)
        cancel.set()
        release = await asyncio.wait_for(task, 1)
        await self.reconcile()
        self.assertEqual(self.session.pauses, 0)
        release()
        release = await self.acquire()
        release(); await self.reconcile()
        self.assertEqual(self.session.plays, 1)

    async def test_user_resume_track_change_stop_and_session_replacement_revoke_restore(self):
        for change in ('resume', 'track', 'stop', 'replace'):
            self.session = Session()
            release = await self.acquire()
            sessions = [self.session]
            if change == 'resume': self.session.status = PLAYING
            if change == 'track': self.session.title = 'User chose another song'
            if change == 'stop': self.session.status = STOPPED
            if change == 'replace': sessions = [Session(PAUSED)]
            release(); await self.reconcile(sessions)
            self.assertEqual(self.session.plays, 0, change)
            self.assertEqual(sessions[0].plays, 0, change)

    async def test_user_resume_during_claim_does_not_repause(self):
        release = await self.acquire()
        self.session.status = PLAYING
        await self.reconcile()
        second = await self.acquire()
        self.assertEqual(self.session.pauses, 1)
        release(); second(); await self.reconcile()
        self.assertEqual(self.session.plays, 0)

    async def test_new_claim_during_restore_keeps_spotify_paused(self):
        release = await self.acquire()
        release()
        entered, proceed = asyncio.Event(), asyncio.Event()
        async def props():
            entered.set()
            await proceed.wait()
        self.session.on_props = props
        restore = asyncio.create_task(self.reconcile())
        await entered.wait()
        new = await self.pending()
        proceed.set(); await restore
        self.assertEqual(self.session.plays, 0)
        self.assertFalse(new.done(), 'restoration cannot admit an unprocessed claim')
        self.session.on_props = None
        await self.reconcile()
        new_release = await new
        new_release(); await self.reconcile()
        self.assertEqual(self.session.plays, 1)

    async def test_shutdown_releases_all_claims_and_rejects_new_claims(self):
        release = await self.acquire()
        self.control.close()
        await self.reconcile()
        self.assertEqual(self.session.plays, 1)
        release(); await self.reconcile()
        self.control.acquire(lambda: False)()
        self.assertFalse(self.control.claims)

    async def test_native_timeout_after_pause_still_restores(self):
        self.session.pause_error = TimeoutError('native acknowledgement lost')
        release = await self.acquire()
        release(); await self.reconcile()
        self.assertEqual(self.session.plays, 1)

    async def test_cancel_while_native_pause_is_pending_restores_after_cleanup(self):
        cancel = threading.Event()
        entered, proceed = asyncio.Event(), asyncio.Event()
        original = self.session.try_pause_async
        async def pause():
            entered.set()
            await proceed.wait()
            return await original()
        self.session.try_pause_async = pause
        task = await self.pending(cancel.is_set)
        reconcile = asyncio.create_task(self.reconcile())
        await entered.wait()
        cancel.set()
        release = await asyncio.wait_for(task, 1)
        self.assertFalse(self.control.claims)
        proceed.set(); await reconcile
        release(); await self.reconcile()
        self.assertEqual((self.session.pauses, self.session.plays), (1, 1))

    async def test_admission_timeout_cannot_pause_a_clip_later(self):
        with patch('spotify.playback_control.time', SimpleNamespace(monotonic=Mock(side_effect=[0, 3]))):
            task = await self.pending()
            release = await asyncio.wait_for(task, 1)
        await self.reconcile()
        release()
        self.assertEqual(self.session.pauses, 0)
        self.assertFalse(self.control.claims)


class ContractTests(unittest.TestCase):
    def test_silent_unknown_cancelled_and_unregistered_requests_do_not_acquire(self):
        provider = Mock()
        audio_focus.register(provider)
        self.addCleanup(audio_focus.unregister, provider)
        for audio in (False, None):
            with patch.object(audio_focus, 'probe_media', return_value=SimpleNamespace(has_audio=audio)):
                audio_focus.interrupt_audio('silent.mp4')()
        with patch.object(audio_focus, 'probe_media', side_effect=ValueError):
            audio_focus.interrupt_audio('missing.mp4')()
        audio_focus.interrupt_audio('cancelled.mp4', cancelled=lambda: True)()
        provider.acquire.assert_not_called()
        audio_focus.unregister(provider)
        audio_focus.interrupt_audio('unregistered.mp4')()

    def test_release_once_and_old_unregister_cannot_remove_replacement(self):
        old, new = Mock(), Mock()
        audio_focus.register(old); audio_focus.register(new); audio_focus.unregister(old)
        self.addCleanup(audio_focus.unregister, new)
        with patch.object(audio_focus, 'probe_media', return_value=SimpleNamespace(has_audio=True)):
            release = audio_focus.interrupt_audio('clip.mp4')
        release(); release()
        old.acquire.assert_not_called()
        new.acquire.return_value.assert_called_once()

    def test_audio_presence_and_video_metadata_share_complete_probe(self):
        import json
        for streams, audio, dimensions in [
            ([], False, ''),
            ([dict(codec_type='audio')], True, ''),
            ([dict(codec_type='video', width=640, height=360)], False, '640x360'),
            ([dict(codec_type='audio'), dict(codec_type='video', width=640, height=360)], True, '640x360'),
        ]:
            with patch.object(media_metadata.subprocess, 'run', return_value=SimpleNamespace(
                    returncode=0, stdout=json.dumps(dict(streams=streams)))):
                result = media_metadata._read_metadata('fixture')
            self.assertEqual(result.has_audio, audio)
            self.assertEqual(result.dimension_key, dimensions)

    def test_failed_start_and_cleanup_error_still_release_after_parking(self):
        sequence = []
        obs = Mock()
        obs.park_media_source.side_effect = lambda *args: sequence.append('park') or (_ for _ in ()).throw(RuntimeError('OBS lost'))
        cfg = SimpleNamespace(project_name='test', scene='scene', media_start_timeout=1)
        player = AssetPlayback(cfg, obs_api=obs, start_source=Mock(side_effect=RuntimeError('start failed')),
            state_for=lambda source: None, apply_media=Mock(), apply_audio=Mock(), layout_for=lambda *args: None)
        with patch('lib.shared_media.asset_playback.interrupt_audio', return_value=lambda: sequence.append('release')):
            player.play('clip', 'fixture.mp4', 'source', cancelled=lambda: False)
        self.assertEqual(sequence, ['park', 'release'])

    def test_browser_cancellation_releases_only_after_channel_cleanup(self):
        from pathlib import Path
        from lib.browser_effects.player import BrowserPlayer
        sequence, cancel = [], threading.Event()
        player = BrowserPlayer('test-focus', Path('.'), 'scene', 'monitor', {})
        player.channel = SimpleNamespace(snapshot=lambda: dict(ready=True),
            begin=lambda *args: cancel.set() or 'playback-id', done=threading.Event(),
            stop=lambda identity: sequence.append('stop'), error='')
        with patch.object(player, 'effect', return_value={'renderer': 'test'}), \
             patch('lib.browser_effects.player.prepare_audio', return_value='audio.wav'), \
             patch('lib.browser_effects.player.attach'), \
             patch('lib.browser_effects.player.obs'), \
             patch('lib.browser_effects.player.interrupt_audio', return_value=lambda: sequence.append('release')):
            player.play('sound', 'fixture.mp4', -12, cancel.is_set, 5)
        self.assertEqual(sequence, ['stop', 'release'])

    def test_native_soundboard_cancel_during_load_parks_then_releases(self):
        from pathlib import Path
        from contextlib import nullcontext
        from soundboard.player import SoundboardPlayer
        sequence, cancel = [], threading.Event()
        with patch.object(SoundboardPlayer, '_ensure_source'), \
             patch('soundboard.player.obs') as obs, \
             patch('soundboard.player.media_startup', return_value=nullcontext()), \
             patch('soundboard.player.interrupt_audio', return_value=lambda: sequence.append('release')):
            player = SoundboardPlayer()
            player._state_store = Mock()
            player._browser.effect = Mock(return_value=None)
            player._wait_for_media_file = Mock(return_value=True)
            obs.set_media_source_file.side_effect = lambda *args, **kwargs: cancel.set() or True
            obs.park_media_source.side_effect = lambda *args: sequence.append('park')
            player.play(stem='fixture', filepath=Path('fixture.mp4'), volume_db=-12,
                        categories=[], cancelled=cancel)
            obs.show_source.assert_not_called()
        self.assertEqual(sequence[-2:], ['park', 'release'])

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

    async def test_new_music_choice_reclaims_focus_after_spotify_resume(self):
        first = await self.acquire()
        self.session.status = PLAYING
        await self.reconcile()
        self.assertEqual(self.session.pauses, 1)
        task = asyncio.create_task(asyncio.to_thread(self.control.acquire_music, lambda: False))
        await asyncio.wait_for(self.wakes.get(), 1)
        # Synchronize with the actual new claim, not a previous release wake.
        while not self.control.music_claims:
            await asyncio.sleep(0)
        await self.reconcile()
        second = await asyncio.wait_for(task, 1)
        self.assertEqual(self.session.pauses, 2)
        first(); await self.reconcile()
        self.assertEqual(self.session.plays, 0)
        second(); await self.reconcile()
        self.assertEqual(self.session.plays, 1)

    async def test_rejected_music_pause_cannot_admit_overlapping_song(self):
        self.session.pause_result = False
        task = asyncio.create_task(asyncio.to_thread(self.control.acquire_music, lambda: False))
        await asyncio.wait_for(self.wakes.get(), 1)
        await self.reconcile()
        with self.assertRaisesRegex(RuntimeError, 'could not pause'):
            await asyncio.wait_for(task, 1)
        self.assertFalse(self.control.claims)
        self.assertEqual(self.session.status, PLAYING)

    async def test_cancelled_new_music_does_not_repause_for_an_older_clip(self):
        first = await self.acquire()
        self.session.status = PLAYING
        await self.reconcile()
        cancel = threading.Event()
        task = asyncio.create_task(asyncio.to_thread(self.control.acquire_music, cancel.is_set))
        await asyncio.wait_for(self.wakes.get(), 1)
        entered, proceed = asyncio.Event(), asyncio.Event()
        async def props():
            entered.set()
            await proceed.wait()
        self.session.on_props = props
        reconciliation = asyncio.create_task(self.reconcile())
        await entered.wait()
        cancel.set()
        release = await asyncio.wait_for(task, 1)
        proceed.set()
        await reconciliation
        self.assertEqual(self.session.pauses, 1)
        self.session.on_props = None
        first(); release(); await self.reconcile()
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


class MusicFocusTests(unittest.TestCase):
    def setUp(self):
        from lib.project_runtime import _ProjectRegistry, ProjectStatus
        from spotify.music_focus import MusicFocus
        self.registry = _ProjectRegistry()
        self.music = Mock(name='music-interface')
        self.music.name, self.music.background_music = 'music', True
        self.music.get_status.return_value = ProjectStatus('music', True, 'song', [], True)
        self.cue = Mock(name='cue-interface')
        self.cue.name, self.cue.background_music = 'sound_effects', False
        self.registry.register(self.music); self.registry.register(self.cue)
        self.focus = MusicFocus(self.registry)

    def test_spotify_start_aborts_music_once_and_pause_never_resumes_it(self):
        self.focus.observe(True)
        self.music.revert.assert_called_once()
        self.music.pause.assert_not_called()
        self.cue.pause.assert_not_called()
        self.cue.revert.assert_not_called()
        self.focus.observe(True)
        self.music.revert.assert_called_once()
        self.focus.observe(False)
        self.focus.close()
        self.music.resume.assert_not_called()

    def test_each_native_resume_cancels_new_music_without_touching_pause_claims(self):
        from lib.coordination.playback import PlayCoordinator
        coordination = PlayCoordinator(self.registry)
        self.addCleanup(coordination.shutdown)
        self.focus.observe(True)
        music = coordination.request('music', lambda ticket: None)
        coordination.snapshot()
        self.assertTrue(music.allowed.is_set(), 'new music must not deadlock behind older Spotify')
        self.focus.observe(False)  # New Hub music paused Spotify.
        self.focus.observe(True)   # User deliberately resumes Spotify.
        self.assertEqual(self.music.revert.call_count, 2)
        coordination.manual_action('music', 'pause')
        self.focus.close()
        coordination.snapshot()
        self.music.resume.assert_not_called()
        self.assertFalse(music.allowed.is_set())
        music.finish().result(2)

    def test_song_owner_stops_random_mode_and_cancels_active_and_pending_songs(self):
        from specific_song.interface import _SpecificSongInterface
        from specific_song.player import SongPlayer
        with patch('specific_song.player.obs'):
            player = SongPlayer()
        player._is_busy = True
        player._stop_and_hide_source = Mock()
        player._requests = Mock()
        stop_random = Mock()
        interface = _SpecificSongInterface({'player': player, 'stop_random': stop_random})
        self.registry.register(interface)
        self.focus.observe(True)
        stop_random.assert_called_once()
        player._requests.cancel.assert_called_once()
        self.assertTrue(player._cancelled())
        player._stop_and_hide_source.assert_called_once()
        self.focus.observe(False)
        self.assertTrue(player._cancelled())

    def test_one_failed_owner_cannot_prevent_other_music_from_stopping(self):
        self.music.revert.side_effect = RuntimeError('unavailable source')
        mood = Mock()
        mood.name, mood.background_music = 'mood', True
        self.registry.register(mood)
        self.focus.observe(True)
        mood.revert.assert_called_once()


class ContractTests(unittest.TestCase):
    def test_song_parks_before_releasing_spotify_and_failed_admission_never_loads(self):
        from pathlib import Path
        from contextlib import nullcontext
        from specific_song.player import SongPlayer
        sequence = []
        with patch('specific_song.player.obs') as obs, \
             patch('specific_song.player.BASS_ANIMATION_ENABLED', False), \
             patch('specific_song.player.media_startup', side_effect=lambda *args, **kwargs: nullcontext()), \
             patch('specific_song.player._resolve_audio_file', return_value=Path('song.mp3')), \
             patch('specific_song.player.interrupt_audio') as interrupt:
            player = SongPlayer()
            player.remember_obs_volume = Mock()
            player.volume_for_stem = Mock(return_value=-12)
            player._wait_for_media_file = Mock(return_value=True)
            player._apply_fullscreen = Mock()
            player._set_monitor_and_output = Mock()
            player._poll_until_done = Mock(return_value=True)
            obs.park_media_source.side_effect = lambda *args: sequence.append('park')
            interrupt.return_value = lambda: sequence.append('release')
            player.play('ss__song')
            obs.show_source.assert_called_once()
            player._poll_until_done.assert_called_once()
            self.assertEqual(sequence, ['park', 'release'])
            self.assertTrue(interrupt.call_args.kwargs['music'])
            obs.set_media_source_file.reset_mock()
            interrupt.side_effect = RuntimeError('Spotify could not pause')
            player.play('ss__song')
            obs.set_media_source_file.assert_not_called()

    def test_music_and_respawn_use_distinct_interruption_policy(self):
        provider = Mock()
        audio_focus.register(provider)
        self.addCleanup(audio_focus.unregister, provider)
        with patch.object(audio_focus, 'probe_media', return_value=SimpleNamespace(has_audio=True)):
            audio_focus.interrupt_audio('song.mp3', music=True)()
        provider.acquire_music.assert_called_once()
        provider.acquire.assert_not_called()
        from league.handlers.player_events import make_respawn_sfx_handler
        with patch('league.handlers.player_events.hub_events.emit') as emit:
            make_respawn_sfx_handler()({'respawnTimer': 3.4})
        self.assertTrue(emit.call_args.kwargs['concurrent'])
        self.assertFalse(emit.call_args.kwargs['interrupt_music'])

    def test_failed_music_admission_propagates_to_source_owner(self):
        provider = Mock()
        provider.acquire_music.side_effect = RuntimeError('Spotify could not pause')
        audio_focus.register(provider)
        self.addCleanup(audio_focus.unregister, provider)
        with patch.object(audio_focus, 'probe_media', return_value=SimpleNamespace(has_audio=True)):
            with self.assertRaisesRegex(RuntimeError, 'could not pause'):
                audio_focus.interrupt_audio('song.mp3', music=True)

    def test_layered_respawn_bypasses_spotify_claim_but_keeps_module_gate(self):
        from lib.shared_media.playback_controller import MediaPlayback
        gate = threading.Event(); gate.set()
        cancelled = threading.Event()
        cfg = SimpleNamespace(project_name='sound_effects', scene='effects',
                              media_start_timeout=1, media_total_timeout=5)
        obs = Mock()
        player = AssetPlayback(cfg, obs_api=obs, start_source=Mock(return_value=True),
            state_for=lambda source: None, apply_media=Mock(), apply_audio=Mock(), layout_for=lambda *args: None)
        with patch('lib.shared_media.playback_controller.coordinator') as coordination, \
             patch('lib.shared_media.asset_playback.interrupt_audio') as interrupt:
            coordination.permission.return_value = gate
            playback = MediaPlayback(cfg, threading.Event(), {'halo': ('halo.wav', 'player')}, player)
            done = playback.play_asset_concurrent('halo', interrupt_music=False)
            self.assertTrue(done.wait(2))
            interrupt.assert_not_called()
            coordination.request.assert_not_called()
            self.assertTrue(obs.wait_for_media_end.call_args.kwargs['allowed']())
            obs.park_media_source.assert_called_once()
            gate.clear()
            player.start_source.reset_mock()
            done = playback.play_asset_concurrent('halo', interrupt_music=False)
            self.assertFalse(done.wait(.1))
            player.start_source.assert_not_called()
            playback.cancel_all_playback()
            self.assertTrue(done.wait(2))

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

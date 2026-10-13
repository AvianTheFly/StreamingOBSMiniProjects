"""Offline Save/Twitch integration checks; never call Twitch or OBS."""
import os
import threading
from datetime import datetime
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from lib import twitch_clips as clips
from lib.twitch_clips_titles import clip_title
from twitch_celebrations.twitch import SCOPES, AUTH_SCOPES
from instant_replay import interface as replay
from instant_replay import capture
from instant_replay.runtime_state import ReplayState


class TwitchClipTests(unittest.TestCase):
    def setUp(self):
        self.twitch = SimpleNamespace(tokens={'present': True}, token=Mock(return_value='test-token'),
                                      stop=Mock())
        self.twitch.stop.wait.return_value = False
        self.twitch.stop.is_set.return_value = False
        self.live = patch.object(clips.clip_sessions, 'get', return_value=SimpleNamespace(
            token=self.twitch.token, available=lambda: bool(self.twitch.tokens), stop=self.twitch.stop))
        self.env = patch.dict(os.environ, {'TWITCH_CLIENT_ID': 'client', 'TWITCH_BROADCASTER_ID': 'channel'})
        self.live.start(); self.env.start()
        self.addCleanup(self.live.stop); self.addCleanup(self.env.stop)
        self.addCleanup(clips._set, 'idle', '')
        self.context = patch.object(clips, 'clip_title', return_value='Udyr jungle — League of Legends | Oct 12 · 9:42 PM')
        self.context.start()
        self.addCleanup(self.context.stop)
        self.context_get = patch.object(clips.requests, 'get', return_value=self.response([]))
        self.context_get.start()
        self.addCleanup(self.context_get.stop)
        clips._set('pending', 'Creating')

    def response(self, data, code=200):
        return Mock(status_code=code, json=Mock(return_value={'data': data}))

    def test_requests_fixed_minute_and_waits_for_published_clip(self):
        created = self.response([{'id': 'clip-id'}], 202)
        ready = {'id': 'clip-id', 'duration': 60, 'url': 'https://clips.twitch.tv/clip-id'}
        with patch.object(clips.requests, 'post', return_value=created) as post, \
             patch.object(clips.requests, 'get', side_effect=[self.response([{'title': 'Udyr jungle', 'game_name': 'League of Legends'}]), self.response([]), self.response([ready])]) as get:
            clips._worker()
        self.assertEqual(post.call_count, 1)
        self.assertEqual(post.call_args.kwargs['params'], {
            'broadcaster_id': 'channel', 'duration': 60,
            'title': 'Udyr jungle — League of Legends | Oct 12 · 9:42 PM'})
        self.assertEqual(get.call_count, 3)
        self.assertEqual(clips.status()['status'], 'ready')
        self.assertEqual(clips.status()['url'], ready['url'])

    def test_missing_authorization_never_posts(self):
        self.twitch.tokens = {}
        with patch.object(clips.requests, 'post') as post:
            clips._worker()
        post.assert_not_called()
        self.assertIn('Connect Twitch', clips.status()['message'])

    def test_permission_offline_and_network_errors_are_isolated(self):
        for code in (401, 403, 404):
            with self.subTest(code=code), patch.object(clips.requests, 'post', return_value=self.response([], code)), \
                 patch.object(clips.requests, 'get') as get:
                clips._worker()
                self.assertEqual(get.call_count, 1)  # Optional naming context only.
                self.assertEqual(clips.status()['status'], 'error')
        with patch.object(clips.requests, 'post', side_effect=RuntimeError('secret-token')):
            clips._worker()
        self.assertNotIn('secret-token', str(clips.status()))

    def test_shutdown_does_not_report_unconfirmed_clip_as_success(self):
        self.twitch.stop.wait.return_value = True
        with patch.object(clips.requests, 'post', return_value=self.response([{'id': 'id'}], 202)) as post:
            clips._worker()
        post.assert_called_once()
        self.assertEqual(clips.status()['status'], 'error')

    def test_pending_request_is_not_duplicated(self):
        with patch.object(clips.threading, 'Thread') as thread:
            clips.request_clip()
        thread.assert_not_called()

    def test_short_clip_is_not_reported_as_full_length_or_recreated(self):
        short = {'duration': 30, 'url': 'https://clips.twitch.tv/short'}
        with patch.object(clips.requests, 'post', return_value=self.response([{'id': 'short'}], 202)) as post, \
             patch.object(clips.requests, 'get', side_effect=[self.response([]), self.response([short])]):
            clips._worker()
        post.assert_called_once()
        self.assertEqual(clips.status()['status'], 'error')
        self.assertIn('only 30s', clips.status()['message'])
        self.assertEqual(clips.status()['url'], short['url'])

    def test_unavailable_naming_context_does_not_prevent_minute_capture(self):
        ready = {'duration': 60, 'url': 'https://clips.twitch.tv/full'}
        with patch.object(clips.requests, 'post', return_value=self.response([{'id': 'full'}], 202)) as post, \
             patch.object(clips.requests, 'get', side_effect=[RuntimeError('context unavailable'), self.response([ready])]):
            clips._worker()
        self.assertEqual(post.call_args.kwargs['params']['duration'], 60)
        self.assertEqual(clips.status()['status'], 'ready')

    def test_chat_reuses_replay_clip_while_pending_and_after_confirmation(self):
        entered, release = threading.Event(), threading.Event()
        pending, existing = Mock(), Mock()
        def worker(title):
            entered.set()
            release.wait(2)
            clips._set('ready', 'Twitch clip ready (60s).', 'https://clips.twitch.tv/shared')
        clips._set('idle', '')
        with patch.object(clips, '_next_request', 0), patch.object(clips, '_thread', None), \
             patch.object(clips, '_callbacks', []), patch.object(clips, '_worker', side_effect=worker) as create, \
             patch.object(clips.time, 'monotonic', return_value=100):
            try:
                self.assertTrue(clips.request_clip())
                self.assertTrue(entered.wait(1))
                self.assertTrue(clips.request_clip(reuse=True, on_complete=pending))
                pending.assert_not_called()
            finally:
                release.set()
                clips.join()
            self.assertTrue(clips.request_clip(reuse=True, on_complete=existing))
            create.assert_called_once()
            pending.assert_called_once()
            existing.assert_called_once()
            self.assertEqual(pending.call_args.args[0]['url'], existing.call_args.args[0]['url'])

    def test_pending_observers_are_bounded(self):
        with patch.object(clips, '_callbacks', []), patch.object(clips.threading, 'Thread') as thread:
            for _ in range(clips.MAX_CALLBACKS):
                self.assertTrue(clips.request_clip(reuse=True, on_complete=Mock()))
            self.assertFalse(clips.request_clip(reuse=True, on_complete=Mock()))
        thread.assert_not_called()

    def test_simultaneous_chat_and_replay_requests_share_worker_and_cooldown(self):
        entered, release = threading.Event(), threading.Event()
        completed = Mock()
        def worker(title):
            entered.set()
            release.wait(2)
            clips._set('ready', 'Ready', 'https://clips.twitch.tv/test')
        clips._set('idle', '')
        with patch.object(clips, '_next_request', 0), patch.object(clips, '_thread', None), \
             patch.object(clips, '_worker', side_effect=worker) as create, \
             patch.object(clips.time, 'monotonic', return_value=100):
            try:
                self.assertTrue(clips.request_clip(title='Stream Highlight', on_complete=completed))
                self.assertTrue(entered.wait(1))
                self.assertFalse(clips.request_clip())
            finally:
                release.set()
                clips.join()
            self.assertFalse(clips.request_clip())
            create.assert_called_once_with('Stream Highlight')
            completed.assert_called_once()
            with patch.object(clips.time, 'monotonic', return_value=191):
                self.assertTrue(clips.request_clip())
                clips.join()

    def test_hub_save_delegates_to_capture_without_second_twitch_request(self):
        local = Mock()
        with patch.dict(replay._live, {'save_clip': local}, clear=True), \
             patch.object(clips, 'request_clip') as request:
            result = replay.interface.run_action('save')
        self.assertTrue(result['ok'])
        local.assert_called_once_with()
        request.assert_not_called()
        with patch.dict(replay._live, {}, clear=True), patch.object(clips, 'request_clip') as request:
            self.assertFalse(replay.interface.run_action('save')['ok'])
        request.assert_not_called()

    def test_new_authorization_adds_clips_without_invalidating_old_celebration_scopes(self):
        self.assertIn('clips:edit', AUTH_SCOPES.split())
        self.assertNotIn('clips:edit', SCOPES.split())
        self.assertTrue(set(SCOPES.split()) < set(AUTH_SCOPES.split()))


class ReplayCompanionClipTests(unittest.TestCase):
    def setUp(self):
        self.state = ReplayState()
        self.tracker = SimpleNamespace(first_kill_wall_time=None, last_death_wall_time=None)
        self.capture = capture.ReplayCapture(self.state, self.tracker)

    def save(self, **kwargs):
        self.capture._on_save(**kwargs)
        self.assertTrue(self.state._save_done_event[0].wait(2))

    @staticmethod
    def obs_save(*, timeout, on_save_requested):
        on_save_requested(100)
        return 'test-replay.mkv'

    def test_voice_and_hub_save_each_request_one_companion_before_local_processing(self):
        for via_hub in (False, True):
            with self.subTest(via_hub=via_hub), \
                 patch.object(capture, 'save_replay_buffer_and_wait', side_effect=self.obs_save), \
                 patch.object(capture, 'request_clip') as request, \
                 patch.object(capture, '_saved_clip', side_effect=lambda *a, **k: (
                     self.assertEqual(request.call_count, 1) or 'test-replay.mkv')), \
                 patch('instant_replay.library.remember_capture') as remember, \
                 patch.dict(replay._live, {'save_clip': self.capture._on_save}, clear=True), \
                 patch.object(clips, 'request_clip') as duplicate:
                if via_hub:
                    self.assertTrue(replay.interface.run_action('save')['ok'])
                    self.assertTrue(self.state._save_done_event[0].wait(2))
                else:
                    self.save(tag='good play', clip_seconds=20, pressed_at=90)
                request.assert_called_once_with(title='' if via_hub else 'good play')
                duplicate.assert_not_called()
                remember.assert_called_once()

    def test_duplicate_local_save_does_not_request_another_twitch_clip(self):
        entered, release = threading.Event(), threading.Event()
        def obs_save(*, timeout, on_save_requested):
            on_save_requested(100)
            entered.set()
            release.wait(2)
            return None
        with patch.object(capture, 'save_replay_buffer_and_wait', side_effect=obs_save), \
             patch.object(capture, 'request_clip') as request:
            try:
                self.capture._on_save()
                self.assertTrue(entered.wait(2))
                self.capture._on_save()
                request.assert_called_once_with(title='')
            finally:
                release.set()
                self.assertTrue(self.state._save_done_event[0].wait(2))

    def test_twitch_failure_does_not_prevent_local_save(self):
        with patch.object(capture, 'save_replay_buffer_and_wait', side_effect=self.obs_save), \
             patch.object(capture, 'request_clip', side_effect=RuntimeError('private token')), \
             patch.object(capture, '_saved_clip', return_value='test-replay.mkv'), \
             patch('instant_replay.library.remember_capture') as remember:
            self.save()
        remember.assert_called_once()
        self.assertEqual(len(self.state._clip_registry), 1)

    def test_failed_obs_connection_does_not_request_twitch(self):
        with patch.object(capture, 'save_replay_buffer_and_wait', return_value=None), \
             patch.object(capture, 'request_clip') as request:
            self.save()
        request.assert_not_called()


class ClipTitleTests(unittest.TestCase):
    def test_both_triggers_use_descriptive_context_without_generic_internal_names(self):
        now = datetime(2026, 10, 12, 21, 42)
        channel = {'title': 'Udyr jungle', 'game_name': 'League of Legends'}
        for label in ('', 'Instant Replay', 'Stream Highlight'):
            self.assertEqual(clip_title(label, channel=channel, now=now),
                             'Udyr jungle — League of Legends | Oct 12 · 9:42 PM')

    def test_labels_are_readable_bounded_and_do_not_include_links_or_newlines(self):
        now = datetime(2026, 10, 12, 21, 42)
        title = clip_title('Dragon steal\n https://spam.invalid',
                           channel={'game_name': 'League of Legends'}, now=now)
        self.assertEqual(title, 'Dragon steal — League of Legends | Oct 12 · 9:42 PM')
        self.assertLessEqual(len(clip_title('x' * 500, channel={'game_name': 'y' * 500}, now=now)), 100)
        self.assertIn('Stream Highlight |', clip_title(now=now))


if __name__ == '__main__':
    unittest.main()

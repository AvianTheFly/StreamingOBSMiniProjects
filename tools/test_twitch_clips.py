"""Offline Save/Twitch integration checks; never call Twitch or OBS."""
import os
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from lib import twitch_clips as clips
from twitch_celebrations.interface import _live
from twitch_celebrations.twitch import SCOPES, AUTH_SCOPES
from instant_replay import interface as replay


class TwitchClipTests(unittest.TestCase):
    def setUp(self):
        self.twitch = SimpleNamespace(tokens={'present': True}, token=Mock(return_value='test-token'),
                                      stop=Mock())
        self.twitch.stop.wait.return_value = False
        self.live = patch.dict(_live, {'service': SimpleNamespace(twitch=self.twitch)}, clear=True)
        self.env = patch.dict(os.environ, {'TWITCH_CLIENT_ID': 'client', 'TWITCH_BROADCASTER_ID': 'channel'})
        self.live.start(); self.env.start()
        self.addCleanup(self.live.stop); self.addCleanup(self.env.stop)
        self.addCleanup(clips._set, 'idle', '')
        clips._set('pending', 'Creating')

    def response(self, data, code=200):
        return Mock(status_code=code, json=Mock(return_value={'data': data}))

    def test_requests_fixed_minute_and_waits_for_published_clip(self):
        created = self.response([{'id': 'clip-id'}], 202)
        ready = {'id': 'clip-id', 'duration': 60, 'url': 'https://clips.twitch.tv/clip-id'}
        with patch.object(clips.requests, 'post', return_value=created) as post, \
             patch.object(clips.requests, 'get', side_effect=[self.response([]), self.response([ready])]) as get:
            clips._worker()
        self.assertEqual(post.call_count, 1)
        self.assertEqual(post.call_args.kwargs['params'], {'broadcaster_id': 'channel', 'duration': 60})
        self.assertEqual(get.call_count, 2)
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
                get.assert_not_called()
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

    def test_save_keeps_local_handler_and_queues_twitch(self):
        local = Mock()
        with patch.dict(replay._live, {'save_clip': local}, clear=True), \
             patch.object(clips, 'request_clip') as request:
            result = replay.interface.run_action('save')
        self.assertTrue(result['ok'])
        local.assert_called_once_with()
        request.assert_called_once_with()
        with patch.dict(replay._live, {}, clear=True), patch.object(clips, 'request_clip') as request:
            self.assertFalse(replay.interface.run_action('save')['ok'])
        request.assert_not_called()

    def test_new_authorization_adds_clips_without_invalidating_old_celebration_scopes(self):
        self.assertIn('clips:edit', AUTH_SCOPES.split())
        self.assertNotIn('clips:edit', SCOPES.split())
        self.assertTrue(set(SCOPES.split()) < set(AUTH_SCOPES.split()))


if __name__ == '__main__':
    unittest.main()

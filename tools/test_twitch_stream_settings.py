"""Startup check lifecycle and nonce ownership, without launching a browser."""
import threading
import unittest
from unittest.mock import patch
from lib.twitch_stream_settings.policy import channel_name
from lib.twitch_stream_settings.service import StreamSettingsService


class StreamSettingsTests(unittest.TestCase):
    def service(self):
        service = StreamSettingsService()
        with patch('lib.twitch_stream_settings.service.threading.Thread'):
            service.start(threading.Event())
        return service

    def test_single_check_and_stop_gate(self):
        service = self.service()
        self.assertFalse(service.retry())
        service.stop.set()
        self.assertFalse(service.report({'nonce': service.nonce, 'state': 'ready'}))

    def test_only_current_nonce_can_mark_verified(self):
        service = self.service()
        self.assertFalse(service.report({'nonce': 'unknown', 'state': 'ready'}))
        nonce = service.nonce
        self.assertTrue(service.report({'nonce': nonce, 'state': 'ready'}))
        self.assertEqual(service.snapshot()['state'], 'ready')
        self.assertFalse(service.report({'nonce': nonce, 'state': 'error'}))
        with patch('lib.twitch_stream_settings.service.threading.Thread'):
            service.retry()
        self.assertFalse(service.report({'nonce': nonce, 'state': 'ready'}))

    def test_status_is_copy_and_messages_never_echo_external_data(self):
        service = self.service()
        snapshot = service.snapshot(); snapshot['state'] = 'ready'
        self.assertEqual(service.snapshot()['state'], 'checking')
        service.report({'nonce': service.nonce, 'state': 'error', 'message': 'secret'})
        self.assertNotIn('secret', service.snapshot()['message'])

    def test_channel_validation(self):
        self.assertEqual(channel_name('Udyrisabotlaner'), 'udyrisabotlaner')
        for value in ('', 'a/b', 'https://example.com', '../a'):
            with self.assertRaises(ValueError): channel_name(value)

    def test_normal_chrome_has_no_debugger_or_separate_profile(self):
        service = self.service()
        service.done.set()
        with patch('lib.twitch_stream_settings.service.Path.is_file', return_value=True), \
             patch.dict('os.environ', TWITCH_CHANNEL='udyrisabotlaner'), \
             patch('lib.twitch_stream_settings.service.subprocess.Popen') as launch:
            service._run(service.nonce, service.done)
        command = launch.call_args.args[0]
        self.assertEqual(len(command), 2)
        self.assertIn('dashboard.twitch.tv/u/udyrisabotlaner/settings/stream', command[1])
        self.assertFalse(any('--remote-debugging' in value or '--user-data-dir' in value for value in command))


if __name__ == '__main__': unittest.main()

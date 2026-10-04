"""Offline regression checks for shared OBS recovery and audio polling."""
import logging
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from obs import client as c
from obs import interaction
from obsws_python.error import OBSSDKRequestError, OBSSDKTimeoutError


class ConnectionTests(unittest.TestCase):
    def setUp(self):
        for name, value in {'_client': None, '_retry_at': 0, '_retry_delay': 1, '_offline': False}.items():
            p = patch.object(c, name, value)
            p.start()
            self.addCleanup(p.stop)
        self.clock = patch.object(c.time, 'monotonic', return_value=100).start()
        self.addCleanup(patch.stopall)

    def test_offline_callers_share_backoff_and_one_notice(self):
        with patch.object(c, '_connect', side_effect=ConnectionRefusedError) as connect, patch('builtins.print') as output:
            for _ in range(50):
                with self.assertRaises(c.OBSUnavailable):
                    c.get_obs()
            self.assertEqual(connect.call_count, 1)
            self.clock.return_value = 101
            with self.assertRaises(c.OBSUnavailable):
                c.get_obs()
            self.assertEqual(connect.call_count, 2)
            self.assertEqual(c._retry_at, 103)
            self.assertEqual(output.call_count, 1)

    def test_shutdown_recovers_even_with_retained_client(self):
        for error in [OBSSDKRequestError('GetInputSettings', 207, 'Not ready'),
                      ConnectionResetError(), OBSSDKTimeoutError('timeout')]:
            with self.subTest(error=type(error)):
                raw = Mock()
                raw.get_input_settings.side_effect = error
                old = c._ThreadSafeReqClient(raw)
                c._client = old
                with self.assertRaises(c.OBSUnavailable):
                    old.get_input_settings('source')
                raw.base_client.ws.close.assert_called_once()
                fresh_raw = Mock()
                fresh_raw.get_input_settings.return_value = 'recovered'
                self.clock.return_value = c._retry_at
                with patch.object(c, '_connect', return_value=c._ThreadSafeReqClient(fresh_raw)):
                    self.assertEqual(old.get_input_settings('source'), 'recovered')

    def test_non_audio_cache_is_per_source_and_expires(self):
        raw = Mock()
        raw.get_input_volume.side_effect = OBSSDKRequestError('GetInputVolume', 604, 'No audio')
        c._client = c._ThreadSafeReqClient(raw)
        self.assertIsNone(interaction.get_input_volume('image'))
        self.assertIsNone(interaction.get_input_audio_monitor_type('image'))
        raw.get_input_audio_monitor_type.assert_not_called()
        self.assertIsNone(interaction.get_input_volume('image'))
        self.assertEqual(raw.get_input_volume.call_count, 1)
        raw.get_input_volume.side_effect = None
        raw.get_input_volume.return_value = Mock(input_volume_db=-12, input_volume_mul=0.25)
        self.assertEqual(interaction.get_input_volume('music')['db'], -12)
        self.clock.return_value = 131
        self.assertEqual(interaction.get_input_volume('image')['db'], -12)

    def test_unexpected_errors_remain_visible_and_do_not_disconnect(self):
        error = OBSSDKRequestError('GetInputVolume', 603, 'Wrong input kind')
        raw = Mock()
        raw.get_input_volume.side_effect = error
        client = c._ThreadSafeReqClient(raw)
        c._client = client
        with self.assertRaises(OBSSDKRequestError):
            client.get_input_volume('source')
        self.assertIs(c._client, client)
        record = logging.LogRecord('sdk', logging.ERROR, '', 1, str(error), (), (type(error), error, None))
        self.assertTrue(c._ExpectedErrors().filter(record))
        error = OBSSDKRequestError('GetInputVolume', 604, 'No audio')
        record.exc_info = (type(error), error, None)
        self.assertFalse(c._ExpectedErrors().filter(record))

    def test_program_queries_use_guarded_snapshot_and_preserve_sdk_contract(self):
        raw = Mock()
        raw.send.return_value = dict(currentProgramSceneName='Live',
                                    currentProgramSceneUuid='live-id',
                                    currentPreviewSceneName='Preview', scenes=[])
        client = c._ThreadSafeReqClient(raw)
        c._client = client
        result = client.get_current_program_scene()
        self.assertEqual(result.current_program_scene_name, 'Live')
        self.assertEqual(result.scene_name, 'Live')
        self.assertEqual(result.current_program_scene_uuid, 'live-id')
        self.assertEqual(result.scene_uuid, 'live-id')
        self.assertEqual(set(result.attrs()), {'scene_name', 'scene_uuid',
                         'current_program_scene_name', 'current_program_scene_uuid'})
        expected = dict(sceneName='Live', sceneUuid='live-id',
                        currentProgramSceneName='Live', currentProgramSceneUuid='live-id')
        self.assertEqual(client.send('GetCurrentProgramScene', {}, raw=True), expected)
        self.assertEqual(client.send(param='GetCurrentProgramScene', raw=True), expected)
        self.assertEqual(client.send('GetCurrentProgramScene', None, False).scene_name, 'Live')
        raw.get_current_program_scene.assert_not_called()
        self.assertEqual(raw.send.call_count, 4)
        for call in raw.send.call_args_list:
            self.assertEqual(call.args, ('GetSceneList',))
            self.assertEqual(call.kwargs, {'raw': True})

    def test_missing_program_does_not_guess_disconnect_or_cache(self):
        raw = Mock()
        client = c._ThreadSafeReqClient(raw)
        c._client = client
        for scene in (None, '', 42):
            raw.send.return_value = dict(currentProgramSceneName=scene,
                                        currentPreviewSceneName='Preview',
                                        scenes=[{'sceneName': 'Preview'}])
            with self.assertRaises(c.OBSUnavailable):
                client.get_current_program_scene()
            with self.assertRaises(c.OBSUnavailable):
                client.send('GetCurrentProgramScene', raw=True)
            self.assertIs(c._client, client)
        raw.send.return_value = dict(currentProgramSceneName='Recovered',
                                    currentProgramSceneUuid='new-id')
        self.assertEqual(client.get_current_program_scene().scene_name, 'Recovered')
        raw.base_client.ws.close.assert_not_called()
        raw.get_current_program_scene.assert_not_called()

    def test_guarded_scene_query_recovers_after_transport_loss(self):
        raw = Mock()
        raw.send.side_effect = ConnectionResetError()
        old = c._ThreadSafeReqClient(raw)
        c._client = old
        with self.assertRaises(c.OBSUnavailable):
            old.get_current_program_scene()
        raw.base_client.ws.close.assert_called_once()
        fresh_raw = Mock()
        fresh_raw.send.return_value = dict(currentProgramSceneName='New',
                                         currentProgramSceneUuid='new-id')
        self.clock.return_value = c._retry_at
        with patch.object(c, '_connect', return_value=c._ThreadSafeReqClient(fresh_raw)):
            self.assertEqual(old.get_current_program_scene().scene_name, 'New')
        fresh_raw.send.assert_called_once_with('GetSceneList', raw=True)

    def test_other_raw_requests_keep_their_payload_and_response(self):
        raw = Mock()
        client = c._ThreadSafeReqClient(raw)
        c._client = client
        data = {'inputName': 'Music'}
        self.assertIs(client.send('GetInputSettings', data, raw=True), raw.send.return_value)
        raw.send.assert_called_once_with('GetInputSettings', data, raw=True)


if __name__ == '__main__':
    unittest.main()

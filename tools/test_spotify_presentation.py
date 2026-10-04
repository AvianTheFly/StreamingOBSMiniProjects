"""Native browser readiness, worker replacement and personal-source preservation."""
import copy
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.obs_presentation import OBSPresentation, attach_obs, managed_url
from spotify.presentation_state import PresentationState


class PresentationTests(unittest.TestCase):
    def channel(self):
        return SimpleNamespace(ready=threading.Event(), publish_control=Mock())

    def test_ready_identity_rejects_old_worker_disconnect(self):
        state = PresentationState()
        first, second = self.channel(), self.channel()
        self.assertIsNone(state.presentation_token())
        state.connect_audio_channel(first)
        self.assertIsNone(state.presentation_token())
        first.ready.set()
        self.assertIs(state.presentation_token(), first)
        state.connect_audio_channel(second)
        state.disconnect_audio_channel(first)
        self.assertIsNone(state.presentation_token())
        second.ready.set()
        self.assertIs(state.presentation_token(), second)
        state.disconnect_audio_channel(second)
        self.assertIsNone(state.presentation_token())

    def test_refresh_waits_for_ready_and_occurs_once_per_worker(self):
        state, owner = PresentationState(), OBSPresentation()
        first, second = self.channel(), self.channel()
        with patch('spotify.obs_presentation.attach_obs') as attach:
            state.connect_audio_channel(first)
            owner.sync(state)
            attach.assert_not_called()
            first.ready.set()
            owner.sync(state)
            owner.sync(state)
            attach.assert_called_once_with(refresh_existing=True)
            state.connect_audio_channel(second)
            owner.sync(state)
            self.assertEqual(attach.call_count, 1)
            second.ready.set()
            owner.sync(state)
            self.assertEqual(attach.call_count, 2)

    def test_failed_or_replaced_attachment_cannot_claim_new_worker(self):
        state, owner = PresentationState(), OBSPresentation()
        first, second = self.channel(), self.channel()
        first.ready.set(); second.ready.set(); state.connect_audio_channel(first)
        with patch('spotify.obs_presentation.attach_obs', side_effect=RuntimeError('OBS reconnecting')):
            with self.assertRaises(RuntimeError): owner.sync(state)
        self.assertIsNone(owner.attached_token)
        with patch('spotify.obs_presentation.attach_obs', side_effect=lambda **kw: state.connect_audio_channel(second)):
            owner.sync(state)
        self.assertIsNone(owner.attached_token)
        with patch('spotify.obs_presentation.attach_obs') as attach:
            owner.sync(state); owner.sync(state)
            attach.assert_called_once()
        self.assertIs(owner.attached_token, second)

    def test_refresh_preserves_source_settings_and_never_writes_scenes(self):
        import obs
        settings = dict(url='http://127.0.0.1:7447/overlay', width=1200, height=900,
                        fps=60, shutdown=False, custom='personal')
        before, calls = copy.deepcopy(settings), []
        def send(request, data, **kwargs):
            calls.append((request, data))
            if request == 'GetInputList':
                return {'inputs': [{'inputName': 'Hub Spotify Visualizer', 'inputKind': 'browser_source'}]}
            if request == 'GetInputSettings': return {'inputSettings': settings}
            if request == 'PressInputPropertiesButton': return None
            self.fail('Unexpected native mutation: ' + request)
        with patch.object(obs, 'get_obs', return_value=SimpleNamespace(send=send)):
            attach_obs(refresh_existing=True)
        self.assertEqual(settings, before)
        self.assertEqual([r for r, d in calls], ['GetInputList', 'GetInputSettings', 'PressInputPropertiesButton'])
        self.assertEqual(calls[-1][1], {'inputName': 'Hub Spotify Visualizer', 'propertyName': 'refreshnocache'})

    def test_personal_urls_are_not_refreshed(self):
        import obs
        for url in ['http://localhost:8080/overlay', 'https://example.com/music',
                    'http://127.0.0.1:7447/personal', 'file:///C:/personal/overlay.html']:
            with self.subTest(url=url):
                def send(request, data, **kwargs):
                    if request == 'GetInputList':
                        return {'inputs': [{'inputName': 'Hub Spotify Visualizer', 'inputKind': 'browser_source'}]}
                    if request == 'GetInputSettings': return {'inputSettings': {'url': url}}
                    self.fail('Personal source was refreshed')
                with patch.object(obs, 'get_obs', return_value=SimpleNamespace(send=send)):
                    attach_obs(refresh_existing=True)
        self.assertTrue(managed_url('http://localhost:7447/overlay?personal=1'))
        self.assertFalse(managed_url('http://localhost:invalid/overlay'))

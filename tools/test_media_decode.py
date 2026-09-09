"""Offline decoder-policy and atomic file/decoder update regressions."""
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from obs import media_decode, interaction


class DecodeTests(unittest.TestCase):
    def setUp(self):
        media_decode._small_h264.cache_clear()

    def test_small_h264_software_heavy_and_unknown_hardware(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'clip.mp4'
            path.touch()
            for codec, width, height, fps, expected in [
                ('h264', 640, 360, '30/1', False),
                ('h264', 1280, 720, '30000/1001', False),
                ('h264', 1280, 720, '60/1', True),
                ('h264', 3840, 2160, '30/1', True),
                ('hevc', 640, 360, '30/1', True),
                ('h264', 640, 360, '0/0', True),
            ]:
                media_decode._small_h264.cache_clear()
                result = SimpleNamespace(returncode=0, stdout=json.dumps({'streams': [{
                    'codec_name': codec, 'width': width, 'height': height, 'avg_frame_rate': fps}]}))
                with self.subTest(codec=codec, width=width, fps=fps), \
                     patch.dict(os.environ, {'HUB_MEDIA_DECODE_MODE': 'auto'}), \
                     patch.object(media_decode.subprocess, 'run', return_value=result):
                    self.assertEqual(media_decode.hardware_decode_for(path), expected)

    def test_manual_mode_does_not_probe_or_override_checkbox(self):
        with patch.dict(os.environ, {'HUB_MEDIA_DECODE_MODE': 'preserve'}), \
             patch.object(media_decode.subprocess, 'run') as probe:
            self.assertIsNone(media_decode.hardware_decode_for('song.mp4'))
        probe.assert_not_called()

    def test_file_and_decoder_change_are_one_update(self):
        client = Mock()
        client.get_input_settings.return_value = SimpleNamespace(input_settings={
            'local_file': 'old.mp4', 'hw_decode': True, 'is_local_file': True,
            'speed_percent': 90, 'close_when_inactive': False})
        with patch.object(interaction, 'get_obs', return_value=client), \
             patch.object(media_decode, 'hardware_decode_for', return_value=False):
            self.assertTrue(interaction.set_media_source_file('player', 'new.mp4', managed_decode=True))
        client.set_input_settings.assert_called_once_with('player', {
            'local_file': 'new.mp4', 'hw_decode': False}, overlay=True)

    def test_same_path_spelling_does_not_reopen_decoder(self):
        client = Mock()
        client.get_input_settings.return_value = SimpleNamespace(input_settings={
            'local_file': 'F:\\Media\\Clip.mp4', 'hw_decode': False})
        with patch.object(interaction, 'get_obs', return_value=client), \
             patch.object(media_decode, 'hardware_decode_for', return_value=False):
            self.assertFalse(interaction.set_media_source_file('player', 'f:/media/clip.mp4', managed_decode=True))
        client.set_input_settings.assert_not_called()

    def test_same_file_new_decoder_reports_automatic_start(self):
        client = Mock()
        client.get_input_settings.return_value = SimpleNamespace(input_settings={
            'local_file': 'clip.mp4', 'hw_decode': True})
        with patch.object(interaction, 'get_obs', return_value=client), \
             patch.object(media_decode, 'hardware_decode_for', return_value=False):
            self.assertTrue(interaction.set_media_source_file('player', 'clip.mp4', managed_decode=True))
        client.set_input_settings.assert_called_once_with('player', {'hw_decode': False}, overlay=True)


if __name__ == '__main__':
    unittest.main()

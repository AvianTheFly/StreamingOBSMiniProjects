"""Saved voice choices must reach a fresh Hub startup, with environment fallback."""
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch

from hub_ui import settings


class VoiceSettingsTests(unittest.TestCase):
    def config(self, saved):
        with patch.object(Path, 'read_text', return_value=json.dumps(saved)), \
             patch.dict(os.environ, {'WHISPER_MODEL': 'large-v3',
                                     'WHISPER_DEVICE': 'cpu', 'WHISPER_COMPUTE': 'int8',
                                     'MIC_DEVICE': '7'}, clear=True):
            return runpy.run_path(str(Path(__file__).resolve().parents[1] / 'hub_config.py'))

    def test_saved_gpu_choice_overrides_environment_on_startup(self):
        cfg = self.config({'whisper_model': 'small.en', 'whisper_device': 'cuda',
                           'whisper_compute': 'int8_float16'})
        self.assertEqual((cfg['WHISPER_MODEL'], cfg['WHISPER_DEVICE'], cfg['WHISPER_COMPUTE']),
                         ('small.en', 'cuda', 'int8_float16'))
        self.assertEqual(cfg['MIC_DEVICE'], 7)

    def test_unrelated_settings_do_not_replace_voice_environment(self):
        cfg = self.config({'project_trigger_modes': {'soundboard': 'pause'}})
        self.assertEqual(cfg['WHISPER_MODEL'], 'large-v3')
        self.assertEqual(cfg['WHISPER_DEVICE'], 'cpu')

    def test_system_microphone_selection_and_numbers_survive_restart(self):
        cfg = self.config({'mic_device': None, 'mic_sample_rate': 16000, 'rms_threshold': .02})
        self.assertIsNone(cfg['MIC_DEVICE'])
        self.assertEqual(cfg['MIC_SAMPLE_RATE'], 16000)
        self.assertEqual(cfg['RMS_THRESHOLD'], .02)

    def test_blank_or_structured_voice_values_use_environment(self):
        cfg = self.config({'whisper_model': '', 'whisper_device': {}, 'whisper_compute': False})
        self.assertEqual((cfg['WHISPER_MODEL'], cfg['WHISPER_DEVICE'], cfg['WHISPER_COMPUTE']),
                         ('large-v3', 'cpu', 'int8'))

    def test_invalid_settings_document_uses_environment(self):
        self.assertEqual(self.config([])['WHISPER_DEVICE'], 'cpu')
        with patch.object(Path, 'read_text', return_value='{broken'), \
             patch.dict(os.environ, {'WHISPER_DEVICE': 'cpu'}, clear=True):
            cfg = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'hub_config.py'))
        self.assertEqual(cfg['WHISPER_DEVICE'], 'cpu')

    def test_ui_fills_missing_voice_fields_and_keeps_custom_data(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'hub_settings.json'
            path.write_text(json.dumps({'custom': 'keep', 'whisper_model': 'small.en'}))
            with patch.object(settings, '_SETTINGS_FILE', path):
                loaded = settings.load_settings()
        self.assertEqual(loaded['custom'], 'keep')
        self.assertEqual(loaded['whisper_model'], 'small.en')
        self.assertIn('whisper_device', loaded)
        self.assertIn('mic_device', loaded)


if __name__ == '__main__':
    unittest.main()

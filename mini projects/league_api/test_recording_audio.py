import unittest
from types import SimpleNamespace

from .recording_audio import verify_audio
from .recording_timeline import observe_clock, offset_at


class RecordingAudioTests(unittest.TestCase):
    def client(self, *, tracks=6, music=False, executable='Spotify.exe'):
        class Client:
            def send(self, request, data, raw=True):
                if request == 'GetProfileParameter':
                    return {'parameterValue': {'Mode':'Simple', 'RecTracks':str(tracks), 'RecQuality':'Small'}[data['parameterName']]}
                return {'inputAudioTracks': {'2': music, '3': True}}
            def get_input_list(self):
                return SimpleNamespace(inputs=[{'inputName':'Music capture', 'inputKind':'wasapi_process_output_capture'}])
            def get_input_settings(self, name):
                return SimpleNamespace(input_settings={'window':'Title:Class:'+executable})
        return Client()

    def test_clean_first_and_full_mix_second(self):
        tracks = verify_audio(self.client(), [])
        self.assertEqual([t['obs_track'] for t in tracks], [2,3])

    def test_music_sources_or_wrong_tracks_block_start(self):
        for executable in ['Spotify.exe', 'chrome.exe']:
            with self.subTest(executable=executable), self.assertRaises(ValueError):
                verify_audio(self.client(music=True, executable=executable), [])
        with self.assertRaises(ValueError):
            verify_audio(self.client(tracks=3), [])

    def test_encoder_delay_realigns_early_marks(self):
        session={'started_at':100, 'timeline_origin':100,
                 'markers':[{'at':101, 'offset_seconds':1, 'range_start_seconds':0}]}
        observe_clock(session,102,0)
        observe_clock(session,104,.25)
        self.assertEqual(session['markers'][0]['offset_seconds'],0)
        self.assertEqual(offset_at(session,110),6.25)

    def test_observed_pause_does_not_shift_earlier_marks(self):
        session={'started_at':100, 'markers':[]}
        observe_clock(session,104,1)
        self.assertEqual(offset_at(session,110),7)
        observe_clock(session,120,15,paused=True)
        self.assertEqual(offset_at(session,110),7)
        self.assertEqual(offset_at(session,125),20)

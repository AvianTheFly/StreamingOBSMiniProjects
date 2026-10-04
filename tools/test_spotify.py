"""Spotify isolation, freshness, real FFT and local HTTP contracts."""
import json
import sys
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths
ensure_import_paths()
import numpy as np
from spotify.service import SpotifyState, select_spotify, spectrum, AudioAnalysis
from spotify.main import attach_obs
from spotify.http_server import make_server


class SpotifyTests(unittest.TestCase):
    def test_only_spotify_and_prefer_playing_session(self):
        def session(name, status):
            return SimpleNamespace(source_app_user_model_id=name,
                get_playback_info=lambda: SimpleNamespace(playback_status=status))
        browser = session('Chrome', 4)
        paused, playing = session('Spotify.exe', 5), session('Spotify.exe', 4)
        self.assertIsNone(select_spotify([browser], 4))
        self.assertIs(select_spotify([browser, paused, playing], 4), playing)

    def test_pause_stale_and_hidden_never_display(self):
        state = SpotifyState()
        state.set_media(playing=True, title='Music', artist='Artist', error='')
        self.assertTrue(state.snapshot()['playing'])
        state.hidden = True
        self.assertFalse(state.snapshot()['playing'])
        state.hidden = False
        state.updated -= 3
        self.assertFalse(state.snapshot()['playing'])
        state.set_media(playing=False, title='Music', artist='Artist', error='')
        self.assertFalse(state.snapshot()['playing'])

    def test_spectrum_responds_to_frequency_and_silence(self):
        rate = 48000
        samples = np.sin(2*np.pi*1000*np.arange(2048)/rate)[:, None] * .2
        bands = spectrum(samples, rate)
        self.assertEqual(len(bands), 48)
        self.assertGreater(max(bands), .5)
        self.assertTrue(22 < np.argmax(bands) < 30)
        self.assertEqual(spectrum(np.zeros((2048, 2)), rate), [0.] * 48)

    def test_analysis_has_deep_valleys_and_preserves_dynamics(self):
        t = np.arange(2048)/44100
        analysis = AudioAnalysis()
        loud = (.18*np.sin(2*np.pi*90*t)+.04*np.sin(2*np.pi*6000*t))[:,None]
        bands, features = analysis.analyze(loud)
        self.assertGreater(max(bands)-np.median(bands), .6)
        self.assertGreater(features['bass'], 0)
        self.assertGreater(features['beat'], 0)
        self.assertTrue(min(features['waveform']) < -.3 < .3 < max(features['waveform']))
        _, quiet = analysis.analyze(loud*.05)
        self.assertLess(quiet['energy'], features['energy']*.15)
        _, silent = analysis.analyze(np.zeros((2048,2)))
        self.assertEqual(silent['energy'],0)

    def test_expired_audio_clears_every_feature(self):
        state = SpotifyState()
        state.features = dict(waveform=[.8]*128,bass=1.,treble=1.,energy=1.,beat=1.)
        state.audio_updated = 0
        self.assertEqual(state.snapshot()['energy'],0)
        self.assertEqual(state.snapshot()['waveform'],[0.]*128)
        self.assertEqual(state.snapshot()['width'],0)
        self.assertEqual(state.snapshot()['pitch'],0)

    def test_louder_bass_cannot_erase_unchanged_quiet_upper_note(self):
        t = np.arange(4096)/44100
        upper = .009*np.sin(2*np.pi*3200*t)
        soft = (.025*np.sin(2*np.pi*86*t)+upper)[:, None]
        heavy = (.30*np.sin(2*np.pi*86*t)+upper)[:, None]
        a = np.array(AudioAnalysis().analyze(soft)[0])
        b = np.array(AudioAnalysis().analyze(heavy)[0])
        lane = int(np.argmax(a[32:40]))+32
        self.assertGreater(a[lane], .3)
        self.assertAlmostEqual(a[lane], b[lane], delta=.015)
        quiet = np.array(AudioAnalysis().analyze(soft*.15)[0])
        self.assertLess(quiet[lane], a[lane]-.15, 'absolute phrase dynamics must survive')

    def test_wide_upper_layer_survives_centered_bass_and_has_its_own_space(self):
        t = np.arange(4096)/44100
        bass = .2*np.sin(2*np.pi*86*t)
        layer = .025*np.sin(2*np.pi*3200*t)
        bands, f = AudioAnalysis().analyze(np.column_stack((bass+layer, bass-layer)))
        self.assertGreater(max(bands[32:40]), .45, 'opposed upper layer must survive mono bass')
        self.assertGreater(f['voice_widths'][5], .9)
        self.assertLess(f['voice_widths'][1], .05)
        _, pan = AudioAnalysis().analyze(np.column_stack((bass+layer*.15, bass+layer)))
        self.assertGreater(pan['voice_balances'][5], .6)
        self.assertAlmostEqual(pan['voice_balances'][1], 0, delta=.01)

    def test_pitch_texture_and_stereo_features_are_measured(self):
        t = np.arange(2048)/44100
        tone = .12*np.sin(2*np.pi*440*t)
        low = AudioAnalysis().analyze((.12*np.sin(2*np.pi*110*t))[:,None])[1]
        high = AudioAnalysis().analyze((.12*np.sin(2*np.pi*2200*t))[:,None])[1]
        self.assertGreater(high['pitch'],low['pitch']+.3)
        mono = AudioAnalysis().analyze(np.column_stack((tone,tone)))[1]
        wide = AudioAnalysis().analyze(np.column_stack((tone,-tone)))[1]
        self.assertEqual(mono['width'],0)
        self.assertGreater(wide['width'],.9)
        self.assertGreater(wide['energy'],.2,'opposed stereo must not be mistaken for silence')
        self.assertAlmostEqual(mono['balance'],0)
        right = AudioAnalysis().analyze(np.column_stack((tone*.2,tone)))[1]
        self.assertGreater(right['balance'],.5)
        noise = np.random.default_rng(20).normal(0,.12,(2048,2))
        noisy = AudioAnalysis().analyze(noise)[1]
        self.assertGreater(mono['tonality'],noisy['tonality']+.4)

    def test_existing_obs_source_is_not_modified(self):
        import obs
        client = SimpleNamespace(send=lambda *a, **k: {'inputs':[
            {'inputName':'Hub Spotify Visualizer', 'inputKind':'browser_source'}]})
        with patch.object(obs, 'get_obs', return_value=client), patch.object(obs, 'set_source_transform') as move:
            attach_obs()
            move.assert_not_called()

    def test_one_fft_per_window_and_no_transform_for_silence(self):
        samples = np.sin(2*np.pi*440*np.arange(2048)/44100)[:, None] * .12
        with patch.object(np.fft, 'rfft', wraps=np.fft.rfft) as transform:
            AudioAnalysis().analyze(samples)
            transform.assert_called_once()
            AudioAnalysis().analyze(np.zeros((2048, 2)))
            self.assertEqual(transform.call_count, 1)

    def test_http_state_and_path_safety(self):
        server = make_server(SpotifyState(), 0)
        worker = threading.Thread(target=server.serve_forever)
        worker.start()
        try:
            root = f'http://127.0.0.1:{server.server_port}'
            with urlopen(root+'/api/state') as response:
                self.assertFalse(json.load(response)['playing'])
            with urlopen(root+'/overlay') as response:
                overlay = response.read()
                self.assertIn(b'visualizer', overlay)
                for name in ('surface.js', 'filament.js', 'reactive.js', 'forms.js', 'performance.js', 'radiance.js', 'music_strings.js', 'music_pacing.js', 'music_motion.js', 'journey.js', 'stage_palette.js', 'stage_spirits.js', 'stage_geometry.js', 'stage_morph.js', 'stage_renderer.js'):
                    self.assertIn(name.encode(), overlay)
                    with urlopen(root+'/'+name) as script:
                        self.assertIn('application/javascript', script.headers['Content-Type'])
                        self.assertGreater(len(script.read()), 1000)
            from urllib.error import HTTPError
            with self.assertRaises(HTTPError):
                urlopen(root+'/../.env')
        finally:
            server.shutdown()
            server.server_close()
            worker.join()


if __name__ == '__main__':
    unittest.main()

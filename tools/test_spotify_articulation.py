"""Equal-RMS musical gestures through production DSP and fixed IPC transport."""
import json
import multiprocessing
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.audio_analysis import AudioAnalysis, quiet_features
from spotify.audio_channel import AudioChannel


def fixtures():
    t = np.arange(44100*3)/44100
    # A vowel-like harmonic stack with slow pitch inflection; deterministic
    # broadband strikes; a mixture at their original individual amplitudes.
    phase = 2*np.pi*(220*t+1.5*np.sin(t*2))
    lead = sum(np.sin(phase*k)*np.exp(-((k-4)/3)**2)/k for k in range(1, 13))
    lead *= .12/np.sqrt(np.mean(lead*lead))
    noise = np.random.default_rng(17).normal(size=len(t))
    age = t % .5
    drums = noise*np.exp(-age/.045)
    drums *= .12/np.sqrt(np.mean(drums*drums))
    plucks = (np.sin(t*2*np.pi*330)+.5*np.sin(t*2*np.pi*660)+.25*np.sin(t*2*np.pi*990))*np.exp(-age/.10)
    plucks *= .12/np.sqrt(np.mean(plucks*plucks))
    return {'phrase': lead, 'strikes': drums, 'mixture': lead+drums,
            'quiet': lead*.1, 'hiss': noise*.12, 'plucks': plucks}


def measured(signal):
    analysis = AudioAnalysis()
    stereo = np.column_stack((signal, signal))
    frames = []
    for end in range(2048, len(signal), 441):
        bands, values = analysis.analyze(stereo[end-2048:end], realtime=True)
        frames.append(dict(values, bands=bands, playing=True, title='Articulation audit',
                           artist='Synthetic audio', sample_time=end/44100, audio_revision=len(frames)))
    return frames


class ArticulationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames = {name: measured(signal) for name, signal in fixtures().items()}

    def test_equal_rms_sustain_and_hits_are_distinct_and_mix_survives(self):
        values = {name: np.mean([x['lead_level'] for x in frames[20:]]) for name, frames in self.frames.items()}
        self.assertGreater(values['phrase'], values['strikes']*3)
        self.assertGreater(values['phrase'], values['hiss']*3)
        self.assertGreater(values['mixture'], values['phrase']*.65)
        self.assertAlmostEqual(values['quiet']/values['phrase'], .1, places=4)
        phrase_attack = np.percentile([x['attack_level'] for x in self.frames['phrase'][20:]], 95)
        strike_attack = max(x['attack_level'] for x in self.frames['strikes'][20:])
        self.assertGreater(strike_attack, phrase_attack*5)

    def test_complete_mailbox_no_extra_fft_and_silence_resets(self):
        analysis = AudioAnalysis()
        x = fixtures()['phrase'][:2048]
        with patch('numpy.fft.rfft', wraps=np.fft.rfft) as fft:
            bands, features = analysis.analyze(np.column_stack((x,x)), realtime=True)
        self.assertEqual(fft.call_count, 3)
        channel = AudioChannel(multiprocessing.get_context('spawn'))
        channel.publish_audio(bands, features, 1, .5, True)
        _, actual, *_ = channel.unpack(channel.read(-1)['values'])
        self.assertEqual(actual, features)
        self.assertEqual(analysis.analyze(np.zeros((2048,2)))[1], quiet_features())
        self.assertIsNone(analysis.articulation.envelope)

    def test_pitch_tracks_tone_height(self):
        t = np.arange(44100)/44100
        low = measured(.2*np.sin(t*2*np.pi*300))[-1]
        high = measured(.2*np.sin(t*2*np.pi*1700))[-1]
        self.assertGreater(high['lead_pitch'], low['lead_pitch']+.5)


if __name__ == '__main__':
    if '--fixture' in sys.argv:
        target = ROOT/'output/spotify/articulation-fixture.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({name: measured(signal) for name, signal in fixtures().items()}))
        print(target)
    else:
        unittest.main()

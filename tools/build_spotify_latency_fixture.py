"""Finite causal PCM fixtures for the browser latency benchmark; never plays audio."""
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.audio_analysis import AudioAnalysis


def build(output):
    spec = importlib.util.spec_from_file_location('latency_before', output/'before-audio_analysis.py')
    old = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(old)
    cases = []
    for frequency in (90, 800, 6000):
        cases.append({'frequency': frequency})
        for label, cls, realtime, cadence in (
                ('before', old.AudioAnalysis, False, 20), ('after', AudioAnalysis, True, 10)):
            analyzer, frames = cls(), []
            for ms in range(-200, 201, cadence):
                t = np.arange(int(ms*44.1)-2048, int(ms*44.1))/44100
                # The aperture ends at this timestamp; future sound never enters it.
                samples = (np.where(t < 0, .004, .06)*np.sin(2*np.pi*frequency*t))[:, None]
                bands, features = analyzer.analyze(samples, **({'realtime': True} if realtime else {}))
                frames.append(dict(timeMs=ms, bands=bands, **features))
            cases[-1][label] = frames
    (output/'pcm-fixture.json').write_text(json.dumps(cases), encoding='utf-8')


if __name__ == '__main__':
    build(Path(sys.argv[1]).resolve())

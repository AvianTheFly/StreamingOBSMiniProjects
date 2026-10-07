"""Compare synthetic audio measurements and CPU time with a committed analyzer.

Finite maintenance command: no Spotify, microphone, browser, OBS or settings I/O.
The reference is local Git source, so comparisons remain reproducible after edits.
"""
import argparse
import json
from pathlib import Path
import statistics
import subprocess
import sys
import time
import types

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def benchmark(reference):
    from lib.paths import ensure_import_paths
    from tools.offline_test_resources import configure_test_process
    configure_test_process()
    ensure_import_paths()
    import numpy as np
    from spotify.audio_analysis import AudioAnalysis

    source = subprocess.check_output(['git', 'show',
        reference + ':mini projects/spotify/audio_analysis.py'], cwd=ROOT, text=True)
    previous = types.ModuleType('spotify._reference_analysis')
    previous.__package__ = 'spotify'
    exec(compile(source, '<committed audio analyzer>', 'exec'), previous.__dict__)
    rng = np.random.default_rng(104)
    comparisons, error = 0, 0.
    for rate in (22050, 44100, 48000):
        for size in (255, 512, 1023, 2048, 4097):
            for channels in (1, 2):
                for realtime in (False, True):
                    old, new = previous.AudioAnalysis(), AudioAnalysis()
                    axis = np.arange(size) / rate
                    tone = np.sin(2*np.pi*90*axis) + .3*np.sin(2*np.pi*3200*axis)
                    for gain in (.1, .01, 0., .2):
                        audio = gain*(tone[:, None] + rng.normal(0, .2, (size, channels)))
                        if channels == 2:
                            audio[:, 1] *= -.7  # Opposed stereo must retain width.
                        a, af = old.analyze(audio, rate, realtime=realtime)
                        b, bf = new.analyze(audio, rate, realtime=realtime)
                        assert af.keys() == bf.keys()
                        for before, after in [(a, b), *((af[k], bf[k]) for k in af)]:
                            np.testing.assert_allclose(after, before, rtol=1e-10, atol=1e-12)
                            error = max(error, float(np.max(np.abs(np.asarray(after)-before))))
                        comparisons += 1
    audio = rng.normal(0, .1, (2048, 2)).astype('float32')
    timings = {'before': [], 'after': []}
    for round_number in range(6):
        order = [('before', previous.AudioAnalysis), ('after', AudioAnalysis)]
        for name, analyzer in order[::1 if round_number % 2 == 0 else -1]:
            instance = analyzer()
            instance.analyze(audio, realtime=True)
            started = time.process_time()
            for _ in range(600):
                instance.analyze(audio, realtime=True)
            timings[name].append((time.process_time()-started)/600*1000)
    medians = {k: statistics.median(v) for k, v in timings.items()}
    return dict(reference=reference, compared_packets=comparisons, max_error=error,
                cpu_ms_per_packet=medians, rounds=timings,
                reduction_percent=100*(1-medians['after']/medians['before']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = benchmark(args.reference)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))

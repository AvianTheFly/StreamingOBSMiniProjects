"""Finite silent PCM audit: known kicks plus changing non-rhythmic lead audio.

The production DSP measures causal windows. No media playback, live capture,
personal settings, or runtime worker is created. Optional reference decoding
uses the shared bounded media-job owner.
"""
import argparse
import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.audio_analysis import AudioAnalysis


def measurements(samples, start=0):
    analysis = AudioAnalysis()
    frames = []
    for end in range(2048, len(samples), 441):
        bands, features = analysis.analyze(samples[end-2048:end], 44100, realtime=True)
        frames.append(dict(features, bands=bands, playing=True, title='Known timing audit',
                           artist='Silent production DSP', sample_time=start+end/44100,
                           audio_revision=len(frames), revision=1))
    return frames


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('out', type=Path)
    parser.add_argument('--reference', type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    t = np.arange(44100*14)/44100
    lead = (.055+.07*(.5+.5*np.sin(t*5.1)))*np.sin(2*np.pi*660*t)+.03*np.sin(2*np.pi*1200*t)
    signal = lead+.025*np.sin(2*np.pi*70*t)
    events = np.arange(4, 12, .5)
    for event in events:
        age = t-event
        gain = .26 if event < 8 else .09
        signal += np.where((age >= 0) & (age < .25),
                           gain*np.sin(2*np.pi*62*np.maximum(age, 0))*np.exp(-np.maximum(age, 0)/.065), 0)
    payload = dict(events=events.tolist(), frames=measurements(np.column_stack((signal, signal))))
    (args.out/'rhythm-fixture.json').write_text(json.dumps(payload))
    if args.reference:
        from lib.media_jobs import jobs
        result = jobs.run(['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-ss', '40',
                           '-i', str(args.reference), '-t', '50', '-vn', '-threads', '1',
                           '-filter_threads', '1', '-ac', '2', '-ar', '44100', '-f', 'f32le', 'pipe:1'],
                          kind='spotify-rhythm-audit', weight=1, timeout=60, check=True)
        pcm = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2)
        (args.out/'dennett-realtime.json').write_text(json.dumps(measurements(pcm, 40)))
    print(args.out)


if __name__ == '__main__':
    main()

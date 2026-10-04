"""Finite user-selected recording -> causal production measurements, no playback.

Analyzes the whole recording up to a bounded ten-minute aperture. The output
keeps 30-Hz presentation samples from the production 100-Hz DSP cadence.
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths
ensure_import_paths()
from lib.media_jobs import jobs
from spotify.audio_analysis import AudioAnalysis, quiet_features


def main():
    source, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    result = jobs.run(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(source),
                       '-t', '600', '-ac', '2', '-ar', '44100', '-f', 'f32le', 'pipe:1'],
                      kind='spotify-reference-study', weight=1, priority=0, timeout=60, check=True)
    pcm = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2)
    rate, cadence = 44100, 100
    duration = len(pcm)/rate
    analysis, frames, stats = AudioAnalysis(), [], []
    frames.append(dict(bands=[0.]*48, **quiet_features()))
    next_frame = 1
    for tick in range(1, int(np.ceil(duration*cadence))+1):
        end = min(len(pcm), int(tick*rate/cadence))
        block = pcm[max(0, end-2048):end]
        if len(block)<2048:
            block = np.pad(block, ((2048-len(block), 0), (0, 0)))
        bands, features = analysis.analyze(block, rate, realtime=True)
        while next_frame/30 <= min(tick/cadence, duration):
            frames.append(dict(bands=bands, **features))
            next_frame += 1
        if tick % 200 == 0:
            stats.append(dict(seconds=tick/cadence, **{k:features[k] for k in
                         ['loudness', 'roughness', 'noisiness', 'flux', 'voice_levels']}))
    metadata = dict(source=str(source), seconds=duration, analyzed_seconds=len(pcm)/rate,
                    dsp_hz=cadence, presentation_hz=30, frames=len(frames), maximum_seconds=600,
                    causal=True, plays_audio=False)
    (out/'full-song.json').write_text(json.dumps(frames, separators=(',', ':')), encoding='utf-8')
    (out/'full-song-evidence.json').write_text(json.dumps(dict(**metadata, checkpoints=stats), indent=2), encoding='utf-8')
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()

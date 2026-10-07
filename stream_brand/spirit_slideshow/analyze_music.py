"""Finite first-forty-second soundtrack analysis for authored slideshow cuts."""
from pathlib import Path
import argparse
import json
import wave
import numpy as np
from stream_brand.intro.audio import analyze
from .render import run


def build(output, music):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    wav = output / 'music-analysis.wav'
    run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-threads', '1', '-i', str(music),
         '-t', '40', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', str(wav)],
        'slideshow-music-analysis')
    result = analyze(wav, 40)
    with wave.open(str(wav), 'rb') as source:
        pcm = np.frombuffer(source.readframes(source.getnframes()), '<i2').astype(float)/32768
    stereo = pcm.reshape(-1, 2)
    result['rms_per_second'] = [float(np.sqrt(np.mean(stereo[j*48000:(j+1)*48000]**2))) for j in range(40)]
    (output/'music-analysis.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({k:result[k] for k in ('bpm', 'phase_seconds', 'detected_attacks', 'rms_per_second')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--music', type=Path, required=True)
    args = parser.parse_args()
    build(args.output, args.music)

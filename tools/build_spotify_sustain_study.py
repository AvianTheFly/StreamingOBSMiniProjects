"""Finite, original percussion-free PCM for sustained-spectrum visual QA."""
import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.audio_analysis import AudioAnalysis


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    rate, duration = 44100, 30
    t = np.arange(rate*duration)/rate
    fade = np.minimum(np.minimum(t/1.5, (duration-t)/1.5), 1).clip(0, 1)
    # Smooth pitch curves and continuous phase: no retriggered envelopes, drum
    # transients, sequenced clicks or hidden metronome in this test arrangement.
    frequency = 250+85*np.sin(t*.22)+4*np.sin(t*5.3)
    phase = np.cumsum(frequency)*2*np.pi/rate
    lead = (np.sin(phase)+.28*np.sin(phase*2)+.11*np.sin(phase*3))*.055
    lead *= .68+.32*np.sin(t*.27)**2
    pad = sum(np.sin(2*np.pi*hz*t)*.018 for hz in [110,164.81,220,277.18])
    shimmer_phase = np.cumsum(1400+650*np.sin(t*.18))*2*np.pi/rate
    shimmer = np.sin(shimmer_phase)*(.008+.013*np.sin(t*.31)**2)
    wide = np.sin(2*np.pi*659.25*t)*.027*(.4+.6*np.sin(t*.19)**2)
    pan = np.sin(t*.24)*.65
    left = (pad+lead*(1-pan)+wide+shimmer*.35)*fade
    right = (pad+lead*(1+pan)-wide+shimmer)*fade
    samples = np.column_stack((left, right)).astype(np.float32)
    with wave.open(str(out/'sustained-music.wav'), 'wb') as audio:
        audio.setnchannels(2);audio.setsampwidth(2);audio.setframerate(rate)
        audio.writeframes((samples*32767).astype('<i2').tobytes())
    analyzer, frames = AudioAnalysis(), []
    for i in range(duration*30):
        block = samples[int(i/30*rate):int(i/30*rate)+2048]
        if len(block)<2048:
            block=np.pad(block,((0,2048-len(block)),(0,0)))
        bands, features = analyzer.analyze(block,rate)
        frames.append(dict(bands=bands, **features))
    (out/'sustained-music.json').write_text(json.dumps(frames,separators=(',',':')),encoding='utf-8')
    print(json.dumps(dict(seconds=duration,frames=len(frames),percussion=False,output=str(out))))


if __name__ == '__main__':
    main()

"""Generate original test PCM and analyze it with the production Spotify DSP.
No speaker playback, Spotify control, or OBS/settings changes.
"""
import json
import sys
import wave
from pathlib import Path
import numpy as np

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.service import AudioAnalysis

rate, duration = 22050, 150
t = np.arange(rate*duration)/rate
# Mellow syncopation grows into a brighter electronic passage, then opens
# into sustained chords. This is a DSP fixture, not an imitation of a song.
driving = (t >= 35) & (t < 105)
period = np.where(driving, 60/128, 60/96)
beat = t % period
kick = np.sin(2*np.pi*(55*beat+3.8*(1-np.exp(-beat*18))))*np.exp(-beat*18)
kick *= np.where(driving,.16,.09)
notes = np.array([220,277.18,329.63,415.30,440,329.63,277.18,329.63])
melody = notes[(t/(period*2)).astype(int)%len(notes)]
envelope = np.exp(-(t%(period*2))*1.5)
lead = np.sin(2*np.pi*t*melody)*.055*envelope
lead += np.sin(2*np.pi*t*melody*2)*np.where(driving,.027,.006)*envelope
pad = sum(np.sin(2*np.pi*t*hz)*.012 for hz in [110,164.81,220,277.18])
pad *= .7+.3*np.sin(t*.15)**2
rng = np.random.default_rng(19)
noise = rng.normal(0,1,len(t))
high = noise-np.roll(noise,1)
hat = high*np.exp(-(beat%(period/2))*80)*np.where(driving,.024,.008)
side = np.sin(2*np.pi*t*659.25)*.025*(.3+.7*np.sin(t*.11)**2)
left = kick+lead+pad+hat+side
right = kick+lead+pad+hat-side
samples = np.column_stack((left,right)).astype(np.float32)
samples = np.clip(samples,-.85,.85)
out = root/'output/spotify'
out.mkdir(parents=True,exist_ok=True)
with wave.open(str(out/'audio-study.wav'),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate)
    f.writeframes((samples*32767).astype('<i2').tobytes())
analysis = AudioAnalysis()
frames = []
for index in range(duration*30):
    start = int(index/30*rate)
    block = samples[start:start+2048]
    if len(block)<2048:
        block = np.pad(block,((0,2048-len(block)),(0,0)))
    bands,features = analysis.analyze(block,rate)
    frames.append(dict(bands=[round(v,5) for v in bands],**features))
(out/'audio-study.json').write_text(json.dumps(frames,separators=(',',':')),encoding='utf8')
print(f'Generated {duration}s stereo PCM and {len(frames)} production-analyzed frames')

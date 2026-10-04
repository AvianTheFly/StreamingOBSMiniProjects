"""Original fixed-120-BPM score: sparse, build, dense, then relaxed again."""
import json
import sys
import wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lib.paths import ensure_import_paths
ensure_import_paths()
from spotify.audio_analysis import AudioAnalysis

def main():
    out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
    rate,duration=44100,40
    t=np.arange(rate*duration)/rate
    smooth=lambda u:np.clip(u,0,1)**2*(3-2*np.clip(u,0,1))
    drive=smooth((t-9)/5)*(1-smooth((t-27)/6))
    fade=np.minimum(np.minimum(t/.5,(duration-t)/.5),1).clip(0,1)
    phase=t%.5  # The quarter-note grid never changes: 120 BPM.
    kick=np.sin(2*np.pi*(52*phase+25*(1-np.exp(-phase*18))/18))*np.exp(-phase*23)*(.012+drive*.16)
    pad=sum(np.sin(2*np.pi*f*t)*a for f,a in [(110,.007),(164.81,.005),(220,.005),(277.18,.004)])
    melody=np.sin(2*np.pi*(330*t+6*np.sin(t*.4)))*(.012+drive*.008)
    notes=np.array([440,554.37,659.25,880,659.25,554.37,493.88,659.25])
    arp_hz=notes[(t/.125).astype(int)%len(notes)]
    arp_phase=np.cumsum(arp_hz)*2*np.pi/rate
    arp=(np.sin(arp_phase)+.25*np.sin(arp_phase*2))*np.exp(-(t%.125)*18)*drive*.055
    rng=np.random.default_rng(12120)
    noise=rng.normal(size=len(t));noise=np.tanh(noise)
    hats=noise*np.exp(-(t%.125)*100)*drive*.025
    bass=(np.sin(2*np.pi*55*t)+.18*np.sin(2*np.pi*110*t))*drive*.06
    side=np.sin(2*np.pi*783.99*t)*(.002+drive*.007)
    center=pad+melody+kick+arp+hats+bass
    pcm=np.column_stack((center+side,center-side)).astype(np.float32)*fade[:,None]
    assert np.abs(pcm).max()<1
    with wave.open(str(out/'energy-study.wav'),'wb') as audio:
        audio.setnchannels(2);audio.setsampwidth(2);audio.setframerate(rate)
        audio.writeframes((pcm*32767).astype('<i2').tobytes())
    analyzer=AudioAnalysis();frames=[]
    for i in range(duration*30):
        sec=i/30;offset=int(sec*rate);block=pcm[offset:offset+2048]
        if len(block)<2048:block=np.pad(block,((0,2048-len(block)),(0,0)))
        bands,features=analyzer.analyze(block,rate)
        section='Relaxed' if sec<9 else 'Building' if sec<14 else 'Peak' if sec<27 else 'Releasing' if sec<33 else 'Relaxed'
        frames.append(dict(bands=bands,**features,section=section,bpm=120))
    (out/'energy-study.json').write_text(json.dumps(frames,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'bpm':120,'seconds':duration,'output':str(out)}))
if __name__=='__main__':main()

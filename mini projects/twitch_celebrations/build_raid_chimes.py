"""Deterministic, short original earcons layered over the meme soundtrack."""
from pathlib import Path
import wave
import numpy as np

RATE=24000
SCORES={
 'radar':[(0,880,.10),(.14,1174.66,.13)],
 'reveal':[(0,523.25,.3),(.07,659.25,.3),(.14,783.99,.4)],
 'pop':[(0,196,.12),(0,1046.5,.16)],
 'sparkle':[(0,1318.5,.16),(.08,1568,.16),(.16,2093,.25)],
 'welcome':[(0,783.99,.25),(.12,1046.5,.45)],
}

def render(notes):
 length=max(start+duration for start,freq,duration in notes)+.06
 signal=np.zeros(int(length*RATE))
 for start,freq,duration in notes:
  offset=int(start*RATE);t=np.arange(int(duration*RATE))/RATE
  envelope=np.minimum(1,t/.008)*np.exp(-t*9)*np.minimum(1,(duration-t)/.035)
  tone=(np.sin(2*np.pi*freq*t)+.18*np.sin(2*np.pi*freq*2.01*t))*envelope*.22
  signal[offset:offset+len(tone)]+=tone
 return (np.clip(signal,-.7,.7)*32767).astype('<i2').tobytes()

if __name__=='__main__':
 for name,notes in SCORES.items():
  with wave.open(str(Path(__file__).parent/'media'/('raid-'+name+'.wav')),'wb') as out:
   out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE);out.writeframes(render(notes))
  print(name)

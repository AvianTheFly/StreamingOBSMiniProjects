"""Finite original 120 BPM thank-you sting; no downloaded music or settings edits."""
from pathlib import Path
import wave
import numpy as np


def main():
    rate=44100
    sound=np.zeros(int(4.8*rate), dtype=np.float64)
    rng=np.random.default_rng(813)
    def add(at,duration,frequency,level,noise=False):
        n=int(duration*rate);t=np.arange(n)/rate
        voice=rng.normal(0,.28,n) if noise else np.sin(2*np.pi*frequency*t)+.28*np.sin(4*np.pi*frequency*t)
        envelope=np.minimum(t/.007,1)*np.exp(-t/(duration*.26))*np.minimum((duration-t)/.015,1)
        start=round(at*rate);end=min(len(sound),start+n)
        sound[start:end]+=voice[:end-start]*envelope[:end-start]*level
    # Nine beats, musical handoffs at .75, 1.75, 2.25, 3.25, 3.75 and 4.25.
    melody=[659.25,783.99,880,783.99,1046.5,987.77,880,783.99,1046.5]
    for i,note in enumerate(melody):
        at=.25+i*.5
        add(at,.35,note,.14)
        add(at,.30,[130.81,164.81,196][(i//2)%3],.16)
        add(at+.25,.09,0,.06,True)
        if i%2:add(at,.11,0,.10,True)
    for note in [523.25,659.25,783.99,1046.5]:add(4.25,.55,note,.055)
    # Preserve ample headroom; the existing saved module fader supplies playback volume.
    sound*=min(1,.55/max(abs(sound)))
    sound[-int(.28*rate):]*=np.linspace(1,0,int(.28*rate))
    pcm=(sound*32767).astype('<i2')
    path=Path(__file__).resolve().parents[1]/'mini projects/twitch_celebrations/media/subscriber-thanks.wav'
    with wave.open(str(path),'wb') as out:
        out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate);out.writeframes(pcm.tobytes())
    print(path)


if __name__=='__main__':main()

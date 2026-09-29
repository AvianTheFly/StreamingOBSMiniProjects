"""Rebuild the four original mini-tracks. No samples or third-party recordings.

Run: py -3.11 "mini projects/twitch_celebrations/build_audio.py"
Deterministic synthesis, conservative peak, 18s with an entrance and fade.
"""
from pathlib import Path
import wave
import numpy as np


def track(bpm, root, seed):
    rate = 24000
    length = 18
    output = np.zeros(rate*length)
    rng = np.random.default_rng(seed)
    beat = 60/bpm

    def add(start, duration, voice, gain):
        offset = round(start*rate)
        size = min(round(duration*rate),len(output)-offset)
        if size <= 0: return
        t = np.arange(size)/rate
        envelope = np.minimum(1,t/.006)*np.minimum(1,(duration-t)/.025)
        output[offset:offset+size] += voice(t)*envelope*gain

    notes = [0,7,12,7,4,9,12,16,7,12,19,16,12,9,7,4]
    chords = [0,5,9,7]
    for step in range(int(length/beat*4)):
        start = step*beat/4
        bar = step//16
        chord = chords[bar%4]
        build = .5 if start < 2 else 1
        if step%4 == 0:
            add(start,.24,lambda t: np.sin(2*np.pi*(48*t+8*(1-np.exp(-t*28))))*np.exp(-t*18),.46*build)
            freq = root*2**(chord/12)/2
            add(start,beat*.8,lambda t,f=freq: (np.sin(2*np.pi*f*t)+.25*np.sin(4*np.pi*f*t))*np.exp(-t*6),.22)
        if step%8 == 4:
            add(start,.12,lambda t:rng.uniform(-1,1,len(t))*np.exp(-t*33),.2*build)
        if step%2 == 0 and start>1.5:
            add(start,.045,lambda t:rng.uniform(-1,1,len(t))*np.exp(-t*90),.06)
        if step%2 == 0:
            note = notes[(step//2+seed*2)%len(notes)]+chord
            freq = root*2**(note/12)
            add(start,beat*.42,lambda t,f=freq:(np.sin(2*np.pi*f*t)+.22*np.sin(4*np.pi*f*t)+.1*np.sin(6*np.pi*f*t))*np.exp(-t*11),.13*build)
        if step%16 == 0:
            for semitone in (0,4,7):
                freq=root*2**((chord+semitone)/12)
                add(start,beat*3.8,lambda t,f=freq:np.sin(2*np.pi*f*t)*np.exp(-t*2),.045)
    output *= np.minimum(1,np.arange(len(output))/rate/.08)*np.minimum(1,(length-np.arange(len(output))/rate)/1.1)
    output = output/max(1,np.max(np.abs(output))/.78)
    # A subtle stereo echo makes the short stabs less dry.
    right = output*.88 + np.roll(output,int(beat*.75*rate))*.12
    stereo = np.column_stack((output,right))
    return (np.clip(stereo,-1,1)*32767).astype('<i2').tobytes(),rate


if __name__ == '__main__':
    folder=Path(__file__).parent/'media'
    folder.mkdir(exist_ok=True)
    for i,(name,bpm,root) in enumerate([('crab',128,261.63),('dragon',132,293.66),('cat',120,329.63),('frog',140,349.23)]):
        data,rate=track(bpm,root,i)
        with wave.open(str(folder/(name+'.wav')),'wb') as f:
            f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(data)
        print(name+'.wav')

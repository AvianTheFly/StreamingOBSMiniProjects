"""Finite turtle-only soundtrack: stone, reactive jade resonance and expanding ward."""
from pathlib import Path
import wave
import numpy as np

HITS = (.92, 1.94, 3.62)
# Diagonal pairs touch down after the rig's 270 ms recovery arc, every 210 ms.
# The motion regression checks these against actual support transitions.
FOOTFALLS = tuple(round(1.02 + .27 + n*.21, 2) for n in range(8))

def synthesize(destination, *, variant=0, duration=6.6, rate=48000):
    random = np.random.default_rng(1883+variant*101)
    t = np.arange(round(duration*rate))/rate
    noise = random.normal(0, 1, len(t))
    low = np.convolve(noise, np.ones(150)/150, mode='same')
    mid = np.convolve(noise, np.ones(9)/9, mode='same')
    signal = np.zeros_like(t)
    for at in FOOTFALLS:
        age=np.maximum(0,t-at)
        signal += (t>=at)*np.exp(-age*18)*(np.sin(2*np.pi*62*age)*.045+low*.28)
    for i,at in enumerate(HITS):
        age=np.maximum(0,t-at);active=t>=at
        wind=np.exp(-((t-(at-.20))/.18)**2)
        signal += mid*wind*(.12+i*.04)
        signal += active*(1-np.exp(-age*1600))*np.exp(-age*12)*np.sin(2*np.pi*(79*age-23*age**2))*(.26+i*.10)
        signal += active*(mid*np.exp(-age*45)*.50+noise*np.exp(-age*95)*.035)*(1+i*.28)
        for f,weight in ((293.66,.035),(440,.025),(587.33,.018),(880,.012)):
            signal += active*(1-np.exp(-age*200))*np.exp(-age*7)*np.sin(2*np.pi*f*age)*weight
        for chip in (.07,.15,.23,.31):
            dt=np.maximum(0,t-at-chip)
            signal += (t>=at+chip)*np.exp(-dt*65)*mid*.12
    signal += low*np.exp(-((t-3.78)/.20)**2)*2.6
    signal += mid*np.exp(-((t-3.79)/.26)**2)*.22
    for f in (146.83,220,293.66):
        signal += np.sin(2*np.pi*f*t)*np.exp(-((t-3.48)/.35)**2)*.035
    for at in np.arange(4.4,5.65,.12):
        age=np.maximum(0,t-at)
        signal += (t>=at)*np.exp(-age*24)*np.sin(2*np.pi*(950+random.uniform(0,700))*age)*.01
    signal *= np.minimum(1,t/.05)*np.minimum(1,np.maximum(0,duration-t)/.3)
    signal *= .29/max(.001,np.max(np.abs(signal)))
    stereo=np.column_stack((signal,signal*.91+np.roll(signal,73)*.09))
    with wave.open(str(Path(destination)),'wb') as out:
        out.setnchannels(2);out.setsampwidth(2);out.setframerate(rate)
        out.writeframes((np.clip(stereo,-1,1)*32767).astype('<i2').tobytes())

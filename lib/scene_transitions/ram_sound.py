"""Finite mountain-spirit score; three bounds, proud lift and massive stone break."""
from pathlib import Path
import wave
import numpy as np

LANDINGS = (.68, 1.48, 2.62)
IMPACT = 3.65


def synthesize(destination, *, variant=0, duration=6.6, rate=48000):
    random = np.random.default_rng(3127 + variant * 101)
    t = np.arange(round(duration * rate)) / rate
    noise = random.normal(0, 1, len(t))
    low = np.convolve(noise, np.ones(130) / 130, mode='same')
    mid = np.convolve(noise, np.ones(12) / 12, mode='same')
    signal = np.zeros(len(t))

    def hit(at, strength, frequency):
        age = np.maximum(0, t - at)
        gate = (t >= at) * (1 - np.exp(-age * 1100))
        return gate * strength * (
            np.sin(2*np.pi*(frequency*age - 16*age**2))*np.exp(-age*9)*.45
            + mid*np.exp(-age*60)*1.4 + noise*np.exp(-age*150)*.045)

    for i, at in enumerate(LANDINGS):
        signal += hit(at, .65 + i*.11, 92 - i*8)
        apex = (.38, 1.19, 2.35)[i]
        signal += low*np.exp(-((t-apex)/.22)**2)*.65
        signal += mid*np.exp(-((t-(at-.09))/.09)**2)*.085
    # A restrained original harmonic rise beneath the proud stance.
    pride = np.exp(-((t-3.03)/.28)**2)
    for frequency, strength in ((220,.025),(277.18,.018),(329.63,.016),(440,.009)):
        signal += np.sin(2*np.pi*frequency*t)*pride*strength
    rush = np.exp(-((t-3.48)/.15)**2)
    signal += low*rush*1.5 + mid*rush*.28
    signal += hit(IMPACT, 1.6, 57)
    age = np.maximum(0, t-IMPACT)
    signal += (t >= IMPACT)*np.exp(-age*4.6)*(low*2.4 + mid*.24)
    for at in np.arange(4.28, 5.4, .09):
        age = np.maximum(0, t-at)
        frequency = random.uniform(1050, 3100)
        signal += (t >= at)*np.exp(-age*40)*(np.sin(2*np.pi*frequency*age)*.025 + noise*.012)
    signal *= np.minimum(1,t/.05)*np.minimum(1,np.maximum(0,duration-t)/.30)
    signal *= .29 / max(.001,float(np.max(np.abs(signal))))
    stereo = np.column_stack((signal,signal*.9+np.roll(signal,83)*.1))
    target = Path(destination);target.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(target),'wb') as output:
        output.setnchannels(2);output.setsampwidth(2);output.setframerate(rate)
        output.writeframes((np.clip(stereo,-1,1)*32767).astype('<i2').tobytes())

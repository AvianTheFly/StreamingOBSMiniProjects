"""Deterministic original whooshes/impacts; no downloads or fader changes."""
from pathlib import Path
import json
import wave
import numpy as np


TIMING = json.loads((Path(__file__).parent/'web'/'timing.json').read_text())


def synthesize(spirit, destination, duration=TIMING['duration'], rate=48000, variant=0):
    if spirit == 'ram':
        if __package__:
            from .ram_sound import synthesize as ram_sound
        else:
            from ram_sound import synthesize as ram_sound
        return ram_sound(destination, variant=variant, duration=duration, rate=rate)
    if spirit == 'phoenix':
        if __package__:
            from .phoenix_sound import synthesize as phoenix_sound
        else:
            from phoenix_sound import synthesize as phoenix_sound
        return phoenix_sound(destination, variant=variant, duration=duration, rate=rate)
    if spirit == 'turtle':
        if __package__:
            from .turtle_sound import synthesize as turtle_sound
        else:
            from turtle_sound import synthesize as turtle_sound
        return turtle_sound(destination, variant=variant, duration=duration, rate=rate)
    seed = {'bear': 41, 'turtle': 83, 'ram': 127, 'phoenix': 199}[spirit]
    random = np.random.default_rng(seed+variant*101)
    t = np.arange(round(duration * rate)) / rate
    noise = random.normal(0, 1, len(t))
    # Smooth filtered noise at several scales forms wind, water and fire textures.
    low = np.convolve(noise, np.ones(140) / 140, mode='same')
    mid = np.convolve(noise, np.ones(12) / 12, mode='same')
    impact = np.maximum(0, t - 3.65)
    envelope = (t >= 3.65) * np.exp(-impact * 5)
    attack = np.exp(-((t - 3.45) / .38) ** 2)
    signal = low * attack * 2 + np.sin(2*np.pi*(92*impact-25*impact**2))*envelope*.23
    def body_hit(at, strength, frequency=75):
        age=np.maximum(0,t-at)
        attack=(1-np.exp(-age*900))*(t>=at)
        thump=np.sin(2*np.pi*(frequency*age-18*age**2))*np.exp(-age*9)
        crack=mid*np.exp(-age*65)*1.4+noise*np.exp(-age*160)*.12
        return strength*attack*(thump*.5+crack)
    if spirit == 'bear':
        signal += mid*envelope*.32 + mid*attack*.3
        for hit in (.45, .94, 1.42, 1.94, 2.18, 2.68, 3.18):
            signal += low*np.exp(-((t-hit)/.06)**2)*1.3
        for hit in (2.18,2.68,3.18):
            signal += mid*np.exp(-((t-hit)/.14)**2)*.3
        signal += mid*np.exp(-((t-4.7)/.65)**2)*.15
        for hit,weight in ((2.18,.5),(2.68,.65),(3.18,.9)):
            signal+=body_hit(hit,weight,85)
            signal+=mid*np.exp(-((t-(hit-.06))/.07)**2)*.65
        signal+=mid*np.sin(t*210)*np.exp(-((t-3.65)/.45)**2)*.35
    elif spirit == 'turtle':
        signal+=body_hit(1.94,.32,110)+body_hit(3.62,.4,63)
        for f in (392, 523.25, 784, 1046.5):
            signal += np.sin(2*np.pi*f*t)*np.exp(-((t-2.6)/1.0)**2)*.028
        signal += low*np.exp(-((t-.4)/.16)**2)*.6
        signal += low*np.exp(-((t-1.5)/.3)**2)*1.4
        signal += mid*np.exp(-((t-4.6)/.6)**2)*.17
        for hit in np.arange(4.3,5.6,.11):
            signal += np.sin(2*np.pi*(1200+random.uniform(0,1100))*t)*np.exp(-np.maximum(0,t-hit)*22)*(t>=hit)*.012
    elif spirit == 'ram':
        for hit in (.5,.89,1.28):
            signal+=body_hit(hit,.16,95)
        signal+=body_hit(3.65,1.25,63)
        signal+=body_hit(2.2,.45,82)
        signal+=mid*np.exp(-((t-3.48)/.13)**2)*.65
        signal += noise*envelope*.16 + low*envelope*1.4
        for hit in (4.28, 4.39, 4.49, 4.62, 4.85):
            signal += np.sin(2*np.pi*(2400+random.uniform(0,1900))*t)*np.exp(-np.maximum(0,t-hit)*25)*(t>=hit)*.045
    else:
        signal+=mid*np.exp(-((t-.74)/.24)**2)*.13
        signal+=body_hit(1.12,.4,140)+body_hit(3.16,.75,68)
        signal += mid*np.exp(-((t-3.75)/1.2)**2)*.45
        signal += noise*np.maximum(0,np.sin(t*83))**20*np.exp(-((t-4.7)/1.1)**2)*.04
        signal += low*np.exp(-((t-1.12)/.13)**2)*1.4
    signal *= np.minimum(1,t/.05)*np.minimum(1,np.maximum(0,duration-t)/.3)
    signal *= .29 / max(.001, np.max(np.abs(signal)))  # Conservative peak â‰ˆ -10.8 dBFS.
    # Subtle stereo drift; keep the core impact centered.
    stereo = np.column_stack((signal, signal*.88+np.roll(signal, 91)*.12))
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination), 'wb') as output:
        output.setnchannels(2); output.setsampwidth(2); output.setframerate(rate)
        output.writeframes((np.clip(stereo,-1,1)*32767).astype('<i2').tobytes())


if __name__ == '__main__':
    for spirit in ('bear', 'turtle', 'ram', 'phoenix'):
        for variant in (0,1):
            clip=spirit+('-alt' if variant else '')
            synthesize(spirit, Path(__file__).parent/'web'/'audio'/f'{clip}.wav',variant=variant)

"""Original finite synthesized score. No samples or existing songs are loaded."""
from pathlib import Path
import wave


def compose(destination, seconds, sample_rate=48000):
    # Lazy numerical import keeps importing this artifact module inert.
    import numpy as np
    count = round(seconds * sample_rate)
    signal = np.zeros((count, 2), dtype=np.float32)
    rng = np.random.default_rng(20261002)

    def note(start, length, frequency, gain, pan=0, texture='pad'):
        first = round(start * sample_rate)
        size = min(round(length * sample_rate), count - first)
        if size <= 0:
            return
        t = np.arange(size, dtype=np.float32) / sample_rate
        if texture == 'kick':
            phase = 2 * np.pi * (46 * t + 92 * .032 * (1 - np.exp(-t / .032)))
            sound = np.sin(phase) * np.exp(-t * 17)
        elif texture == 'tick':
            sound = rng.normal(0, .4, size).astype(np.float32) * np.exp(-t * 85)
        else:
            sound = (np.sin(2*np.pi*frequency*t) + .2*np.sin(2*np.pi*frequency*2*t)
                     + .08*np.sin(2*np.pi*frequency*3*t))
            if texture == 'pulse':
                sound *= (1-np.exp(-t*150)) * np.exp(-t*8)
            else:
                sound *= np.minimum(t/.35, 1) * np.minimum((size/sample_rate-t)/.8, 1)
        sound *= gain
        signal[first:first+size, 0] += sound * ((1-pan)/2)**.5
        signal[first:first+size, 1] += sound * ((1+pan)/2)**.5

    def hz(midi):
        return 440 * 2 ** ((midi-69)/12)

    # C minor / A-flat / E-flat / B-flat; harmonic beds move every four seconds.
    chords = [(48, 51, 55), (44, 48, 51), (51, 55, 58), (46, 50, 53)]
    for bar in range(int(seconds/4)+1):
        chord = chords[bar % len(chords)]
        for voice, midi in enumerate(chord):
            note(bar*4, 4.6, hz(midi), .065, [-.55, .15, .6][voice])
    for beat in range(int(seconds*2)):
        moment = beat / 2
        chord = chords[int(moment/4) % len(chords)]
        if beat % 2 == 0:
            note(moment, .4, 0, .2, texture='kick')
            note(moment, .55, hz(chord[0]-12), .13, texture='pulse')
        note(moment+.25, .12, 0, .024, (-.35 if beat % 2 else .35), 'tick')
        if moment >= 6 and moment < seconds-4:
            midi = chord[[0, 2, 1, 2][beat % 4]] + 12
            note(moment, .65, hz(midi), .07, (-.3 if beat % 2 else .3), 'pulse')
    fade_in = np.minimum(np.arange(count, dtype=np.float32)/(sample_rate*.12), 1)
    fade_out = np.minimum((count-1-np.arange(count, dtype=np.float32))/(sample_rate*1.7), 1)
    signal *= (fade_in*fade_out)[:, None]
    peak = float(np.max(np.abs(signal)))
    if peak:
        signal *= .74 / peak
    destination = Path(destination)
    with wave.open(str(destination), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes((signal*32767).astype('<i2').tobytes())
    return {'samples': count, 'sample_rate': sample_rate, 'peak': .74}

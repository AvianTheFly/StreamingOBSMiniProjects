"""Finite phoenix-only frostfire score: feather air, ember hatching, cold storm."""
from pathlib import Path
import wave
import numpy as np


def synthesize(destination, *, variant=0, duration=6.6, rate=48000):
    random = np.random.default_rng(2199 + variant * 101)
    t = np.arange(round(duration * rate)) / rate
    noise = random.normal(0, 1, len(t))
    low = np.convolve(noise, np.ones(155) / 155, mode='same')
    mid = np.convolve(noise, np.ones(11) / 11, mode='same')
    signal = mid * np.exp(-((t - .74) / .24) ** 2) * .10
    for at, strength, frequency in ((1.12, .40, 130), (3.16, .78, 68)):
        age = np.maximum(0, t - at)
        attack = (t >= at) * (1 - np.exp(-age * 1000))
        signal += attack * np.exp(-age * 10) * np.sin(2 * np.pi * (frequency * age - 19 * age ** 2)) * strength
        signal += attack * (mid * np.exp(-age * 52) * .65 + noise * np.exp(-age * 140) * .035)
    for at in (1.46, 1.82, 2.23, 2.87):
        signal += low * np.exp(-((t - at) / .12) ** 2) * .65
    storm = np.exp(-((t - 3.85) / 1.08) ** 2)
    signal += low * storm * 2.0 + mid * storm * .20
    for i, at in enumerate(np.arange(3.06, 5.62, .105)):
        age = np.maximum(0, t - at)
        signal += (t >= at) * np.exp(-age * 38) * np.sin(2 * np.pi * (1150 + random.uniform(0, 1500)) * age) * .012
        signal += (t >= at) * np.exp(-age * 80) * noise * .009
    signal *= np.minimum(1, t / .05) * np.minimum(1, np.maximum(0, duration - t) / .30)
    signal *= .29 / max(.001, np.max(np.abs(signal)))
    stereo = np.column_stack((signal, signal * .90 + np.roll(signal, 83) * .10))
    target = Path(destination)
    target.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(target), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes((np.clip(stereo, -1, 1) * 32767).astype('<i2').tobytes())

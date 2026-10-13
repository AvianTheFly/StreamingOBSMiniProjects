"""Visual-only input reference; never changes Spotify or an output fader.

Application loopback has already applied Spotify's playback gain. A held RMS
reference removes a constant gain from the whole signal, before nonlinear DSP.
Its long release preserves musical dips instead of normalizing every packet.
It cannot distinguish a sustained quieter passage from a lowered app fader;
both readjust gradually. Silence freezes the reference and remains silence.
"""
import math

import numpy as np


class AudioLevel:
    TARGET_RMS = .12
    RELEASE_SECONDS = 30.
    MAX_GAIN = 10000.
    SILENCE_RMS = 1e-6

    def __init__(self):
        self.reference = 0.

    def apply(self, samples, rate=44100):
        if not samples.size:
            return samples
        rms = float(np.sqrt(np.mean(samples * samples)))
        if not math.isfinite(rms) or rms <= self.SILENCE_RMS:
            return np.zeros_like(samples)
        elapsed = len(samples) / rate
        self.reference = max(rms, self.reference * math.exp(-elapsed / self.RELEASE_SECONDS))
        gain = min(self.MAX_GAIN, self.TARGET_RMS / self.reference)
        return samples * gain

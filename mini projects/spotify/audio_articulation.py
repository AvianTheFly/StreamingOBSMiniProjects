"""Bounded timbre descriptors from the existing stereo magnitude transform.

These describe held partials and attacks, not isolated singers or instruments.
All amplitudes use fixed gain; a quiet phrase cannot normalize back to loud.
"""
import numpy as np


class AudioArticulation:
    def __init__(self):
        self.envelope = None
        self.rate = None

    def reset(self):
        self.envelope = None

    def measure(self, magnitude, hz, size, rate, hop_seconds):
        # Smooth the Hann peak over adjacent bins before measuring its contrast
        # against a wider neighborhood. Random single-bin peaks are suppressed.
        smooth = np.convolve(magnitude, [.25, .5, .25], mode='same')
        baseline = np.convolve(smooth, np.ones(15)/15, mode='same')
        tonal = np.clip((smooth/np.maximum(baseline, 1e-12)-1.4)/1.6, 0, 1)
        if self.envelope is None or self.envelope.shape != smooth.shape or self.rate != rate:
            self.envelope = np.zeros_like(smooth)
            self.rate = rate
        held = np.minimum(smooth, self.envelope)
        # Packet duration comes from the capture owner; batching must not change
        # this short causal envelope into a slower instrument.
        fresh = np.maximum(0, smooth-self.envelope*(1.5-.35*tonal))
        self.envelope += (smooth-self.envelope)*(1-np.exp(-np.clip(hop_seconds, .001, 1)*20))
        mid = (hz >= 180) & (hz <= 2500)
        high = (hz >= 3500) & (hz <= 14000)
        audible = (hz >= 40) & (hz <= 14000)
        power = (held*tonal)**2
        gain = np.sqrt(16/3)/max(1, size)*2
        lead = np.sqrt(np.sum(power[mid]))*gain
        weight = np.sum(power[mid])
        pitch = np.sum(power[mid]*np.log2(np.maximum(180, hz[mid])/180))/max(weight, 1e-12)/np.log2(2500/180)
        return dict(lead_level=float(np.clip(lead, 0, 1)),
                    lead_pitch=float(np.clip(pitch, 0, 1)),
                    attack_level=float(np.clip(np.linalg.norm(fresh[audible])*gain, 0, 1)),
                    air_level=float(np.clip(np.linalg.norm(held[high])*gain, 0, 1)))

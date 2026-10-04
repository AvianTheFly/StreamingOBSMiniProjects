"""Bounded spectral roughness proxy from the existing audio transform.

Closely spaced salient partials create sensory beating. This is a visual timbre
descriptor, not a calibrated psychoacoustic roughness or emotion classifier.
"""
import numpy as np


def spectral_roughness(magnitude, frequencies):
    candidates = np.flatnonzero((magnitude[1:-1] > magnitude[:-2]) &
                                (magnitude[1:-1] >= magnitude[2:])) + 1
    candidates = candidates[(frequencies[candidates] >= 80) &
                            (frequencies[candidates] <= 10000)]
    if not candidates.size:
        return 0., 0.
    peak = magnitude[candidates]
    candidates = candidates[peak >= max(float(peak.max()) * .035, 1e-9)]
    if candidates.size > 24:
        candidates = candidates[np.argsort(magnitude[candidates])[-24:]]
    if candidates.size < 2:
        return 0., 0.
    f = frequencies[candidates]
    amplitude = magnitude[candidates] / max(float(magnitude[candidates].max()), 1e-9)
    distance = np.abs(f[:, None] - f[None, :])
    # Plomp/Levelt-style critical-band interaction, as used in sensory
    # dissonance descriptors. Widely separated peaks do not create this signal.
    scaled = distance * .24 / (.0207 * np.minimum(f[:, None], f[None, :]) + 18.96)
    curve = np.maximum(0., np.exp(-3.5 * scaled) - np.exp(-5.75 * scaled)) / .18
    weights = np.triu(curve * amplitude[:, None] * amplitude[None, :], 1)
    amount = float(np.clip(weights.sum() * 1.8 / max(float(np.sum(amplitude**2)), 1e-9), 0, 1))
    rate = float(np.sum(weights * distance) / max(float(weights.sum()), 1e-9))
    return amount, float(np.clip(rate, 20, 160)) if amount > .025 else 0.

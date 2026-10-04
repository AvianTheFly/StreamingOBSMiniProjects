"""Offline soundtrack analysis and original effects; never changes source audio."""
from pathlib import Path
import json
import math
import wave

import numpy as np
from scipy import signal


def analyze(wav_path, duration):
    """Estimate a regular beat grid from spectral attacks in the supplied excerpt."""
    with wave.open(str(wav_path), 'rb') as f:
        sr = f.getframerate()
        channels = f.getnchannels()
        data = np.frombuffer(f.readframes(f.getnframes()), '<i2').astype(np.float32) / 32768
    mono = data.reshape(-1, channels).mean(axis=1)
    reduced = signal.resample_poly(mono, 1, 3)
    rate = sr / 3
    hop = 160
    freq, times, spectrum = signal.stft(reduced, rate, nperseg=1024, noverlap=1024-hop)
    magnitude = np.abs(spectrum)
    log_mag = np.log1p(magnitude * 300)
    flux = np.maximum(np.diff(log_mag, axis=1, prepend=log_mag[:, :1]), 0)
    low = flux[(freq >= 35) & (freq < 220)].mean(axis=0)
    high = flux[(freq >= 220) & (freq < 6000)].mean(axis=0)
    onset = low / (np.percentile(low, 95)+1e-6) + .5*high/(np.percentile(high, 95)+1e-6)
    onset = np.maximum(onset - signal.medfilt(onset, 31)*.65, 0)
    # A regular remix grid is fit against actual low-frequency attacks, not its filename.
    candidates = []
    for bpm in np.arange(105, 151, .1):
        period = 60/bpm
        for phase in np.arange(0, period, .01):
            beats = np.arange(phase, duration, period)
            values = np.interp(beats, times, onset)
            candidates.append((float(values.mean()), float(bpm), float(phase)))
    score, bpm, phase = max(candidates)
    beats = np.arange(phase, duration, 60/bpm)
    peaks, props = signal.find_peaks(onset, distance=int(.18*rate/hop), prominence=.2)
    attacks = [float(t) for t in times[peaks] if t < duration]
    envelope_times = np.arange(0, duration, 1/60)
    response = np.interp(envelope_times, times, onset)
    response = np.clip(response / (np.percentile(response, 94)+1e-6), 0, 1)
    return dict(bpm=round(bpm, 2), phase_seconds=round(phase, 3),
                beats=[round(float(t), 4) for t in beats],
                detected_attacks=attacks, response=response.tolist(),
                fit_score=score, method='Spectral-attack fit to supplied first 40 seconds; approximate grid')


def write_wav(path, stereo, sr=48000):
    peak = float(np.max(np.abs(stereo)))
    if peak > .91:
        stereo *= .91 / peak
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes((stereo * 32767).astype('<i2').tobytes())


def compose_effects(path, duration, impacts, transitions):
    """Original synthetic thunder, elemental impacts, and stereo passing whooshes."""
    sr = 48000
    output = np.zeros((round(duration*sr), 2), np.float32)
    rng = np.random.default_rng(71325)

    def add(at, sound, gain, pan=0):
        first = round(at*sr)
        if first < 0:
            sound = sound[-first:]
            first = 0
        length = min(len(sound), len(output)-first)
        if length <= 0:
            return
        output[first:first+length, 0] += sound[:length]*gain*math.sqrt((1-pan)/2)
        output[first:first+length, 1] += sound[:length]*gain*math.sqrt((1+pan)/2)

    for index, at in enumerate(impacts):
        t = np.arange(round(sr*1.5))/sr
        noise = rng.normal(0, 1, len(t)).astype(np.float32)
        rumble = signal.sosfilt(signal.butter(2, 170, fs=sr, output='sos'), noise)
        sub = np.sin(2*np.pi*(34*t + 38*.047*(1-np.exp(-t/.047))))
        impact = (sub*np.exp(-t*4.7) + rumble*2*np.exp(-t*2.6) + noise*.14*np.exp(-t*24))
        impact *= np.minimum(t/.004, 1)
        add(at, impact, .30 if index else .2)
    for index, at in enumerate(transitions):
        t = np.arange(round(sr*.42))/sr
        noise = rng.normal(0, 1, len(t)).astype(np.float32)
        air = signal.sosfilt(signal.butter(2, [550, 7000], btype='bandpass', fs=sr, output='sos'), noise)
        env = np.sin(np.pi*t/.42)**2
        add(at-.28, air*env, .075, -.45 if index%2 else .45)
    write_wav(path, output)
    return dict(origin='Original procedural effects, no sampled music', sample_rate=sr,
                duration=duration, impacts=impacts, transitions=transitions)

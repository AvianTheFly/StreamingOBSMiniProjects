"""Spotify measurements; one batched stereo FFT and bounded immutable plans."""
from functools import lru_cache

import numpy as np
from .audio_texture import spectral_roughness


def quiet_features():
    return dict(waveform=[0.] * 128, bass=0., treble=0., energy=0., beat=0.,
                pitch=0., tonality=0., width=0., balance=0., flux=0.,
                voice_widths=[0.] * 8, voice_balances=[0.] * 8, voice_levels=[0.] * 8,
                roughness=0., noisiness=0., texture_rate=0., loudness=0.)


@lru_cache(maxsize=8)
def _spectral_plan(size, rate):
    window = np.hanning(size)
    frequencies = np.fft.rfftfreq(size, 1 / rate)
    edges = np.geomspace(40, min(16000, rate / 2), 49)
    bounds = np.searchsorted(frequencies, edges, side='left')
    slices = tuple(slice(int(low), int(high)) for low, high in zip(bounds[:-1], bounds[1:]))
    audible = (frequencies >= 40) & (frequencies <= min(16000, rate / 2))
    for values in (window, frequencies, audible, bounds):
        values.flags.writeable = False
    return window, frequencies, slices, audible, bounds


def _bands(magnitude, mono, bounds):
    fft = magnitude / max(1, len(mono))
    if bounds[-1] == len(fft):
        fft = np.append(fft, 0.)  # Odd-sized reference windows end past the last bin.
    # Cached bin edges permit one reduction instead of 48 tiny NumPy calls.
    # Repeated edges denote empty low-frequency bins, which stay exactly zero.
    levels = np.maximum.reduceat(fft, bounds)[:-1]
    levels = np.where(bounds[1:] > bounds[:-1], levels, 0.)
    # Fixed 60-dB display range: a louder kick must not turn down unchanged
    # upper harmonics. Quiet sustained partials retain useful resolution.
    return np.clip((20*np.log10(np.maximum(levels, 1e-12))+75)/60, 0, 1).tolist()


def spectrum(samples, rate):
    mono = samples.mean(axis=1)
    window, _, _, _, bounds = _spectral_plan(len(mono), rate)
    transform = np.fft.rfft(samples * window[:, None], axis=0)
    magnitude = np.sqrt(np.mean(np.abs(transform)**2, axis=1))
    return _bands(magnitude, mono, bounds)


@lru_cache(maxsize=8)
def _display_plan(size, rate):
    """Immutable frequency selections and waveform coordinates, shared by packets."""
    edges = np.geomspace(40, min(16000, rate / 2), 49)[:-1]
    mid = np.flatnonzero((edges >= 350) & (edges < 2500))
    high = np.flatnonzero(edges >= 2500)
    positions = np.linspace(0, size - 1, 128)
    samples = np.arange(size)
    for values in (mid, high, positions, samples):
        values.flags.writeable = False
    return mid, high, positions, samples


def _voice_power(transform, size, rate, first, last):
    """Reduce contiguous registers together instead of issuing per-voice kernels."""
    left = transform[:, 0]
    right = transform[:, min(1, transform.shape[1] - 1)]
    energy = np.column_stack((np.abs(left)**2, np.abs(right)**2,
                              np.abs((left-right)*.5)**2))
    bounds = _spectral_plan(size, rate)[4][first*6:last*6+1:6]
    # A final edge may be just past the transform on odd-sized input windows.
    energy = np.vstack((energy, np.zeros((1, 3))))
    totals = np.add.reduceat(energy, bounds, axis=0)[:-1]
    totals[bounds[1:] == bounds[:-1]] = 0
    return totals


class AudioAnalysis:
    def __init__(self):
        self.bass_average = .02
        self.beat = 0.
        self.previous_spectrum = np.zeros(48)

    def analyze(self, samples, rate=44100, *, realtime=False):
        if realtime:
            samples = samples[-2048:]
        mono = samples.mean(axis=1)
        # Only loudness/waveform need a short aperture. Bass keeps its full
        # window for low-frequency discrimination; no prediction is involved.
        recent = samples[-256:] if realtime else samples
        rms = float(np.sqrt(np.mean(recent * recent)))
        full_rms = float(np.sqrt(np.mean(samples * samples)))
        if float(np.sqrt(np.mean(mono * mono))) < rms*.15:
            mono = samples[:, int(np.argmax(np.mean(samples*samples, axis=0)))]
        if rms < .0001:
            self.beat *= .7
            self.previous_spectrum.fill(0)
            return [0.] * 48, quiet_features()
        window, hz, slices, audible, bounds = _spectral_plan(len(mono), rate)
        # One batched FFT retains opposed stereo layers even when a centered
        # bass is present. Averaging channels before the FFT erased those layers.
        transform = np.fft.rfft(samples * window[:, None], axis=0)
        magnitude = np.sqrt(np.mean(np.abs(transform)**2, axis=1))
        bands = _bands(magnitude, mono, bounds)
        transforms = {len(samples): transform}
        if realtime and len(samples) >= 2048:
            # Frequency-dependent apertures: 46 ms bass, 23 ms mids, 12 ms
            # highs. Equal normalization keeps the absolute dB range intact.
            mid, high, _, _ = _display_plan(512, rate)
            for size, indices in ((1024, mid), (512, high)):
                short_window, _, _, _, short_bounds = _spectral_plan(size, rate)
                short = np.fft.rfft(samples[-size:] * short_window[:, None], axis=0)
                transforms[size] = short
                levels = _bands(np.sqrt(np.mean(np.abs(short)**2, axis=1)), samples[-size:, 0], short_bounds)
                for i in indices:
                    bands[i] = levels[i]
        energy = float(1-np.exp(-rms*14))
        bass = float(np.mean(bands[:15]))
        treble = float(np.mean(bands[32:]))
        onset = max(0., bass-self.bass_average*1.18)
        self.beat = max(self.beat*.74, min(1., onset*5))
        self.bass_average += (bass-self.bass_average)*.055
        wave_source = mono[-512:] if realtime else mono
        _, _, positions, sample_indices = _display_plan(len(wave_source), rate)
        wave = np.interp(positions, sample_indices, wave_source)
        # Fixed display gain preserves a quiet passage's smaller waveform.
        # Per-packet RMS normalization exaggerated low-level material and
        # concealed the difference between a held sound and a release.
        wave = np.tanh(wave * 7.5)
        power = magnitude[audible] ** 2
        frequencies = hz[audible]
        dominant = float(frequencies[np.argmax(power)]) if power.size else 40.
        # Dominant spectral pitch; arbitrary music need not have one fundamental.
        pitch = float(np.clip(np.log(dominant/40)/np.log(16000/40), 0, 1))
        flatness = float(np.exp(np.mean(np.log(power+1e-12))) / (np.mean(power)+1e-12))
        tonality = float(np.clip(1-flatness**.3, 0, 1))
        roughness, texture_rate = spectral_roughness(magnitude, hz)
        spatial = samples[-512:] if realtime else samples
        stereo = spatial if spatial.shape[1] >= 2 else np.repeat(spatial, 2, axis=1)
        side = (stereo[:, 0]-stereo[:, 1])*.5
        width = float(np.clip(np.sqrt(np.mean(side*side)) / max(rms, .001), 0, 1))
        left, right = np.sqrt(np.mean(stereo[:, :2]**2, axis=0))
        balance = float((right-left)/(right+left+1e-9))
        groups = ((2048, 0, 3), (1024, 3, 6), (512, 6, 8)) if realtime and len(samples) >= 2048 else ((len(samples), 0, 8),)
        powers = np.concatenate([_voice_power(transforms[size], size, rate, first, last)
                                 for size, first, last in groups])
        sizes = np.concatenate([np.full(last-first, size) for size, first, last in groups])
        lp, rp, side_power = powers.T
        average = (lp+rp)*.5
        # The same Hann-compensated Parseval power and fixed gain for all voices.
        voice_levels = np.clip(np.sqrt(average)*np.sqrt(16/3)/sizes*2, 0, 1).tolist()
        voice_widths = np.clip(np.sqrt(side_power/np.maximum(average, 1e-12)), 0, 1).tolist()
        left_power, right_power = np.sqrt(lp), np.sqrt(rp)
        voice_balances = ((right_power-left_power)/(right_power+left_power+1e-9)).tolist()
        flux = float(np.clip(np.maximum(0, np.array(bands)-self.previous_spectrum).mean()*5, 0, 1))
        self.previous_spectrum = np.array(bands)
        return bands, dict(waveform=wave.tolist(), bass=bass, treble=treble, energy=energy, beat=self.beat,
                           pitch=pitch, tonality=tonality, width=width, balance=balance, flux=flux,
                           voice_widths=voice_widths, voice_balances=voice_balances, voice_levels=voice_levels,
                           roughness=roughness, noisiness=1-tonality, texture_rate=texture_rate,
                           # Fixed headroom, no short-term AGC or saturated
                           # exponential: mastered breaks can stay quieter.
                           loudness=float(np.clip(full_rms*2, 0, 1)))

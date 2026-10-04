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
            for size, low, high in ((1024, 350, 2500), (512, 2500, float('inf'))):
                short_window, _, _, _, short_bounds = _spectral_plan(size, rate)
                short = np.fft.rfft(samples[-size:] * short_window[:, None], axis=0)
                transforms[size] = short
                levels = _bands(np.sqrt(np.mean(np.abs(short)**2, axis=1)), samples[-size:, 0], short_bounds)
                edges = np.geomspace(40, min(16000, rate/2), 49)
                for i, frequency in enumerate(edges[:-1]):
                    if low <= frequency < high:
                        bands[i] = levels[i]
        energy = float(1-np.exp(-rms*14))
        bass = float(np.mean(bands[:15]))
        treble = float(np.mean(bands[32:]))
        onset = max(0., bass-self.bass_average*1.18)
        self.beat = max(self.beat*.74, min(1., onset*5))
        self.bass_average += (bass-self.bass_average)*.055
        wave_source = mono[-512:] if realtime else mono
        wave = np.interp(np.linspace(0, len(wave_source)-1, 128), np.arange(len(wave_source)), wave_source)
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
        voice_widths, voice_balances, voice_levels = [], [], []
        for voice in range(8):
            size = (2048 if voice < 3 else 1024 if voice < 6 else 512) if realtime and len(samples) >= 2048 else len(samples)
            spatial_fft = transforms[size]
            left_fft, right_fft = spatial_fft[:, 0], spatial_fft[:, min(1, spatial_fft.shape[1]-1)]
            voice_slices = _spectral_plan(size, rate)[2]
            section = slice(voice_slices[voice*6].start, voice_slices[voice*6+5].stop)
            l, r = left_fft[section], right_fft[section]
            lp, rp = float(np.sum(np.abs(l)**2)), float(np.sum(np.abs(r)**2))
            side_power = float(np.sum(np.abs((l-r)*.5)**2))
            # Parseval energy with Hann power compensation. Unlike logarithmic
            # display bars, this fixed-gain register level preserves dynamics.
            voice_levels.append(float(np.clip(np.sqrt((lp+rp)*.5)*np.sqrt(16/3)/size*2, 0, 1)))
            voice_widths.append(float(np.clip(np.sqrt(side_power/max((lp+rp)*.5, 1e-12)), 0, 1)))
            voice_balances.append(float((np.sqrt(rp)-np.sqrt(lp))/(np.sqrt(rp)+np.sqrt(lp)+1e-9)))
        flux = float(np.clip(np.maximum(0, np.array(bands)-self.previous_spectrum).mean()*5, 0, 1))
        self.previous_spectrum = np.array(bands)
        return bands, dict(waveform=wave.tolist(), bass=bass, treble=treble, energy=energy, beat=self.beat,
                           pitch=pitch, tonality=tonality, width=width, balance=balance, flux=flux,
                           voice_widths=voice_widths, voice_balances=voice_balances, voice_levels=voice_levels,
                           roughness=roughness, noisiness=1-tonality, texture_rate=texture_rate,
                           # Fixed headroom, no short-term AGC or saturated
                           # exponential: mastered breaks can stay quieter.
                           loudness=float(np.clip(full_rms*2, 0, 1)))

# specific_song/bass_detector.py
#
# Audio feature extraction for the OBS visualizer.
#
# Exposes:
#   • get_level()      -> bass/sub envelope for scale and weight
#   • get_motion()     -> low-mid groove envelope for broad drift
#   • get_intensity()  -> wide-band envelope for section energy
#   • get_melody()     -> upper-mid melodic envelope for sway / tilt phrasing
#   • consume_beat()   -> one-shot onset flag for kick accents

from __future__ import annotations

import threading
import time

import numpy as np
import sounddevice as sd


class BassDetector:
    def __init__(
        self,
        device_index: int,
        sample_rate: int = 44100,
        block_size: int = 1024,
        bass_low_hz: float = 60.0,
        bass_high_hz: float = 180.0,
        smoothing: float = 0.75,
        peak_decay: float = 0.60,
        onset_ratio: float = 1.35,
        onset_min_level: float = 0.15,
        onset_cooldown: float = 0.12,
    ) -> None:
        self.device_index = device_index
        self.sample_rate = sample_rate
        self.block_size = block_size
        self.bass_low_hz = bass_low_hz
        self.bass_high_hz = bass_high_hz
        self.smoothing = smoothing
        self.peak_decay = peak_decay
        self.onset_ratio = onset_ratio
        self.onset_min_level = onset_min_level
        self.onset_cooldown = onset_cooldown

        self._lock = threading.Lock()
        self._level = 0.0
        self._motion = 0.0
        self._intensity = 0.0
        self._melody = 0.0
        self._peak_bass = 1e-6
        self._peak_motion = 1e-6
        self._peak_wide = 1e-6
        self._peak_melody = 1e-6
        self._last_peak_t = time.monotonic()
        self._prev_bass_energy = 0.0
        self._beat_pending = False
        self._last_beat_t = 0.0
        self._stream = None
        self._running = False

        freqs = np.fft.rfftfreq(block_size, d=1.0 / sample_rate)
        self._bass_mask = (freqs >= bass_low_hz) & (freqs <= bass_high_hz)
        self._motion_mask = (freqs >= 140.0) & (freqs <= 1200.0)
        self._wide_mask = (freqs >= 60.0) & (freqs <= 5000.0)
        self._melody_mask = (freqs >= 300.0) & (freqs <= 2800.0)

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._stream = sd.InputStream(
            device=self.device_index,
            channels=1,
            samplerate=self.sample_rate,
            blocksize=self.block_size,
            dtype="float32",
            callback=self._audio_callback,
        )
        self._stream.start()

    def stop(self) -> None:
        self._running = False
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None

    def get_level(self) -> float:
        with self._lock:
            return self._level

    def get_motion(self) -> float:
        with self._lock:
            return self._motion

    def get_intensity(self) -> float:
        with self._lock:
            return self._intensity

    def get_melody(self) -> float:
        with self._lock:
            return self._melody

    def consume_beat(self) -> bool:
        with self._lock:
            if self._beat_pending:
                self._beat_pending = False
                return True
            return False

    def _band_rms(self, spectrum: np.ndarray, mask: np.ndarray) -> float:
        if not np.any(mask):
            return 0.0
        return float(np.sqrt(np.mean(spectrum[mask] ** 2)) + 1e-9)

    def _smooth_envelope(self, current: float, raw: float, attack: float, release: float) -> float:
        coef = attack if raw > current else release
        return coef * current + (1.0 - coef) * raw

    def _audio_callback(self, indata, frames, time_info, status) -> None:
        mono = indata[:, 0]
        if mono.size == 0:
            return

        windowed = mono * np.hanning(len(mono))
        spectrum = np.abs(np.fft.rfft(windowed))

        bass_energy = self._band_rms(spectrum, self._bass_mask)
        motion_energy = self._band_rms(spectrum, self._motion_mask)
        wide_energy = self._band_rms(spectrum, self._wide_mask)
        melody_energy = self._band_rms(spectrum, self._melody_mask)
        now = time.monotonic()

        with self._lock:
            dt = now - self._last_peak_t
            self._last_peak_t = now

            decay = max(0.0, 1.0 - self.peak_decay * dt)
            self._peak_bass = max(self._peak_bass * decay, bass_energy)
            self._peak_motion = max(self._peak_motion * (1.0 - max(self.peak_decay * 0.80, 0.05) * dt), motion_energy)
            self._peak_wide = max(self._peak_wide * (1.0 - max(self.peak_decay * 0.45, 0.03) * dt), wide_energy)
            self._peak_melody = max(self._peak_melody * (1.0 - max(self.peak_decay * 0.55, 0.04) * dt), melody_energy)

            raw_bass = min(bass_energy / max(self._peak_bass, 1e-9), 1.0)
            raw_motion = min(motion_energy / max(self._peak_motion, 1e-9), 1.0)
            raw_wide = min(wide_energy / max(self._peak_wide, 1e-9), 1.0)
            raw_melody = min(melody_energy / max(self._peak_melody, 1e-9), 1.0)

            bass_attack = min(max(self.smoothing - 0.34, 0.05), 0.70)
            bass_release = min(max(self.smoothing - 0.10, 0.22), 0.90)
            motion_attack = min(max(self.smoothing - 0.08, 0.18), 0.84)
            motion_release = min(max(self.smoothing + 0.06, 0.40), 0.94)
            intensity_attack = min(max(self.smoothing + 0.02, 0.28), 0.90)
            intensity_release = min(max(self.smoothing + 0.14, 0.55), 0.97)
            melody_attack = min(max(self.smoothing - 0.12, 0.14), 0.82)
            melody_release = min(max(self.smoothing + 0.02, 0.36), 0.93)

            self._level = self._smooth_envelope(self._level, raw_bass, bass_attack, bass_release)
            self._motion = self._smooth_envelope(self._motion, raw_motion, motion_attack, motion_release)
            self._intensity = self._smooth_envelope(self._intensity, raw_wide, intensity_attack, intensity_release)
            self._melody = self._smooth_envelope(self._melody, raw_melody, melody_attack, melody_release)

            flux_ratio = bass_energy / max(self._prev_bass_energy, 1e-9)
            since_last_beat = now - self._last_beat_t
            if (
                flux_ratio >= self.onset_ratio
                and raw_bass >= self.onset_min_level
                and since_last_beat >= self.onset_cooldown
            ):
                self._beat_pending = True
                self._last_beat_t = now

            self._prev_bass_energy = bass_energy

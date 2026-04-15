# specific_song/bass_detector.py
#
# Audio feature extraction for the OBS visualizer.
#
# Key design choices vs original:
#   • Absolute noise floor (NOISE_FLOOR_RMS) — below this the signal is
#     treated as silence and all envelopes collapse toward 0.  This prevents
#     background hiss / VB-Cable static from inflating the normalized levels.
#   • Peak normaliser still adapts, but a hard minimum prevents near-silence
#     from appearing as full-scale signal.
#   • Beat / onset detection uses a short-term vs long-term energy ratio
#     (spectral flux gate) rather than just comparing successive frames.
#     This makes it much more robust to gradual volume changes.
#   • "Oomph" channel: sub-bass only (20–80 Hz) onset with its own cooldown,
#     exposed via consume_oomph().  Used by BassAnimator for the big hit.
#
# Exposes:
#   • get_level()      -> bass/sub envelope  [0–1]
#   • get_motion()     -> low-mid groove envelope [0–1]
#   • get_intensity()  -> wide-band section energy [0–1]
#   • get_melody()     -> upper-mid melodic envelope [0–1]
#   • consume_beat()   -> one-shot kick onset flag
#   • consume_oomph()  -> one-shot HARD sub-bass hit flag (big visual pop)

from __future__ import annotations

import threading
import time
from collections import deque

import numpy as np
import sounddevice as sd

# Absolute RMS threshold below which input is considered silence.
# Adjust if your VB-Cable idle noise floor is higher (try 0.002–0.005).
_NOISE_FLOOR_RMS: float = 0.003

# Short-term / long-term energy ratio for onset detection.
# A value of 1.5 means "current frame is 50% louder than recent average".
_ONSET_LT_FRAMES: int   = 20    # frames in the long-term window (~470 ms @ 1024/44100)
_OOMPH_RATIO:     float = 2.20  # sub-bass must be this × louder than recent avg
_OOMPH_MIN_RMS:   float = 0.015 # absolute minimum RMS before oomph can fire


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
        self.device_index    = device_index
        self.sample_rate     = sample_rate
        self.block_size      = block_size
        self.bass_low_hz     = bass_low_hz
        self.bass_high_hz    = bass_high_hz
        self.smoothing       = smoothing
        self.peak_decay      = peak_decay
        self.onset_ratio     = onset_ratio
        self.onset_min_level = onset_min_level
        self.onset_cooldown  = onset_cooldown

        self._lock             = threading.Lock()
        self._level            = 0.0
        self._motion           = 0.0
        self._intensity        = 0.0
        self._melody           = 0.0
        self._peak_bass        = 1e-6
        self._peak_motion      = 1e-6
        self._peak_wide        = 1e-6
        self._peak_melody      = 1e-6
        self._peak_sub         = 1e-6
        self._last_peak_t      = time.monotonic()
        self._prev_bass_energy = 0.0
        self._beat_pending     = False
        self._oomph_pending    = False
        self._last_beat_t      = 0.0
        self._last_oomph_t     = 0.0
        self._stream           = None
        self._running          = False

        # Long-term energy buffers for ratio-based onset detection
        self._lt_bass_buf: deque[float] = deque(maxlen=_ONSET_LT_FRAMES)
        self._lt_sub_buf:  deque[float] = deque(maxlen=_ONSET_LT_FRAMES)

        freqs = np.fft.rfftfreq(block_size, d=1.0 / sample_rate)
        self._sub_mask    = (freqs >= 20.0)  & (freqs <= 80.0)   # pure kick thud
        self._bass_mask   = (freqs >= bass_low_hz) & (freqs <= bass_high_hz)
        self._motion_mask = (freqs >= 140.0) & (freqs <= 1200.0)
        self._wide_mask   = (freqs >= 60.0)  & (freqs <= 5000.0)
        self._melody_mask = (freqs >= 300.0) & (freqs <= 2800.0)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

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

    # ── Getters ───────────────────────────────────────────────────────────────

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

    def consume_oomph(self) -> bool:
        """
        One-shot flag: True when a clearly audible sub-bass hit is detected.
        Much stricter than consume_beat() — only fires on real kick/drop moments.
        """
        with self._lock:
            if self._oomph_pending:
                self._oomph_pending = False
                return True
            return False

    # ── DSP ───────────────────────────────────────────────────────────────────

    @staticmethod
    def _band_rms(spectrum: np.ndarray, mask: np.ndarray) -> float:
        if not np.any(mask):
            return 0.0
        return float(np.sqrt(np.mean(spectrum[mask] ** 2)) + 1e-9)

    @staticmethod
    def _smooth_envelope(current: float, raw: float, attack: float, release: float) -> float:
        coef = attack if raw > current else release
        return coef * current + (1.0 - coef) * raw

    def _audio_callback(self, indata, frames, time_info, status) -> None:
        mono = indata[:, 0]
        if mono.size == 0:
            return

        # ── Silence gate ─────────────────────────────────────────────────────
        # If the overall RMS is below the noise floor, treat as silence.
        # This kills VB-Cable idle hiss from inflating envelopes.
        frame_rms = float(np.sqrt(np.mean(mono ** 2)))
        if frame_rms < _NOISE_FLOOR_RMS:
            with self._lock:
                rel = min(max(self.smoothing + 0.14, 0.55), 0.97)
                self._level     = self._smooth_envelope(self._level,     0.0, 0.0, rel)
                self._motion    = self._smooth_envelope(self._motion,    0.0, 0.0, rel)
                self._intensity = self._smooth_envelope(self._intensity, 0.0, 0.0, rel)
                self._melody    = self._smooth_envelope(self._melody,    0.0, 0.0, rel)
            return

        windowed = mono * np.hanning(len(mono))
        spectrum = np.abs(np.fft.rfft(windowed))

        sub_energy    = self._band_rms(spectrum, self._sub_mask)
        bass_energy   = self._band_rms(spectrum, self._bass_mask)
        motion_energy = self._band_rms(spectrum, self._motion_mask)
        wide_energy   = self._band_rms(spectrum, self._wide_mask)
        melody_energy = self._band_rms(spectrum, self._melody_mask)
        now = time.monotonic()

        with self._lock:
            dt = now - self._last_peak_t
            self._last_peak_t = now

            # ── Adaptive peak tracking ────────────────────────────────────────
            decay = max(0.0, 1.0 - self.peak_decay * dt)
            self._peak_sub    = max(self._peak_sub    * decay, sub_energy)
            self._peak_bass   = max(self._peak_bass   * decay, bass_energy)
            self._peak_motion = max(self._peak_motion * (1.0 - max(self.peak_decay * 0.80, 0.05) * dt), motion_energy)
            self._peak_wide   = max(self._peak_wide   * (1.0 - max(self.peak_decay * 0.45, 0.03) * dt), wide_energy)
            self._peak_melody = max(self._peak_melody * (1.0 - max(self.peak_decay * 0.55, 0.04) * dt), melody_energy)

            raw_bass   = min(bass_energy   / max(self._peak_bass,   1e-9), 1.0)
            raw_motion = min(motion_energy / max(self._peak_motion, 1e-9), 1.0)
            raw_wide   = min(wide_energy   / max(self._peak_wide,   1e-9), 1.0)
            raw_melody = min(melody_energy / max(self._peak_melody, 1e-9), 1.0)

            # ── Envelope smoothing ────────────────────────────────────────────
            bass_attack      = min(max(self.smoothing - 0.34, 0.05), 0.70)
            bass_release     = min(max(self.smoothing - 0.10, 0.22), 0.90)
            motion_attack    = min(max(self.smoothing - 0.08, 0.18), 0.84)
            motion_release   = min(max(self.smoothing + 0.06, 0.40), 0.94)
            intensity_attack = min(max(self.smoothing + 0.02, 0.28), 0.90)
            intensity_release= min(max(self.smoothing + 0.14, 0.55), 0.97)
            melody_attack    = min(max(self.smoothing - 0.12, 0.14), 0.82)
            melody_release   = min(max(self.smoothing + 0.02, 0.36), 0.93)

            self._level     = self._smooth_envelope(self._level,     raw_bass,   bass_attack,      bass_release)
            self._motion    = self._smooth_envelope(self._motion,    raw_motion, motion_attack,    motion_release)
            self._intensity = self._smooth_envelope(self._intensity, raw_wide,   intensity_attack, intensity_release)
            self._melody    = self._smooth_envelope(self._melody,    raw_melody, melody_attack,    melody_release)

            # ── Regular beat onset (unchanged logic, but gated by noise floor) ──
            lt_bass_avg = float(np.mean(list(self._lt_bass_buf))) if self._lt_bass_buf else bass_energy
            flux_ratio  = bass_energy / max(lt_bass_avg, 1e-9)
            since_beat  = now - self._last_beat_t
            if (
                flux_ratio      >= self.onset_ratio
                and raw_bass    >= self.onset_min_level
                and since_beat  >= self.onset_cooldown
            ):
                self._beat_pending = True
                self._last_beat_t  = now

            # ── Oomph onset: sub-bass only, strict ratio + absolute min ───────
            lt_sub_avg  = float(np.mean(list(self._lt_sub_buf))) if self._lt_sub_buf else sub_energy
            sub_ratio   = sub_energy / max(lt_sub_avg, 1e-9)
            since_oomph = now - self._last_oomph_t
            if (
                sub_ratio      >= _OOMPH_RATIO
                and sub_energy >= _OOMPH_MIN_RMS
                and since_oomph >= 0.22          # max ~4-5 oomphs/s
            ):
                self._oomph_pending = True
                self._last_oomph_t  = now

            # Update long-term buffers AFTER onset check (so we compare against
            # the window just before the current frame, not including it).
            self._lt_bass_buf.append(bass_energy)
            self._lt_sub_buf.append(sub_energy)
            self._prev_bass_energy = bass_energy
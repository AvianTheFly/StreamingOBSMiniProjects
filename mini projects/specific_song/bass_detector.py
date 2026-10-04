from __future__ import annotations

import threading
import time
import subprocess
import os
from array import array
from collections import deque
from pathlib import Path

import numpy as np
from .analysis_cache import AnalysisCache, MAX_FILE_BYTES, close_analysis

# Real-time audio-reactive control signals for an OBS visualizer.
#
# Audio source: the actual file OBS plays, decoded in paced blocks or read
# from compact cached spectral measurements in real-time sync.
# No virtual audio device or loopback needed.
#
# DSP approach (standard audio-visualizer practices):
#   • Multi-band spectral analysis so melody activity drives motion even when
#     sub-bass/kick drops out.
#   • Log-compressed band energy prevents a single dominant bass note from
#     drowning all other signals.
#   • Per-band adaptive floor + adaptive peak normalisation.
#   • Separate "presence" blend of all bands — stays active across song sections.
#   • Multi-band positive spectral flux for transient/onset detection.
#   • Sub-only "oomph" trigger for intentional big pops.

_NOISE_FLOOR_RMS: float = 0.003
_LT_FRAMES: int = 24
_OOMPH_RATIO: float = 2.10
_OOMPH_MIN_RMS: float = 0.014
_PRESENCE_WEIGHTS = (0.16, 0.22, 0.30, 0.22, 0.10)  # sub, bass, motion, melody, air


class BassDetector:
    """
    Multi-band audio feature extractor.

    Pass audio_file=Path(...) to analyse the actual song file in real-time sync.
    If audio_file is None all signals stay at 0 (no-op mode).
    """

    def __init__(
        self,
        audio_file: Path | None = None,
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
        self._audio_file = audio_file
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
        self._presence = 0.0
        self._transient = 0.0

        self._peak_sub = 1e-6
        self._peak_bass = 1e-6
        self._peak_motion = 1e-6
        self._peak_wide = 1e-6
        self._peak_melody = 1e-6
        self._peak_air = 1e-6

        self._floor_sub = 1e-7
        self._floor_bass = 1e-7
        self._floor_motion = 1e-7
        self._floor_wide = 1e-7
        self._floor_melody = 1e-7
        self._floor_air = 1e-7

        self._prev_sub_raw = 0.0
        self._prev_bass_raw = 0.0
        self._prev_motion_raw = 0.0
        self._prev_melody_raw = 0.0
        self._prev_air_raw = 0.0

        self._beat_pending = False
        self._oomph_pending = False
        self._last_beat_t = 0.0
        self._last_oomph_t = 0.0
        self._last_peak_t = time.monotonic()

        self._lt_bass_buf: deque[float] = deque(maxlen=_LT_FRAMES)
        self._lt_sub_buf: deque[float] = deque(maxlen=_LT_FRAMES)
        self._lt_transient_buf: deque[float] = deque(maxlen=_LT_FRAMES)

        freqs = np.fft.rfftfreq(block_size, d=1.0 / sample_rate)
        self._sub_mask    = (freqs >= 20.0)           & (freqs <= 80.0)
        self._bass_mask   = (freqs >= bass_low_hz)    & (freqs <= bass_high_hz)
        self._motion_mask = (freqs >= 140.0)          & (freqs <= 1200.0)
        self._wide_mask   = (freqs >= 60.0)           & (freqs <= 5000.0)
        self._melody_mask = (freqs >= 300.0)          & (freqs <= 2800.0)
        self._air_mask    = (freqs >= 2500.0)         & (freqs <= 9000.0)
        self._window = np.hanning(block_size)

        self._running = False
        self._paused = threading.Event()
        self._file_thread: threading.Thread | None = None
        self._decoder = None
        self._decoder_lock = threading.Lock()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        if self._running:
            return
        self._running = True

        if self._audio_file is not None:
            self._file_thread = threading.Thread(
                target=self._stream_file_loop, daemon=True, name="bass_det:file"
            )
            self._file_thread.start()
        else:
            print("[BassDetector] No audio file configured — signals will be flat.")

    def pause(self) -> None:
        self._paused.set()

    def resume(self) -> None:
        self._paused.clear()

    def stop(self) -> None:
        self._running = False
        with self._decoder_lock:
            if self._decoder is not None and self._decoder.poll() is None:
                self._decoder.terminate()
        if self._file_thread is not None:
            self._file_thread.join(timeout=2)
            self._file_thread = None

    # ── Signal getters ────────────────────────────────────────────────────────

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

    def get_presence(self) -> float:
        with self._lock:
            return self._presence

    def get_transient(self) -> float:
        with self._lock:
            return self._transient

    def consume_beat(self) -> bool:
        with self._lock:
            if self._beat_pending:
                self._beat_pending = False
                return True
            return False

    def consume_oomph(self) -> bool:
        with self._lock:
            if self._oomph_pending:
                self._oomph_pending = False
                return True
            return False

    # ── File-based real-time loop ─────────────────────────────────────────────

    def _stream_file_loop(self) -> None:
        """Bounded, paced CPU decoding. No full-song allocation or catch-up FFTs."""
        decoder = None
        cache = self.analysis_cache()
        cached = cache.load() if cache else None
        if cached is not None:
            try:
                self._analysis_loop(cached)
            finally:
                close_analysis(cached)
            return
        features = array('d')
        cacheable = cache is not None
        try:
            with self._decoder_lock:
                if not self._running:
                    return
                decoder = subprocess.Popen(
                    ['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1',
                     '-re', '-i', str(self._audio_file), '-map', '0:a:0', '-vn',
                     '-threads', '1', '-filter_threads', '1', '-ac', '1',
                     '-ar', str(self.sample_rate), '-f', 'f32le', 'pipe:1'],
                    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                    creationflags=(getattr(subprocess, 'CREATE_NO_WINDOW', 0) |
                                   getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)))
                self._decoder = decoder
            size = self.block_size * 4
            next_frame = time.monotonic()
            while self._running:
                if self._paused.is_set():
                    time.sleep(0.05)
                    next_frame = time.monotonic()
                    continue
                raw = decoder.stdout.read(size)
                if not self._running:
                    break
                if not raw:
                    if cacheable and decoder.wait(timeout=1) == 0:
                        cache.save(features)
                    break
                chunk = np.frombuffer(raw[:len(raw)//4*4], dtype='<f4')
                if len(chunk) < self.block_size:
                    chunk = np.pad(chunk, (0, self.block_size-len(chunk)))
                row = self._process_frame(chunk, time.monotonic())
                if cacheable:
                    features.extend(row)
                    if len(features) * 8 + 1024 > MAX_FILE_BYTES:
                        cacheable = False
                        features = array('d')
                # Backpressure prevents burst analysis after a desktop stall.
                now = time.monotonic()
                next_frame = max(next_frame + self.block_size / self.sample_rate, now)
                if next_frame > now:
                    time.sleep(next_frame - now)
        except Exception as exc:
            print(f'[BassDetector] Streaming analysis stopped: {exc}')
        finally:
            if decoder is not None:
                if decoder.poll() is None:
                    decoder.terminate()
                try:
                    decoder.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    decoder.kill(); decoder.wait()
                decoder.stdout.close()
            with self._decoder_lock:
                if self._decoder is decoder:
                    self._decoder = None

    def analysis_cache(self):
        if self._audio_file is None or os.environ.get('HUB_SONG_ANALYSIS_CACHE', '1') == '0':
            return None
        try:
            return AnalysisCache(self._audio_file, self.sample_rate, self.block_size,
                                 self.bass_low_hz, self.bass_high_hz)
        except OSError:
            return None

    def _analysis_loop(self, rows) -> None:
        """Reuse exact spectral measurements; retain live smoothing and beat timing."""
        print(f'[BassDetector] Using prepared analysis: {self._audio_file.name}')
        next_frame = time.monotonic()
        for row in rows:
            while self._running and self._paused.is_set():
                time.sleep(0.05)
                next_frame = time.monotonic()
            if not self._running:
                return
            self._process_features(row, time.monotonic())
            now = time.monotonic()
            next_frame = max(next_frame + self.block_size / self.sample_rate, now)
            if next_frame > now:
                time.sleep(next_frame - now)

    # ── DSP ───────────────────────────────────────────────────────────────────

    @staticmethod
    def _band_rms(spectrum: np.ndarray, mask: np.ndarray) -> float:
        if not np.any(mask):
            return 0.0
        return float(np.sqrt(np.mean(spectrum[mask] ** 2)) + 1e-12)

    @staticmethod
    def _compress_energy(value: float) -> float:
        return float(np.log1p(6.0 * value))

    @staticmethod
    def _smooth_envelope(current: float, raw: float, attack: float, release: float) -> float:
        coef = attack if raw <= current else release
        return coef * current + (1.0 - coef) * raw

    @staticmethod
    def _adaptive_normalize(value: float, floor: float, peak: float) -> float:
        denom = max(peak - floor, 1e-8)
        return max(0.0, min((value - floor) / denom, 1.0))

    @staticmethod
    def _update_floor(current_floor: float, value: float, dt: float) -> float:
        rise = min(0.18 * dt, 0.02)
        fall = min(1.10 * dt, 0.10)
        if value < current_floor:
            return current_floor + (value - current_floor) * fall
        return current_floor + (value - current_floor) * rise

    def _process_frame(self, mono: np.ndarray, now: float) -> tuple:
        """Analyse one block of audio and update all signal fields."""
        features = self.frame_features(mono)
        self._process_features(features, now)
        return features

    def frame_features(self, mono: np.ndarray) -> tuple:
        """Time-independent measurements that can be computed once per asset."""
        frame_rms = float(np.sqrt(np.mean(mono ** 2)))
        if frame_rms < _NOISE_FLOOR_RMS:
            return (frame_rms, 0., 0., 0., 0., 0., 0.)
        window = self._window if len(mono) == self.block_size else np.hanning(len(mono))
        spectrum = np.abs(np.fft.rfft(mono * window))
        return (frame_rms, *(self._compress_energy(self._band_rms(spectrum, mask))
                            for mask in (self._sub_mask, self._bass_mask, self._motion_mask,
                                         self._wide_mask, self._melody_mask, self._air_mask)))

    def _process_features(self, features, now: float) -> None:
        frame_rms, sub_raw, bass_raw, motion_raw, wide_raw, melody_raw, air_raw = map(float, features)
        if frame_rms < _NOISE_FLOOR_RMS:
            with self._lock:
                rel = min(max(self.smoothing + 0.12, 0.58), 0.97)
                self._level     = self._smooth_envelope(self._level,     0.0, 0.0, rel)
                self._motion    = self._smooth_envelope(self._motion,    0.0, 0.0, rel)
                self._intensity = self._smooth_envelope(self._intensity, 0.0, 0.0, rel)
                self._melody    = self._smooth_envelope(self._melody,    0.0, 0.0, rel)
                self._presence  = self._smooth_envelope(self._presence,  0.0, 0.0, rel)
                self._transient = self._smooth_envelope(self._transient, 0.0, 0.0, rel)
            return

        transient_raw = (
            0.28 * max(0.0, sub_raw    - self._prev_sub_raw)
            + 0.25 * max(0.0, bass_raw   - self._prev_bass_raw)
            + 0.20 * max(0.0, motion_raw - self._prev_motion_raw)
            + 0.20 * max(0.0, melody_raw - self._prev_melody_raw)
            + 0.07 * max(0.0, air_raw    - self._prev_air_raw)
        )

        self._prev_sub_raw    = sub_raw
        self._prev_bass_raw   = bass_raw
        self._prev_motion_raw = motion_raw
        self._prev_melody_raw = melody_raw
        self._prev_air_raw    = air_raw

        with self._lock:
            dt = max(1e-4, now - self._last_peak_t)
            self._last_peak_t = now

            decay = max(0.0, 1.0 - self.peak_decay * dt)
            self._peak_sub    = max(self._peak_sub    * decay, sub_raw)
            self._peak_bass   = max(self._peak_bass   * decay, bass_raw)
            self._peak_motion = max(self._peak_motion * (1.0 - max(self.peak_decay * 0.78, 0.05) * dt), motion_raw)
            self._peak_wide   = max(self._peak_wide   * (1.0 - max(self.peak_decay * 0.44, 0.03) * dt), wide_raw)
            self._peak_melody = max(self._peak_melody * (1.0 - max(self.peak_decay * 0.52, 0.04) * dt), melody_raw)
            self._peak_air    = max(self._peak_air    * (1.0 - max(self.peak_decay * 0.36, 0.025) * dt), air_raw)

            self._floor_sub    = self._update_floor(self._floor_sub,    sub_raw,    dt)
            self._floor_bass   = self._update_floor(self._floor_bass,   bass_raw,   dt)
            self._floor_motion = self._update_floor(self._floor_motion, motion_raw, dt)
            self._floor_wide   = self._update_floor(self._floor_wide,   wide_raw,   dt)
            self._floor_melody = self._update_floor(self._floor_melody, melody_raw, dt)
            self._floor_air    = self._update_floor(self._floor_air,    air_raw,    dt)

            raw_sub    = self._adaptive_normalize(sub_raw,    self._floor_sub,    self._peak_sub)
            raw_bass   = self._adaptive_normalize(bass_raw,   self._floor_bass,   self._peak_bass)
            raw_motion = self._adaptive_normalize(motion_raw, self._floor_motion, self._peak_motion)
            raw_wide   = self._adaptive_normalize(wide_raw,   self._floor_wide,   self._peak_wide)
            raw_melody = self._adaptive_normalize(melody_raw, self._floor_melody, self._peak_melody)
            raw_air    = self._adaptive_normalize(air_raw,    self._floor_air,    self._peak_air)

            transient_peak = max(
                np.mean(self._lt_transient_buf) * 2.4 if self._lt_transient_buf else 0.0,
                0.035,
            )
            raw_transient = max(0.0, min(transient_raw / transient_peak, 1.0))

            bass_attack      = min(max(self.smoothing - 0.30, 0.10), 0.72)
            bass_release     = min(max(self.smoothing + 0.02, 0.35), 0.92)
            motion_attack    = min(max(self.smoothing - 0.08, 0.18), 0.84)
            motion_release   = min(max(self.smoothing + 0.06, 0.42), 0.94)
            intensity_attack = min(max(self.smoothing + 0.02, 0.26), 0.90)
            intensity_release= min(max(self.smoothing + 0.14, 0.56), 0.97)
            melody_attack    = min(max(self.smoothing - 0.12, 0.14), 0.82)
            melody_release   = min(max(self.smoothing + 0.02, 0.38), 0.94)
            presence_attack  = 0.28
            presence_release = 0.76
            transient_attack = 0.08
            transient_release= 0.68

            level_target = 0.58 * raw_sub + 0.42 * raw_bass
            presence_target = (
                _PRESENCE_WEIGHTS[0] * raw_sub
                + _PRESENCE_WEIGHTS[1] * raw_bass
                + _PRESENCE_WEIGHTS[2] * raw_motion
                + _PRESENCE_WEIGHTS[3] * raw_melody
                + _PRESENCE_WEIGHTS[4] * raw_air
            )

            self._level     = self._smooth_envelope(self._level,     level_target,    bass_attack,      bass_release)
            self._motion    = self._smooth_envelope(self._motion,    raw_motion,      motion_attack,    motion_release)
            self._intensity = self._smooth_envelope(self._intensity, raw_wide,        intensity_attack, intensity_release)
            self._melody    = self._smooth_envelope(self._melody,    raw_melody,      melody_attack,    melody_release)
            self._presence  = self._smooth_envelope(self._presence,  presence_target, presence_attack,  presence_release)
            self._transient = self._smooth_envelope(self._transient, raw_transient,   transient_attack, transient_release)

            lt_bass_avg  = float(np.mean(self._lt_bass_buf))  if self._lt_bass_buf  else bass_raw
            lt_sub_avg   = float(np.mean(self._lt_sub_buf))   if self._lt_sub_buf   else sub_raw
            since_beat   = now - self._last_beat_t
            since_oomph  = now - self._last_oomph_t

            flux_ratio = bass_raw / max(lt_bass_avg, 1e-8)
            if (
                flux_ratio          >= self.onset_ratio
                and self._transient >= 0.20
                and self._presence  >= self.onset_min_level
                and since_beat      >= self.onset_cooldown
            ):
                self._beat_pending = True
                self._last_beat_t  = now

            sub_ratio = sub_raw / max(lt_sub_avg, 1e-8)
            if (
                sub_ratio           >= _OOMPH_RATIO
                and sub_raw         >= _OOMPH_MIN_RMS
                and self._transient >= 0.22
                and since_oomph     >= 0.22
            ):
                self._oomph_pending = True
                self._last_oomph_t  = now

            self._lt_bass_buf.append(bass_raw)
            self._lt_sub_buf.append(sub_raw)
            self._lt_transient_buf.append(transient_raw)

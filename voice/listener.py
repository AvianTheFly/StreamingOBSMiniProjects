"""
voice/listener.py
=================
Push-to-talk recorder for obs_hub.

Workflow
--------
1. Hub calls start_recording() when user presses ili macro
2. Mic accumulates raw float32 chunks into a growing buffer
3. Hub calls stop_and_transcribe() when user presses kjk macro
4. Whisper transcribes the buffer and the result is forwarded to the focused
   project's queue via the send_fn supplied at call time.

No RMS gate, no VAD segmentation — the user controls the utterance boundaries.
"""

from __future__ import annotations

import queue
import threading
from typing import Callable

import numpy as np

from hub_config import (
    MIC_CHUNK_SAMPLES,
    MIC_DEVICE,
    MIC_SAMPLE_RATE,
    WHISPER_COMPUTE,
    WHISPER_DEVICE,
    WHISPER_LANGUAGE,
    WHISPER_MODEL,
)

SendFn = Callable[[str], None]


# ─────────────────────────────────────────────────────────────────────────────
#  Module-level state  (set once by start())
# ─────────────────────────────────────────────────────────────────────────────

_model  = None                          # WhisperModel — loaded once
_stream = None                          # sounddevice InputStream — kept open always
_audio_q: queue.Queue[np.ndarray] = queue.Queue()

_recording = False
_rec_lock  = threading.Lock()
_buffer: list[np.ndarray] = []


# ─────────────────────────────────────────────────────────────────────────────
#  Public API  (called by hub main.py)
# ─────────────────────────────────────────────────────────────────────────────

def start(stop_event: threading.Event) -> None:
    """
    Load Whisper and open the microphone.  Call once at hub startup.
    Recording does NOT begin until start_recording() is called.
    """
    t = threading.Thread(
        target=_init_and_drain,
        args=(stop_event,),
        name="voice_listener",
        daemon=True,
    )
    t.start()


def start_recording() -> None:
    """Begin accumulating mic audio into the internal buffer."""
    global _recording, _buffer
    with _rec_lock:
        _buffer    = []
        _recording = True
    print("  🎙️  Recording... (press 'kjk' macro to send)")


def stop_and_transcribe(send_fn: SendFn) -> None:
    """
    Stop recording, then transcribe + forward in a background thread so the
    key handler returns immediately.

    send_fn — callable that routes the transcribed string to the focused
              project's input queue.  Pass `lambda _: None` to discard.
    """
    global _recording
    with _rec_lock:
        _recording     = False
        audio_snapshot = list(_buffer)
        _buffer.clear()

    if not audio_snapshot:
        print("  [voice] Nothing recorded.")
        return

    threading.Thread(
        target=_transcribe_and_send,
        args=(audio_snapshot, send_fn),
        daemon=True,
    ).start()


# ─────────────────────────────────────────────────────────────────────────────
#  Internal
# ─────────────────────────────────────────────────────────────────────────────

def _init_and_drain(stop_event: threading.Event) -> None:
    """Load Whisper, open mic stream, then drain the audio queue forever."""
    global _model, _stream

    # ── Load Whisper ──────────────────────────────────────────────────────────
    try:
        from faster_whisper import WhisperModel
        print(
            f"  [voice] Loading Whisper '{WHISPER_MODEL}' "
            f"on {WHISPER_DEVICE} ({WHISPER_COMPUTE})..."
        )
        _model = WhisperModel(
            WHISPER_MODEL,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE,
        )
        print("  [voice] Whisper ready.")
    except Exception as e:
        print(f"  [voice] Failed to load Whisper: {e}")
        return

    # ── Open microphone ───────────────────────────────────────────────────────
    try:
        import sounddevice as sd
    except ImportError:
        print("  [voice] sounddevice not installed — run: pip install sounddevice")
        return

    # Resolve which device to use and what sample rate it supports
    device_idx   = MIC_DEVICE  # None = sounddevice default
    device_info  = sd.query_devices(device_idx, "input")
    device_name  = device_info["name"]
    native_rate  = int(device_info["default_samplerate"])

    # Prefer the configured rate; fall back to native if hardware rejects 16kHz
    chosen_rate = MIC_SAMPLE_RATE
    if native_rate != MIC_SAMPLE_RATE:
        print(
            f"  [voice] Note: device native rate is {native_rate} Hz, "
            f"attempting {MIC_SAMPLE_RATE} Hz (Whisper requirement)."
        )

    def _sd_callback(indata, frames, time_info, status):
        if status:
            print(f"  [voice] sounddevice status: {status}")
        _audio_q.put(indata[:, 0].copy())   # mono float32

    # Try to open at MIC_SAMPLE_RATE; if that fails, try native rate
    for rate in ([MIC_SAMPLE_RATE] if native_rate == MIC_SAMPLE_RATE
                 else [MIC_SAMPLE_RATE, native_rate]):
        try:
            _stream = sd.InputStream(
                device=device_idx,
                samplerate=rate,
                channels=1,
                dtype="float32",
                blocksize=MIC_CHUNK_SAMPLES,
                callback=_sd_callback,
            )
            _stream.start()
            chosen_rate = rate
            print(f"  [voice] Mic open: [{device_idx if device_idx is not None else 'default'}] "
                  f"'{device_name}' @ {rate} Hz")
            if rate != MIC_SAMPLE_RATE:
                print(
                    f"  [voice] WARNING: running at {rate} Hz instead of 16000 Hz. "
                    "Whisper accuracy may be reduced. "
                    "Set MIC_SAMPLE_RATE to match in hub_config.py."
                )
            break
        except Exception as e:
            print(f"  [voice] Could not open mic at {rate} Hz: {e}")
            _stream = None

    if _stream is None:
        print("  [voice] Failed to open microphone. Run mic_test.py to diagnose.")
        return

    print("  [voice] Ready — press 'ili' macro to start recording.")

    # ── Drain loop: only writes to _buffer when _recording is True ───────────
    try:
        while not stop_event.is_set():
            try:
                chunk = _audio_q.get(timeout=0.1)
            except queue.Empty:
                continue

            with _rec_lock:
                if _recording:
                    _buffer.append(chunk)
    finally:
        _stream.stop()
        _stream.close()


def _transcribe_and_send(chunks: list[np.ndarray], send_fn: SendFn) -> None:
    if _model is None:
        print("  [voice] Whisper not ready yet — try again in a moment.")
        return

    audio = np.concatenate(chunks)

    try:
        segments, _ = _model.transcribe(
            audio,
            language=WHISPER_LANGUAGE,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300},
        )
        text = " ".join(s.text for s in segments).strip()
    except Exception as e:
        print(f"  [voice] Transcription error: {e}")
        return

    if not text:
        print("  [voice] Transcription was empty — nothing sent.")
        return

    print(f"  🎤  {text}")
    send_fn(text)
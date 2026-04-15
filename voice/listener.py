"""
voice/listener.py
=================
Push-to-talk recorder for obs_hub.

Workflow
--------
1. A project calls start_recording(owner) when the user presses its trigger hotkey.
   Only ONE project can record at a time.  If another is already recording, the
   call is rejected and logs a warning.
2. Mic accumulates raw float32 chunks into a growing buffer.
3. The project calls stop_and_transcribe(send_fn, owner) when:
   - The trigger hotkey is pressed again  (double-trigger)
   - The user presses the 'C' stop key
   - The 2-second auto-timeout fires
4. Whisper transcribes the buffer and calls send_fn(text) from a background thread.

The mic stream is always open (no startup delay).  Audio is only buffered when
_recording is True — Whisper never sees audio until a trigger is pressed.
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

_recording       = False
_recording_owner = ""                   # tag of the project that owns the current recording
_rec_lock        = threading.Lock()
_buffer: list[np.ndarray] = []


# ─────────────────────────────────────────────────────────────────────────────
#  Public API
# ─────────────────────────────────────────────────────────────────────────────

def start(stop_event: threading.Event) -> None:
    """Load Whisper and open the microphone.  Call once at hub startup."""
    t = threading.Thread(
        target=_init_and_drain,
        args=(stop_event,),
        name="voice_listener",
        daemon=True,
    )
    t.start()


def start_recording(owner: str = "unknown") -> bool:
    """
    Begin accumulating mic audio for `owner`.

    Returns True if recording started successfully.
    Returns False if another project is already recording — the caller should
    abort its recording flow.  Nothing is modified in that case.
    """
    global _recording, _buffer, _recording_owner
    with _rec_lock:
        if _recording:
            print(
                f"  [voice] ⚠  '{owner}' tried to start recording, "
                f"but '{_recording_owner}' is already active — ignored."
            )
            return False
        _buffer          = []
        _recording       = True
        _recording_owner = owner

    print(f"  [voice] 🎙️  Recording started [{owner}]. "
          f"Press trigger again or 'C' to send, auto-stops in 2s.")
    return True


def stop_and_transcribe(send_fn: SendFn, owner: str = "") -> None:
    """
    Stop recording and transcribe in a background thread.

    owner — the tag passed to start_recording().  If it doesn't match the
            current owner the call is silently rejected.  Pass "" to force-stop
            regardless of owner (e.g. on hub shutdown).
    send_fn — called with the transcribed string from a background thread.
              Pass `lambda _: None` to discard (e.g. on cancel).
    """
    global _recording, _recording_owner
    with _rec_lock:
        if not _recording:
            if owner:
                print(f"  [voice] '{owner}' called stop_and_transcribe but nothing is recording.")
            return
        if owner and _recording_owner and owner != _recording_owner:
            print(
                f"  [voice] ⚠  '{owner}' tried to stop recording owned by "
                f"'{_recording_owner}' — ignored."
            )
            return
        _recording       = False
        audio_snapshot   = list(_buffer)
        _buffer.clear()
        stopped_owner    = _recording_owner
        _recording_owner = ""

    chunk_count = len(audio_snapshot)
    duration    = chunk_count * MIC_CHUNK_SAMPLES / MIC_SAMPLE_RATE
    print(f"  [voice] 🛑  Recording stopped [{stopped_owner}]. "
          f"{chunk_count} chunk(s) / {duration:.2f}s buffered.")

    if not audio_snapshot:
        print("  [voice] Nothing recorded — buffer was empty.")
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

    device_idx  = MIC_DEVICE
    device_info = sd.query_devices(device_idx, "input")
    device_name = device_info["name"]
    native_rate = int(device_info["default_samplerate"])

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
                    "Whisper accuracy may be reduced."
                )
            break
        except Exception as e:
            print(f"  [voice] Could not open mic at {rate} Hz: {e}")
            _stream = None

    if _stream is None:
        print("  [voice] Failed to open microphone. Run mic_test.py to diagnose.")
        return

    print("  [voice] Ready — press a trigger hotkey to start recording.")

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

    audio    = np.concatenate(chunks)
    duration = len(audio) / MIC_SAMPLE_RATE
    print(f"  [voice] Transcribing {duration:.2f}s of audio…")

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
        print("  [voice] Transcription empty — VAD filtered everything (silence or noise).")
        return

    print(f"  [voice] 🎤  Transcribed: \"{text}\"")
    send_fn(text)

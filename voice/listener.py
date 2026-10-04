"""Microphone and Whisper backend for voice.service.

One open input stream captures only the active session. This module owns audio
buffers and inference; the service owns consumers, deadlines and result routing.
Projects use voice.ptt or voice.service, never these recording primitives.
"""

from __future__ import annotations

import queue
import threading
import time
from typing import Callable

import numpy as np
from lib.performance_monitor import note_media_load

from hub_config import (
    MIC_CHUNK_SAMPLES,
    MIC_DEVICE,
    MIC_SAMPLE_RATE,
    WHISPER_COMPUTE,
    WHISPER_CPU_THREADS,
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
_audio_q: queue.Queue[tuple[int, np.ndarray]] = queue.Queue(maxsize=128)
_ready_event = threading.Event()
_startup_error: str | None = None
_start_lock = threading.Lock()
_listener_thread: threading.Thread | None = None

_recording       = False
_recording_owner = ""                   # tag of the project that owns the current recording
_rec_lock        = threading.Lock()
_buffer: list[np.ndarray] = []
_transcription_busy = False
MAX_RECORDING_SECONDS = 10
_recording_started = 0.0
_recording_generation = 0


# ─────────────────────────────────────────────────────────────────────────────
#  Public API
# ─────────────────────────────────────────────────────────────────────────────

def start(stop_event: threading.Event) -> None:
    """Start one microphone listener, reusing the model after a failed mic open."""
    global _listener_thread
    with _start_lock:
        if _listener_thread is not None and _listener_thread.is_alive():
            return
        _listener_thread = threading.Thread(
            target=_init_and_drain, args=(stop_event,),
            name="voice_listener", daemon=True,
        )
        try:
            _listener_thread.start()
        except Exception:
            _listener_thread = None
            raise


def start_recording(owner: str = "unknown") -> bool:
    """
    Begin accumulating mic audio for `owner`.

    Returns True if recording started successfully.
    Returns False if another project is already recording — the caller should
    abort its recording flow.  Nothing is modified in that case.
    """
    global _recording, _buffer, _recording_owner, _recording_started, _recording_generation
    if not _ready_event.is_set():
        return False

    with _rec_lock:
        if _transcription_busy:
            print("  [voice] Previous voice command is still transcribing; try again shortly.")
            return False
        if _recording:
            print(
                f"  [voice] '{owner}' tried to start recording, "
                f"but '{_recording_owner}' is already active — ignored."
            )
            return False
        _clear_audio_queue()
        _buffer          = []
        _recording_generation += 1
        _recording_owner = owner
        _recording_started = time.monotonic()
        _recording       = True

    print(f"  [voice] Recording started [{owner}]. "
          f"Waiting for the shared service to finish or cancel.")
    return True


def is_ready() -> bool:
    """Return True once Whisper is loaded and the mic drain loop is running."""
    return _ready_event.is_set()


def stop_and_transcribe(send_fn: SendFn, owner: str = "", *,
                        on_complete: Callable[[], None] | None = None,
                        on_error: Callable[[str], None] | None = None) -> None:
    """
    Stop recording and transcribe in a background thread.

    owner — the tag passed to start_recording().  If it doesn't match the
            current owner the call is silently rejected.  Pass "" to force-stop
            regardless of owner (e.g. on hub shutdown).
    send_fn — called with the transcribed string from a background thread.
              Use cancel_recording() to discard audio without inference.
    """
    global _recording, _recording_owner, _transcription_busy
    rejected = False
    with _rec_lock:
        if not _recording:
            if owner:
                print(f"  [voice] '{owner}' called stop_and_transcribe but nothing is recording.")
            rejected = True
        elif owner and _recording_owner and owner != _recording_owner:
            print(
                f"  [voice] '{owner}' tried to stop recording owned by "
                f"'{_recording_owner}' — ignored."
            )
            rejected = True
        else:
            # Include audio already captured but not yet consumed by the
            # drain thread. Session tags exclude late cancelled chunks.
            _flush_audio_queue_locked()
            _recording       = False
            audio_snapshot   = list(_buffer)
            _buffer.clear()
            stopped_owner    = _recording_owner
            _recording_owner = ""
            _transcription_busy = bool(audio_snapshot)

    if rejected:
        if on_complete:
            on_complete()
        return

    chunk_count = len(audio_snapshot)
    duration    = chunk_count * MIC_CHUNK_SAMPLES / MIC_SAMPLE_RATE
    print(f"  [voice] Recording stopped [{stopped_owner}]. "
          f"{chunk_count} chunk(s) / {duration:.2f}s buffered.")

    if not audio_snapshot:
        print("  [voice] Nothing recorded — buffer was empty.")
        if on_complete:
            on_complete()
        return

    def run():
        global _transcription_busy
        error = ""
        try:
            _transcribe_and_send(audio_snapshot, send_fn)
        except Exception as exc:
            error = str(exc)
            print(f"  [voice] Transcription error: {error}")
        finally:
            with _rec_lock:
                _transcription_busy = False
            if error and on_error:
                on_error(error)
            if on_complete:
                on_complete()
    try:
        threading.Thread(target=run, name="voice-transcribe", daemon=True).start()
    except Exception:
        with _rec_lock:
            _transcription_busy = False
        if on_complete:
            on_complete()
        raise


def cancel_recording(owner: str = "") -> bool:
    """Discard a recording without starting Whisper inference."""
    global _recording, _recording_owner
    with _rec_lock:
        if not _recording or (owner and _recording_owner and owner != _recording_owner):
            return False
        _recording = False
        _recording_owner = ""
        _buffer.clear()
        _clear_audio_queue()
    print(f"  [voice] Recording cancelled [{owner}].")
    return True


# ─────────────────────────────────────────────────────────────────────────────
#  Internal
# ─────────────────────────────────────────────────────────────────────────────

def _init_and_drain(stop_event: threading.Event) -> None:
    """Load Whisper, open mic stream, then drain the audio queue forever."""
    global _model, _stream, _startup_error, _recording, _recording_owner
    _ready_event.clear()
    _startup_error = None

    # ── Load Whisper ──────────────────────────────────────────────────────────
    try:
        from faster_whisper import WhisperModel
        print(
            f"  [voice] Loading Whisper '{WHISPER_MODEL}' "
            f"on {WHISPER_DEVICE} ({WHISPER_COMPUTE})..."
        )
        if _model is None:
            note_media_load('voice:model', 'loading')
            try:
                _model = WhisperModel(
                    WHISPER_MODEL,
                    device=WHISPER_DEVICE,
                    compute_type=WHISPER_COMPUTE,
                    cpu_threads=WHISPER_CPU_THREADS,
                )
            finally:
                note_media_load('voice:model', 'released')
        print("  [voice] Whisper ready.")
    except Exception as e:
        _startup_error = f"failed to load Whisper: {e}"
        print(f"  [voice] Failed to load Whisper: {e}")
        return

    if stop_event.is_set():
        return

    # ── Open microphone ───────────────────────────────────────────────────────
    try:
        import sounddevice as sd
    except ImportError:
        _startup_error = "sounddevice is not installed; run with the Python environment that has it"
        print("  [voice] sounddevice not installed — run: pip install sounddevice")
        return

    device_idx  = MIC_DEVICE
    try:
        device_info = sd.query_devices(device_idx, "input")
    except Exception as e:
        _startup_error = f"could not query input device {device_idx}: {e}"
        print(f"  [voice] Could not query input device {device_idx}: {e}")
        return
    device_name = device_info["name"]
    native_rate = int(device_info["default_samplerate"])

    if native_rate != MIC_SAMPLE_RATE:
        print(
            f"  [voice] Note: device native rate is {native_rate} Hz, "
            f"attempting {MIC_SAMPLE_RATE} Hz (Whisper requirement)."
        )

    def _sd_callback(indata, frames, time_info, status):
        if status:
            print(f"  [voice] sounddevice status: {status}")
        _capture_audio(indata)

    for rate in ([MIC_SAMPLE_RATE] if native_rate == MIC_SAMPLE_RATE
                 else [MIC_SAMPLE_RATE, native_rate]):
        try:
            _stream = sd.InputStream(
                device=device_idx,
                samplerate=rate,
                channels=1,
                dtype="float32",
                blocksize=MIC_CHUNK_SAMPLES,
                latency="high",
                callback=_sd_callback,
            )
            _stream.start()
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
            if _stream is not None:
                _stream.close()
            _stream = None

    if _stream is None:
        _startup_error = "failed to open microphone"
        print("  [voice] Failed to open microphone. Run mic_test.py to diagnose.")
        return

    _clear_audio_queue()
    _ready_event.set()
    print("  [voice] Ready — press a trigger hotkey to start recording.")

    # ── Drain loop: only writes to _buffer when _recording is True ───────────
    try:
        while not stop_event.is_set():
            try:
                captured = _audio_q.get(timeout=0.1)
            except queue.Empty:
                continue

            with _rec_lock:
                _append_audio_locked(captured)
    finally:
        _ready_event.clear()
        with _rec_lock:
            _recording = False
            _recording_owner = ""
            _buffer.clear()
            _clear_audio_queue()
        try:
            _stream.stop()
        finally:
            _stream.close()
            _stream = None


def _capture_audio(indata: np.ndarray) -> None:
    """Keep the real-time callback nonblocking and tag its recording session."""
    generation = _recording_generation
    if not _recording:
        return
    try:
        _audio_q.put_nowait((generation, indata[:, 0].copy()))
    except queue.Full:
        pass


def _append_audio_locked(captured: tuple[int, np.ndarray]) -> None:
    global _recording, _recording_owner
    generation, chunk = captured
    if not _recording or generation != _recording_generation:
        return
    if time.monotonic() - _recording_started > MAX_RECORDING_SECONDS:
        _recording = False
        _recording_owner = ""
        _buffer.clear()
        print("  [voice] Recording safety timeout; discarded stale command.")
    else:
        _buffer.append(chunk)


def _flush_audio_queue_locked() -> None:
    while True:
        try:
            captured = _audio_q.get_nowait()
        except queue.Empty:
            return
        _append_audio_locked(captured)


def _clear_audio_queue() -> None:
    """Drop mic chunks captured before the next recording window starts."""
    while True:
        try:
            _audio_q.get_nowait()
        except queue.Empty:
            break


def _transcribe_and_send(chunks: list[np.ndarray], send_fn: SendFn) -> None:
    if _model is None:
        print("  [voice] Whisper not ready yet — try again in a moment.")
        return

    audio    = np.concatenate(chunks)
    duration = len(audio) / MIC_SAMPLE_RATE
    print(f"  [voice] Transcribing {duration:.2f}s of audio…")

    try:
        text = _infer_text(audio)
    except Exception as e:
        raise RuntimeError(f"Transcription error: {e}") from e

    if not text:
        print("  [voice] Transcription empty — VAD filtered everything (silence or noise).")
        return

    print(f"  [voice] Transcribed: \"{text}\"")
    send_fn(text)


def diagnostics() -> dict:
    with _rec_lock:
        return {"ready": is_ready(), "recording": _recording,
                "transcribing": _transcription_busy, "model": WHISPER_MODEL,
                "device": WHISPER_DEVICE, "compute": WHISPER_COMPUTE,
                "startup_error": _startup_error}


def _infer_text(audio) -> str:
    """Both uploads and microphone commands consume lazy inference here."""
    note_media_load('voice:inference', 'running')
    try:
        segments, _ = _model.transcribe(audio, language=WHISPER_LANGUAGE,
            beam_size=5, vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300})
        return " ".join(s.text for s in segments).strip()
    finally:
        note_media_load('voice:inference', 'released')


def transcribe_file(path: str, *, word_timestamps=False):
    """Use the loaded model for an editor upload, excluding microphone inference."""
    global _transcription_busy
    with _rec_lock:
        if _model is None or _recording or _transcription_busy:
            raise RuntimeError("Voice model is starting or busy")
        _transcription_busy = True
    try:
        if not word_timestamps:
            return _infer_text(path)
        from .transcription import timed_words
        note_media_load('voice:inference', 'running')
        try:
            return timed_words(_model, path, WHISPER_LANGUAGE)
        finally:
            note_media_load('voice:inference', 'released')
    finally:
        with _rec_lock:
            _transcription_busy = False

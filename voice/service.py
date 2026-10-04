"""Own voice sessions, deadlines, cancellation and delivery for every project.

listener owns the microphone and the single Whisper model. Projects register a
consumer here; they never manage microphone ownership or transcription timers.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import threading
import time
from typing import Callable

from . import listener


@dataclass
class Consumer:
    tag: str
    timeout: float
    callback: Callable[[str], None]
    timed_callback: Callable[[str, float], None] | None = None
    completion: Callable[[str], None] | None = None
    lockout: float = 0.5
    lockout_until: float = 0.0
    generation: int = 0


@dataclass
class Session:
    id: int
    consumer: Consumer
    generation: int
    started_at: float
    state: str = "listening"
    text: str = ""
    cancelled: bool = False
    timer: threading.Timer | None = None


class VoiceService:
    def __init__(self, backend=listener):
        self.backend = backend
        self._lock = threading.RLock()
        self._consumers: dict[str, Consumer] = {}
        self._active: Session | None = None
        self._sequence = 0
        self._history = deque(maxlen=50)
        self._deliveries = threading.BoundedSemaphore(8)
        self._shutdown_thread = None
        self._last_rejection = None

    def register(self, tag, timeout, callback, *, timed_callback=None,
                 completion=None, lockout=0.5):
        tag = tag or "unknown"
        consumer = Consumer(tag, max(0.1, min(float(timeout), 10.0)), callback,
                            timed_callback, completion, max(0.0, float(lockout)))
        with self._lock:
            previous = self._consumers.get(tag)
            if previous:
                self.cancel(previous, "consumer replaced")
                previous.generation += 1
            self._consumers[tag] = consumer
        return consumer

    def start(self, stop_event):
        self.backend.start(stop_event)
        with self._lock:
            if self._shutdown_thread and self._shutdown_thread.is_alive():
                return
            def shutdown():
                stop_event.wait()
                self.cancel(reason="Hub shutdown")
                with self._lock:
                    for consumer in self._consumers.values():
                        consumer.generation += 1
            self._shutdown_thread = threading.Thread(target=shutdown,
                name="voice-service-shutdown", daemon=True)
            self._shutdown_thread.start()

    def state(self, consumer):
        with self._lock:
            if self._active and self._active.consumer is consumer:
                return self._active.state
            return "idle"

    def begin(self, consumer):
        from events import inspect_event
        with self._lock:
            if self._consumers.get(consumer.tag) is not consumer:
                return False
            reason = ""
            if self._active:
                reason = f"Voice is {self._active.state} for {self._active.consumer.tag}"
            elif time.monotonic() < consumer.lockout_until:
                reason = "Trigger lockout; try again shortly"
            # Hotkeys must never wait for a model or device to initialize.
            elif not self.backend.is_ready():
                reason = "Microphone or model is starting / unavailable"
            if reason:
                inspect_event('voice.session', owner=consumer.tag, phase='rejected', reason=reason)
                self._last_rejection = {"owner": consumer.tag, "reason": reason, "time": time.time()}
                print(f"  [voice] {consumer.tag}: {reason}")
                return False
            pressed_at = time.time()
            if not self.backend.start_recording(consumer.tag):
                return False
            self._sequence += 1
            session = Session(self._sequence, consumer, consumer.generation, pressed_at)
            self._active = session
            inspect_event('voice.session', owner=consumer.tag, phase='listening', session_id=session.id)
            session.timer = threading.Timer(consumer.timeout,
                lambda: self.finish(consumer, session.id))
            session.timer.daemon = True
            try:
                session.timer.start()
            except Exception:
                self.backend.cancel_recording(consumer.tag)
                self._active = None
                raise
            return True

    def finish(self, consumer=None, session_id=None):
        with self._lock:
            session = self._active
            if not session or session.state != "listening":
                return False
            if consumer is not None and session.consumer is not consumer:
                return False
            if session_id is not None and session.id != session_id:
                return False
            session.state = "processing"
            session.timer.cancel()
            session.consumer.lockout_until = time.monotonic() + session.consumer.lockout
        from events import inspect_event
        inspect_event('voice.session', owner=session.consumer.tag, phase='processing', session_id=session.id)
        try:
            self.backend.stop_and_transcribe(
                lambda text: self._receive(session, text), session.consumer.tag,
                on_complete=lambda: self._complete(session),
                on_error=lambda error: self._complete(session, error))
        except Exception as exc:
            self._complete(session, str(exc))
        return True

    def cancel(self, consumer=None, reason="cancelled", session_id=None):
        with self._lock:
            if session_id is not None and (not self._active or self._active.id != session_id):
                return False
            if consumer is not None:
                consumer.generation += 1  # suppress a queued old delivery too
            session = self._active
            if not session or (consumer is not None and session.consumer is not consumer):
                return False
            session.cancelled = True
            session.consumer.generation += 1
            if session.timer:
                session.timer.cancel()
            if session.state == "listening":
                self.backend.cancel_recording(session.consumer.tag)
                self._complete(session, reason)
            else:
                # Inference cannot be killed safely. Keep ownership until it ends,
                # discard the result, and show this honestly in the control panel.
                session.state = "cancelling"
            return True

    def _receive(self, session, text):
        with self._lock:
            if self._active is session and not session.cancelled:
                session.text = str(text).strip()

    def _complete(self, session, error=""):
        with self._lock:
            if self._active is not session:
                return
            self._active = None
            record = {"id": session.id, "owner": session.consumer.tag,
                      "started_at": session.started_at, "finished_at": time.time(),
                      "text": session.text, "error": error,
                      "outcome": "cancelled" if session.cancelled else
                                 "error" if error else "transcribed" if session.text else "empty"}
            self._history.append(record)
            deliver = (not session.cancelled and not error and
                       self._consumers.get(session.consumer.tag) is session.consumer)
        from events import inspect_event
        inspect_event('voice.session', owner=session.consumer.tag, phase=record['outcome'], session_id=session.id)
        if deliver:
            self._deliver(session, record)

    def _deliver(self, session, record):
        if not self._deliveries.acquire(blocking=False):
            with self._lock:
                record.update(outcome="error", error="Voice consumers are busy; delivery limit reached")
            return
        def run():
            try:
                consumer = session.consumer
                with self._lock:
                    valid = (consumer.generation == session.generation and
                             self._consumers.get(consumer.tag) is consumer)
                if not valid:
                    with self._lock:
                        record["outcome"] = "cancelled"
                    return
                if session.text:
                    if consumer.timed_callback:
                        consumer.timed_callback(session.text, session.started_at)
                    else:
                        consumer.callback(session.text)
                if consumer.completion:
                    consumer.completion(session.text)
            except Exception as exc:
                with self._lock:
                    record.update(outcome="error", error=f"Consumer failed: {exc}")
            finally:
                self._deliveries.release()
        try:
            threading.Thread(target=run, name=f"voice-delivery:{session.consumer.tag}", daemon=True).start()
        except Exception as exc:
            self._deliveries.release()
            with self._lock:
                record.update(outcome="error", error=f"Delivery failed: {exc}")

    def transcribe_upload(self, audio_bytes, content_type="", *, word_timestamps=False):
        """Editor phrase training uses the same model and exclusive inference slot."""
        import os
        import tempfile
        if not audio_bytes or len(audio_bytes) > 20 * 1024 * 1024:
            raise ValueError("Audio must contain between 1 byte and 20 MiB")
        with self._lock:
            if self._active or not self.backend.is_ready():
                raise RuntimeError("Voice is busy or starting; try again shortly")
            self._sequence += 1
            consumer = Consumer("hotkey_editor", 0, lambda text: None)
            session = Session(self._sequence, consumer, 0, time.time(), state="processing")
            self._active = session
        suffix = next((ext for token, ext in [("wav", ".wav"), ("mpeg", ".mp3"),
                      ("mp3", ".mp3"), ("ogg", ".ogg")] if token in content_type), ".webm")
        path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as file:
                path = file.name
                file.write(audio_bytes)
            result = (self.backend.transcribe_file(path, word_timestamps=True)
                      if word_timestamps else self.backend.transcribe_file(path))
            text = result['text'] if word_timestamps else result
            self._receive(session, text)
            with self._lock:
                cancelled = session.cancelled
            self._complete(session)
            if cancelled:
                raise RuntimeError("Transcription cancelled")
            return result
        except Exception as exc:
            self._complete(session, str(exc))
            raise
        finally:
            if path:
                os.unlink(path)

    def diagnostics(self, *, include_details=True):
        with self._lock:
            session = self._active
            result = {**self.backend.diagnostics(),
                "state": session.state if session else "idle",
                "owner": session.consumer.tag if session else None,
                "session_id": session.id if session else None,
                "started_at": session.started_at if session else None,
                "last_rejection": dict(self._last_rejection) if self._last_rejection else None}
            if include_details:
                result.update(consumers=[{"tag": c.tag, "timeout": c.timeout,
                                         "state": self.state(c)} for c in self._consumers.values()],
                              history=[dict(item) for item in reversed(self._history)])
            return result

    def clear_history(self):
        with self._lock:
            self._history.clear()


service = VoiceService()

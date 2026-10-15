"""Small hotkey adapter; all session state belongs to voice.service."""
import threading
from .service import service


class VoicePTT:
    def __init__(self, timeout, on_transcript, tag="", double_trigger_stops=True,
                 lockout_seconds=0.5, on_timed_transcript=None, on_complete=None,
                 *, voice_service=None):
        self.service = voice_service or service
        self.consumer = self.service.register(tag, timeout, on_transcript,
            timed_callback=on_timed_transcript, completion=on_complete,
            lockout=lockout_seconds)
        self._double_trigger_stops = double_trigger_stops
        self._trigger_lock = threading.Lock()

    @property
    def state(self):
        return self.service.state(self.consumer)

    @property
    def is_recording(self):
        return self.state == "listening"

    def begin(self):
        return self.service.begin(self.consumer)

    def on_trigger(self):
        # Reserve before scheduling so repeated triggers cannot grow a thread
        # queue. Capture intent now: a late Finish must never start a new session.
        if not self._trigger_lock.acquire(blocking=False):
            return
        try:
            snapshot = self.service.diagnostics(include_details=False)
            finishing = snapshot['owner'] == self.consumer.tag and snapshot['state'] == 'listening'
            if not finishing and snapshot['state'] != 'idle':
                self._trigger_lock.release()
                return
            threading.Thread(target=self._on_trigger_worker,
                             args=(finishing, snapshot['session_id'], snapshot['sequence']), daemon=True,
                             name=f"voice-trigger:{self.consumer.tag}").start()
        except Exception:
            self._trigger_lock.release()
            raise

    def _on_trigger_worker(self, finishing, session_id, sequence):
        try:
            if finishing:
                if self._double_trigger_stops:
                    self.service.finish(self.consumer, session_id)
            else:
                self.service.begin(self.consumer, expected_sequence=sequence)
        finally:
            self._trigger_lock.release()

    def _on_trigger_sync(self):
        if self.is_recording:
            if self._double_trigger_stops:
                self.stop()
        else:
            self.begin()

    def stop(self):
        return self.service.finish(self.consumer)

    # Existing project controls use this name. It delegates to the service.
    _do_stop = stop

    def cancel(self, reason="cancelled"):
        return self.service.cancel(self.consumer, reason)

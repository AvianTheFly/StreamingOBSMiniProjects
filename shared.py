"""Shared hotkey, voice and music helpers used by mini-projects.

Project interface contracts and the live registry are re-exported from
lib.project_runtime for compatibility with existing `from shared import ...` code.
"""

import sys
import threading
import time
from lib.key_sequences import SequenceTrigger
# Compatibility exports: all callers share the same registry and interface types.
from lib.project_runtime import (
    ProjectInterface,
    ProjectStatus,
    _ProjectRegistry,
    project_registry,
)



# ── Push-to-talk voice helper ─────────────────────────────────────────────────
#
# Encapsulates the start-recording / stop-and-transcribe toggle used by every
# voice-driven mini-project.  Wire it up in a keyboard listener:
#
#     from shared import VoicePTT
#
#     ptt = VoicePTT(
#         timeout=10.0,
#         on_transcript=lambda text: input_queue.put(text),
#         tag="my_project",
#     )
#
#     def on_press(key):
#         try:
#             if key.char == PTT_KEY:
#                 ptt.on_trigger()
#         except AttributeError:
#             pass
#
#     # On shutdown:
#     ptt.cancel("shutdown")

class VoicePTT:
    """
    Push-to-talk over the hub's shared voice.listener.

    on_trigger()   → starts recording + arms an auto-transcribe timer.
                     If already recording and double_trigger_stops=True, stops and
                     transcribes immediately.
                     If double_trigger_stops=False, does nothing when already recording.
    cancel(reason) → discards in-progress audio without transcribing.

    Recording also auto-transcribes after `timeout` seconds.
    Only one project can record at a time — start_recording() is rejected if
    another project already owns the mic.

    States
    ------
    "idle"       — nothing in progress; trigger will start a new recording.
    "listening"  — mic is active, audio is being captured.
    "processing" — recording stopped, Whisper is transcribing in the background.
    """

    _STATE_IDLE       = "idle"
    _STATE_LISTENING  = "listening"
    _STATE_PROCESSING = "processing"

    # If Whisper somehow never calls back (edge case), auto-expire processing
    # state after this many seconds so the system doesn't get stuck.
    _PROCESSING_MAX_SECONDS = 30.0

    def __init__(
        self,
        timeout: float,
        on_transcript,
        tag: str = "",
        double_trigger_stops: bool = True,
        lockout_seconds: float = 0.5,
        on_timed_transcript=None,
    ) -> None:
        self._timeout              = timeout
        self._on_transcript        = on_transcript
        self._on_timed_transcript = on_timed_transcript
        self._recording_wall_time = None
        self._tag                  = tag
        self._double_trigger_stops = double_trigger_stops
        self._lockout_seconds      = lockout_seconds
        self._lockout_until        = 0.0   # monotonic timestamp; 0 = no lockout
        self._lock                 = threading.Lock()
        self._trigger_lock         = threading.Lock()
        self._recording            = False
        self._timer: threading.Timer | None = None
        self._state                = self._STATE_IDLE
        self._processing_started   = 0.0
        self._gen                  = 0     # increments on each _do_stop; guards stale callbacks

    @property
    def state(self) -> str:
        """Current state: 'idle', 'listening', or 'processing'."""
        with self._lock:
            if self._state == self._STATE_PROCESSING:
                # Auto-expire if Whisper never called back (should not happen normally)
                if time.monotonic() - self._processing_started > self._PROCESSING_MAX_SECONDS:
                    self._state = self._STATE_IDLE
            return self._state

    @property
    def is_recording(self) -> bool:
        with self._lock:
            return self._recording

    def on_trigger(self) -> None:
        """Start recording, or stop+transcribe if already recording and double_trigger_stops=True."""
        threading.Thread(
            target=self._on_trigger_worker,
            daemon=True,
            name=f"{self._tag or 'voice'}-ptt-trigger",
        ).start()

    def _on_trigger_worker(self) -> None:
        if not self._trigger_lock.acquire(blocking=False):
            return
        try:
            self._on_trigger_sync()
        finally:
            self._trigger_lock.release()

    def _on_trigger_sync(self) -> None:
        """Worker-side implementation for on_trigger()."""
        voice_mod = sys.modules.get("voice.listener")
        if voice_mod is None:
            print(f"[{self._tag}] Voice module not ready.")
            return

        # If already recording, stop+transcribe (double-trigger) or ignore
        if self.is_recording:
            if self._double_trigger_stops:
                self._do_stop()
            return

        # If Whisper is still running from a previous stop, note it but don't block —
        # the short lockout below handles the brief double-fire window.
        current_state = self.state
        if current_state == self._STATE_PROCESSING:
            print(f"[{self._tag}] Previous command still processing…")

        # Lockout window after the last stop — prevents accidental double-fire
        remaining = self._lockout_until - time.monotonic()
        if remaining > 0:
            print(f"[{self._tag}] Trigger too fast — wait {remaining:.1f}s")
            return

        with self._lock:
            try:
                pressed_at = time.time()
                started = voice_mod.start_recording(self._tag)
            except Exception as exc:
                print(f"[{self._tag}] start_recording raised: {exc}")
                return
            if not started:
                # voice module rejected — another project is already recording
                return
            self._recording = True
            self._recording_wall_time = pressed_at
            self._state     = self._STATE_LISTENING
            t = threading.Timer(self._timeout, self._do_stop)
            self._timer = t
            t.start()

        print(f"  [{self._tag}] Listening… (trigger again to send)")

    def _do_stop(self) -> None:
        """Stop recording and transcribe after a double-trigger or timeout."""
        voice_mod = sys.modules.get("voice.listener")
        with self._lock:
            if not self._recording:
                return
            self._recording          = False
            self._state              = self._STATE_PROCESSING
            self._processing_started = time.monotonic()
            self._gen               += 1
            my_gen                   = self._gen
            pressed_at               = self._recording_wall_time
            t = self._timer
            self._timer = None

        if t:
            t.cancel()
        self._lockout_until = time.monotonic() + self._lockout_seconds

        print(f"  [{self._tag}] Processing…")

        # Wrap the transcript callback so state transitions to idle when done.
        # Guard with generation counter: if a new recording starts before Whisper
        # finishes, the old callback must not clobber the new recording's state.
        def _on_transcript_done(text: str) -> None:
            with self._lock:
                if self._gen == my_gen:
                    self._state = self._STATE_IDLE
            if self._on_timed_transcript:
                self._on_timed_transcript(text, pressed_at)
            else:
                self._on_transcript(text)

        if voice_mod:
            voice_mod.stop_and_transcribe(_on_transcript_done, self._tag)

    def cancel(self, reason: str = "") -> None:
        """Discard any in-progress recording without transcribing."""
        voice_mod = sys.modules.get("voice.listener")

        with self._lock:
            if not self._recording:
                return
            self._recording = False
            self._state     = self._STATE_IDLE
            t               = self._timer
            self._timer     = None

        if t:
            t.cancel()
        if voice_mod:
            try:
                voice_mod.stop_and_transcribe(lambda _: None, self._tag)
            except Exception:
                pass
        if reason:
            print(f"  [{self._tag}] Recording cancelled ({reason}).")


# ── Music service (cross-project) ────────────────────────────────────────────
#
# specific_song registers its SongPlayer here on startup.
# Other projects call the API instead of touching OBS sources directly.
#
# NOTE: Prefer project_registry.pause_all(except_=my_name) over calling
# music_service directly — it coordinates ALL active projects, not just
# specific_song.  music_service is kept for backward-compat and for cases
# where only music needs to be paused.
#
#     # In specific_song/main.py:
#     from shared import music_service
#     music_service.register(player)
#
#     # In other projects (love_me, instant_replay, …):
#     from shared import project_registry
#     project_registry.pause_all(except_="my_project")
#     # … do work …
#     project_registry.resume_all(except_="my_project")

class _MusicService:
    """
    Thin facade over specific_song's SongPlayer.
    Registered once at startup; safe to call before registration (all methods
    are no-ops until register() is called).
    """

    def __init__(self) -> None:
        self._player = None

    def register(self, player) -> None:
        """Called by specific_song/main.py after creating the SongPlayer."""
        self._player = player
        print("[music_service] SongPlayer registered.")

    @property
    def is_playing(self) -> bool:
        return self._player is not None and self._player.is_busy

    def pause(self) -> None:
        """Pause the current song (preserves position for later resume)."""
        if self._player and self._player.is_busy:
            self._player.pause()

    def resume(self) -> None:
        """Resume a paused song — no-op if nothing is paused."""
        if self._player:
            self._player.resume()

    def stop(self) -> None:
        """Abort playback entirely (no auto-resume)."""
        if self._player and self._player.is_busy:
            self._player.abort()


music_service = _MusicService()

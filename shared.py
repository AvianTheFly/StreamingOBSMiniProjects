# shared.py
#
# Shared primitives available to every mini-project via  import shared .
# The hub root is always on sys.path, so this module is always importable.

import sys
import threading
import time
from dataclasses import dataclass, field


# ── Hotkey sequence trigger ───────────────────────────────────────────────────
#
# Any project that needs a typed key-sequence hotkey can use this directly:
#
#     from shared import SequenceTrigger
#     t = SequenceTrigger(["i", "l", "i"], 0.6)
#     if t.register_key(char):
#         handle_trigger()

class SequenceTrigger:
    """
    Fires when a specific sequence of characters is typed within
    max_interval seconds.  Returns True exactly once per completed sequence.
    """

    def __init__(self, sequence: list, max_interval: float) -> None:
        self.sequence     = [str(k) for k in sequence]
        self.max_interval = float(max_interval)
        self._buffer: list = []
        self._times:  list = []

    def reset(self) -> None:
        self._buffer.clear()
        self._times.clear()

    def register_key(self, key: str) -> bool:
        """Feed one character. Returns True if the full sequence just completed."""
        now = time.time()
        self._buffer.append(str(key))
        self._times.append(now)

        if len(self._buffer) > len(self.sequence):
            self._buffer.pop(0)
            self._times.pop(0)

        if self._buffer == self.sequence:
            elapsed = self._times[-1] - self._times[0]
            if elapsed <= self.max_interval:
                self.reset()
                return True

        return False


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
                     transcribes immediately (same as pressing 'C').
                     If double_trigger_stops=False, does nothing when already recording.
    cancel(reason) → discards in-progress audio without transcribing.

    Press 'C' at any time while recording to stop and transcribe immediately.
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
    ) -> None:
        self._timeout              = timeout
        self._on_transcript        = on_transcript
        self._tag                  = tag
        self._double_trigger_stops = double_trigger_stops
        self._lockout_seconds      = lockout_seconds
        self._lockout_until        = 0.0   # monotonic timestamp; 0 = no lockout
        self._lock                 = threading.Lock()
        self._recording            = False
        self._timer: threading.Timer | None = None
        self._kb_stop_listener     = None
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
                started = voice_mod.start_recording(self._tag)
            except Exception as exc:
                print(f"[{self._tag}] start_recording raised: {exc}")
                return
            if not started:
                # voice module rejected — another project is already recording
                return
            self._recording = True
            self._state     = self._STATE_LISTENING
            t = threading.Timer(self._timeout, self._do_stop)
            self._timer = t
            t.start()

        print(f"  [{self._tag}] Listening… (trigger again or 'C' to send)")
        # Arm the 'C' stop-key listener outside the lock
        self._arm_stop_listener()

    def _do_stop(self) -> None:
        """Stop recording and transcribe — called by 'C' key, double-trigger, or timeout."""
        voice_mod = sys.modules.get("voice.listener")
        with self._lock:
            if not self._recording:
                return
            self._recording          = False
            self._state              = self._STATE_PROCESSING
            self._processing_started = time.monotonic()
            self._gen               += 1
            my_gen                   = self._gen
            t = self._timer
            self._timer = None

        if t:
            t.cancel()
        self._disarm_stop_listener()
        self._lockout_until = time.monotonic() + self._lockout_seconds

        print(f"  [{self._tag}] Processing…")

        # Wrap the transcript callback so state transitions to idle when done.
        # Guard with generation counter: if a new recording starts before Whisper
        # finishes, the old callback must not clobber the new recording's state.
        def _on_transcript_done(text: str) -> None:
            with self._lock:
                if self._gen == my_gen:
                    self._state = self._STATE_IDLE
            self._on_transcript(text)

        if voice_mod:
            voice_mod.stop_and_transcribe(_on_transcript_done, self._tag)

    def _arm_stop_listener(self) -> None:
        """Start a background pynput listener that fires _do_stop when 'C' is pressed."""
        try:
            from pynput import keyboard as kb_mod
        except ImportError:
            return

        def on_press(key):
            try:
                if key.char == "C":
                    self._do_stop()
                    return False  # unregisters this listener from within
            except AttributeError:
                pass

        listener = kb_mod.Listener(on_press=on_press)
        with self._lock:
            self._kb_stop_listener = listener
        listener.start()

    def _disarm_stop_listener(self) -> None:
        """Stop and clear the 'C' key listener."""
        with self._lock:
            listener = self._kb_stop_listener
            self._kb_stop_listener = None
        if listener is not None:
            # Stop in a background thread to avoid deadlock when called
            # from within the listener's own on_press callback.
            threading.Thread(target=listener.stop, daemon=True).start()

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
        self._disarm_stop_listener()
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


# ── Project interface system (cross-project conflict resolution) ──────────────
#
# Each mini-project that touches OBS exposes a ProjectInterface singleton in
# its  interface.py  module.  The singleton auto-registers with project_registry
# on import so the hub and other projects can query live state and request
# clean reverts or pauses without reaching into project internals.
#
# Usage from another project:
#
#     from shared import project_registry
#
#     # Ask all other projects to pause before you start playing something:
#     project_registry.pause_all(except_="my_project")
#     player.play_async(source, on_complete=lambda: project_registry.resume_all(except_="my_project"))
#
#     # Emergency stop — revert ALL OBS state for conflicting projects:
#     project_registry.revert_all(except_="my_project")
#
#     # Check who owns the scenes you're about to touch:
#     conflicts = project_registry.conflicting_projects("my_project", ["My Scene"])
#
#     # Snapshot every project's live state:
#     for name, status in project_registry.get_all_status().items():
#         print(name, status)

@dataclass
class ProjectStatus:
    """Snapshot of a project's live state at the moment get_status() is called."""
    name:               str
    is_active:          bool                  # currently doing something visible in OBS?
    current_activity:   str | None            # human-readable, e.g. "playing: SongName"
    controlled_scenes:  list[str]             # OBS scenes this project may touch
    can_revert:         bool                  # True if revert() is implemented


class ProjectInterface:
    """
    Base class every mini-project interface implements.

    Each project creates one subclass, instantiates it at module level in
    interface.py, and calls  project_registry.register(interface)  on creation.
    The project's main.py populates a module-level  _live  dict with live
    references (player objects, state flags, callables) so get_status(),
    revert(), pause(), and resume() have something to work with at runtime.

    Implementing pause() / resume()
    --------------------------------
    Override these if your project supports temporary suspension:
      - pause() should stop visible activity without hiding/reverting OBS state.
      - resume() should pick up where pause() left off.
    Projects that don't support pause leave the default no-ops in place.
    """
    name:              str       = ""
    controlled_scenes: list[str] = []

    def get_status(self) -> ProjectStatus:
        raise NotImplementedError

    def revert(self) -> None:
        """Stop all activity and restore OBS to a clean state."""
        raise NotImplementedError

    def pause(self) -> None:
        """
        Temporarily pause activity without reverting OBS state.
        Called by project_registry.pause_all() when another project needs focus.
        Default: no-op (projects that don't support pause are unaffected).
        """
        pass

    def resume(self) -> None:
        """
        Resume after a pause() call.
        Called by project_registry.resume_all() when the other project finishes.
        Default: no-op.
        """
        pass


class _ProjectRegistry:
    """
    Central registry of all ProjectInterface singletons.

    Populated automatically when each project's interface.py is imported.
    The hub imports all interface modules after project discovery so the
    registry is fully populated before any run() threads are started.
    """

    def __init__(self) -> None:
        self._ifaces: dict[str, ProjectInterface] = {}
        self._lock   = threading.Lock()

    def register(self, iface: ProjectInterface) -> None:
        with self._lock:
            self._ifaces[iface.name] = iface

    def get(self, name: str) -> ProjectInterface | None:
        with self._lock:
            return self._ifaces.get(name)

    def all(self) -> list[ProjectInterface]:
        with self._lock:
            return list(self._ifaces.values())

    def get_all_status(self) -> dict[str, ProjectStatus]:
        """Return a {name: ProjectStatus} snapshot for every registered project."""
        result: dict[str, ProjectStatus] = {}
        for iface in self.all():
            try:
                result[iface.name] = iface.get_status()
            except Exception as exc:
                print(f"[registry] get_status failed for '{iface.name}': {exc}")
        return result

    def conflicting_projects(self, requester: str, scenes: list[str]) -> list[str]:
        """
        Return names of OTHER currently active projects that share any of
        the given OBS scenes.  An empty list means it is safe to proceed.
        """
        scene_set = set(scenes)
        conflicts: list[str] = []
        for iface in self.all():
            if iface.name == requester:
                continue
            try:
                status = iface.get_status()
                if status.is_active and scene_set & set(iface.controlled_scenes):
                    conflicts.append(iface.name)
            except Exception:
                pass
        return conflicts

    def revert_all(self, except_: str | None = None) -> None:
        """
        Call revert() on every registered project, optionally skipping one.

        Use for emergency stop or when a project needs exclusive OBS ownership.
        """
        for iface in self.all():
            if iface.name == except_:
                continue
            try:
                iface.revert()
            except Exception as exc:
                print(f"[registry] revert failed for '{iface.name}': {exc}")

    def pause_all(self, except_: str | None = None) -> None:
        """
        Ask every registered project to pause (non-destructive suspension).

        Projects that don't implement pause() are unaffected (default is no-op).
        Use this when a project temporarily needs audio/visual focus and wants
        to resume other projects when it finishes.

        Pattern:
            project_registry.pause_all(except_="my_project")
            player.play_async(src, on_complete=lambda: project_registry.resume_all(except_="my_project"))
        """
        for iface in self.all():
            if iface.name == except_:
                continue
            try:
                iface.pause()
            except Exception as exc:
                print(f"[registry] pause failed for '{iface.name}': {exc}")

    def resume_all(self, except_: str | None = None) -> None:
        """
        Ask every registered project to resume after a pause_all().

        Projects that were idle (didn't need to pause) treat this as a no-op.
        """
        for iface in self.all():
            if iface.name == except_:
                continue
            try:
                iface.resume()
            except Exception as exc:
                print(f"[registry] resume failed for '{iface.name}': {exc}")


project_registry = _ProjectRegistry()

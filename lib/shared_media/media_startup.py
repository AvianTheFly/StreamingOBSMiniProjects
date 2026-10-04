"""Serialize decoder startup across native media modules, not entire playback.

OBS accepting a filename does not mean its decoder is ready. Hold the loading
slot through setup and initial playback progress, so two hotkeys cannot launch
competing decoder startups. OBS rendering/playback continues while we wait.
"""
from contextlib import contextmanager
import threading
import time

import obs
from lib.performance_monitor import note_media_load

_load_lock = threading.Lock()
_waiter_lock = threading.Lock()
_foreground_waiters = 0


class MediaStartupCancelled(RuntimeError):
    pass


@contextmanager
def media_startup(source: str, *, cancelled=lambda: False, timeout: float = 5):
    global _foreground_waiters
    note_media_load(source, 'queued')
    deadline = time.monotonic() + max(1, timeout)
    with _waiter_lock:
        _foreground_waiters += 1
    try:
        while not _load_lock.acquire(timeout=0.05):
            if cancelled():
                raise MediaStartupCancelled('Playback replaced while waiting to load')
            if time.monotonic() >= deadline:
                raise TimeoutError('Another media source is still loading; no new decoder started')
    finally:
        with _waiter_lock:
            _foreground_waiters -= 1
    started = time.monotonic()
    note_media_load(source, 'loading')
    try:
        if cancelled():
            raise MediaStartupCancelled('Playback replaced before loading')
        yield
        deadline = time.monotonic() + max(1, timeout)
        # A STOP/file update can be acknowledged before its decoder processes
        # it. Require a moving media clock, not merely a PLAYING flag.
        previous = None
        while time.monotonic() < deadline:
            if cancelled():
                raise MediaStartupCancelled('Playback replaced while loading')
            state = obs.get_media_status(source)
            cursor = state.get('cursor_ms')
            if state.get('state') == 'OBS_MEDIA_STATE_PAUSED' and isinstance(cursor, (int, float)):
                # A coordinator/user pause is intentional, not a failed load.
                break
            if isinstance(cursor, (int, float)):
                if previous is not None and cursor > previous:
                    break
                duration = state.get('duration_ms')
                if (previous is not None and state.get('state') == 'OBS_MEDIA_STATE_ENDED'
                        and isinstance(duration, (int, float)) and 0 < duration <= cursor):
                    break  # A very short effect finished between observations.
                previous = cursor
            time.sleep(0.04)
        else:
            raise TimeoutError(f"OBS did not report playback progress for '{source}'")
    except Exception:
        note_media_load(source, 'failed_or_cancelled')
        # Do not release the gate with a failed startup still decoding.
        obs.stop_media(source)
        raise
    finally:
        elapsed = time.monotonic() - started
        _load_lock.release()
        note_media_load(source, 'released')
        if elapsed >= 0.5:
            print(f"[media-load] '{source}' startup took {elapsed:.2f}s")


@contextmanager
def background_media_slot(stop_event):
    """Share the startup gate; waiting live requests precede background work.

Callers hold a slot for one small read/probe, then release it before pacing.
Shutdown yields False instead of starting more background I/O.
"""
    acquired = False
    while not stop_event.is_set():
        if _load_lock.acquire(timeout=.05):
            with _waiter_lock:
                live_waiting = _foreground_waiters > 0
            if not live_waiting:
                acquired = True
                break
            _load_lock.release()
        stop_event.wait(.05)
    try:
        yield acquired and not stop_event.is_set()
    finally:
        if acquired:
            _load_lock.release()

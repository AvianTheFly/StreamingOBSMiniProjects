"""Replay desktop-audio suspension and verified restoration."""
from __future__ import annotations
import time
import threading
from functools import wraps
import obs
from obs import set_input_mute
from .config import DESKTOP_AUDIO_INPUT

_audio_lock = threading.RLock()

def _serialized(fn):
    @wraps(fn)
    def guarded(*args, **kwargs):
        with _audio_lock:
            return fn(*args, **kwargs)
    return guarded

_is_muted = False
_desktop_was_muted = False


@_serialized
def _mute_desktop() -> None:
    """Mute Desktop Audio for replay playback."""
    global _is_muted, _desktop_was_muted
    if _is_muted:
        return
    try:
        _desktop_was_muted = bool(obs.get_input_mute(DESKTOP_AUDIO_INPUT))
        _is_muted = True
        set_input_mute(DESKTOP_AUDIO_INPUT, True)
        print('[instant_replay] 🔇 Desktop audio muted.')
    except Exception as exc:
        print(f'[instant_replay] ⚠  Could not mute desktop audio: {exc}')

@_serialized
def _unmute_desktop(*, force: bool=False, attempts: int=4) -> bool:
    """Force Desktop Audio on and verify OBS accepted it.

    ``force`` is used by every replay-finish path, including duplicate/racing
    cleanup calls.  This intentionally restores audio to unmuted rather than
    trusting the pre-replay state: the desired post-replay invariant is that
    global Desktop Audio is on.
    """
    global _is_muted
    if not force and (not _is_muted):
        return True
    attempts = max(1, attempts)
    for attempt in range(attempts):
        try:
            set_input_mute(DESKTOP_AUDIO_INPUT, False)
            actual = obs.get_input_mute(DESKTOP_AUDIO_INPUT)
            if actual is False:
                _is_muted = False
                print('[instant_replay] 🔊 Desktop audio verified unmuted.')
                return True
        except Exception as exc:
            print(f'[instant_replay] Audio restore attempt failed: {exc}')
        if attempt + 1 < attempts:
            time.sleep(0.25)
    _is_muted = True
    print('[instant_replay] ⚠  Desktop audio unmute could not be verified.')
    return False

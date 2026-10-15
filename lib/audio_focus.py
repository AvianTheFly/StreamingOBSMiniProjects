"""Scoped background-audio interruption contract; providers own playback policy.

Source workers acquire just before audible startup and release after cleanup.
No feature imports, worker, OS media connection or settings writes live here.
"""
import threading
from lib.media_metadata import probe_media

_lock = threading.Lock()
_provider = None


def register(provider):
    global _provider
    with _lock:
        _provider = provider
    return provider


def unregister(provider):
    global _provider
    with _lock:
        if _provider is provider:
            _provider = None


def interrupt_audio(path, *, cancelled=lambda: False, music=False):
    """Return an idempotent release callback, including unavailable providers.

    Unknown metadata leaves background music alone. A cancelled request never
    starts a new interruption. Provider calls occur outside the registry lock.
    """
    with _lock:
        provider = _provider
    if provider is None or cancelled():
        return lambda: None
    try:
        audible = probe_media(path).has_audio
    except Exception:
        audible = False
    if not audible or cancelled():
        return lambda: None
    try:
        release = provider.acquire_music(cancelled) if music else provider.acquire(cancelled)
    except Exception as exc:
        if music:
            raise
        print(f'[audio-focus] Interruption unavailable: {exc}')
        return lambda: None
    released = False
    release_lock = threading.Lock()

    def finish():
        nonlocal released
        with release_lock:
            if released:
                return
            released = True
        try:
            release()
        except Exception as exc:
            print(f'[audio-focus] Release failed: {exc}')
    return finish

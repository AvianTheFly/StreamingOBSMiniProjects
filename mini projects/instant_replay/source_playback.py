"""Replay source loading and confirmation of actual playback progress."""
from __future__ import annotations
import time
import obs
from lib.shared_media.media_startup import media_startup
from lib.shared_media.media_startup import MediaStartupCancelled
from obs import set_media_source_file
from obs import restart_media
from obs import stop_media
from .config import SCENE
from .config import SOURCE_NAME
from .audio import _mute_desktop


def _start_replay_clip(clip_path, cancelled, session, fader, labels, *, hold=False):
    """Share decoder startup admission with music/effects, then release for playback."""
    from . import library
    with media_startup(SOURCE_NAME, cancelled=cancelled.is_set, timeout=8):
        obs.configure_media_source_properties(SOURCE_NAME, restart_on_activate=False, close_when_inactive=False, looping=False, clear_on_media_end=False)
        obs.hide_source(SCENE, SOURCE_NAME)
        stop_media(SOURCE_NAME)
        fader.capture()
        set_media_source_file(SOURCE_NAME, str(clip_path))
        volume_source = library.volume_source(clip_path, labels, fader.values())
        fader.apply(clip_path, fallback=volume_source)
        preloaded = not session.activated
        # Decode while hidden for both entry and handoff. Showing an advancing
        # media input during handoff can expose its opening audio twice.
        if not wait_for_replay_start(SOURCE_NAME, cancelled):
            if cancelled.is_set():
                raise MediaStartupCancelled('Replay cancelled while preparing')
            raise TimeoutError(f'Clip could not prepare: {clip_path.name}')
        if preloaded or hold:
            hold_first_frame(cancelled)
        if preloaded:
            # Keep the game on program while this hidden decoder gets ready.
            # The same worker holds frame one until the short scene move ends.
            from . import stage
            stage.entering()
            obs.show_source(SCENE, SOURCE_NAME)
        if cancelled.is_set() or not session.activate():
            raise MediaStartupCancelled('Replay cancelled or scene ownership changed')
        # A long OBS stinger must finish before the clip's first moment starts.
        # Use this physical source's worker, with cancellation and lease checks.
        wait_for_stage_entry(session, cancelled)
        if not preloaded:
            obs.show_source(SCENE, SOURCE_NAME)
        _mute_desktop()


def hold_first_frame(cancelled, timeout=2):
    """Wait for OBS's asynchronous seek before presenting or revealing a cut."""
    obs.pause_media(SOURCE_NAME)
    obs.get_obs().set_media_input_cursor(SOURCE_NAME, 0)
    deadline=time.monotonic()+timeout
    previous=None
    while not cancelled.is_set() and time.monotonic()<deadline:
        status=obs.get_media_status(SOURCE_NAME)
        cursor=status.get('cursor_ms')
        if status.get('state')=='OBS_MEDIA_STATE_PAUSED' and isinstance(cursor,(int,float)) and 0<=cursor<=150:
            if cursor==previous:
                return
            previous=cursor
        else:
            previous=None
        cancelled.wait(.05)
    if cancelled.is_set():
        raise MediaStartupCancelled('Replay cancelled while preparing the first frame')
    raise TimeoutError('The replay decoder did not settle on its first frame')


def wait_for_stage_entry(session, cancelled, timeout=12):
    deadline = time.monotonic() + timeout
    while not cancelled.wait(.08):
        if not session.owns_scene():
            raise MediaStartupCancelled('Scene changed during replay transition')
        cursor = obs.get_obs().get_current_scene_transition_cursor().transition_cursor
        remaining = session.entry_transition_remaining() if callable(getattr(session, 'entry_transition_remaining', None)) else 0
        if (not isinstance(remaining, (int, float)) or remaining <= 0) and (cursor <= 0 or cursor >= 1):
            return
        if time.monotonic() >= deadline:
            raise TimeoutError('OBS replay transition did not finish')
    raise MediaStartupCancelled('Replay cancelled during transition')

def wait_for_replay_start(source, cancelled, timeout=8.0):
    """Require advancing PLAYING samples; stale ENDED cursors are not starts."""
    if cancelled.wait(0.2):
        return False
    restart_media(source)
    deadline = time.monotonic() + timeout
    retry_at = time.monotonic() + 1.0
    last_cursor = None
    while time.monotonic() < deadline and (not cancelled.is_set()):
        status = obs.get_media_status(source) or {}
        state, cursor = (status.get('state'), status.get('cursor_ms'))
        if state == 'OBS_MEDIA_STATE_PLAYING' and isinstance(cursor, (int, float)):
            if last_cursor is not None and cursor > last_cursor:
                return True
            last_cursor = cursor
        else:
            last_cursor = None
        if retry_at is not None and time.monotonic() >= retry_at and (state in ('OBS_MEDIA_STATE_STOPPED', 'OBS_MEDIA_STATE_ENDED', 'OBS_MEDIA_STATE_NONE')):
            restart_media(source)
            retry_at = None
        cancelled.wait(0.1)
    return False

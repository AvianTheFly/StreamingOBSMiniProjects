"""Replay presentation state; the playback owner publishes complete snapshots."""
from __future__ import annotations

import copy
import threading
import time
from pathlib import Path

from . import presentation, stage_settings

FRESH_SECONDS = 5 * 60
_lock = threading.RLock()
_installed = False
_covered = threading.Event()
_revealed = threading.Event()
_availability_at = 0.0
_capture = dict(status='idle', purpose='', seconds=0, path='', message='')
_state = dict(active=False, pending=False, kind='clip', mode='showcase', title='', context='',
              clip_path='', purpose='highlight',
              index=0, total=0, companion=False, view='off', phase='idle',
              cursor_ms=0, duration_ms=0, paused=False, sampled_at=0,
              revision=0, next_title='', return_label='', motion=True,
              live_available=False, live_online=False, camera_available=False, camera_online=False,
              camera=True, clip_transition='iris', handoff=False,
              settings=copy.deepcopy(stage_settings.DEFAULTS))


def classify(paths, *, now=None, force_replay=False):
    if force_replay:
        return 'replay'
    if len(paths) != 1:
        return 'highlights' if paths else 'clips'
    from . import library
    path = Path(paths[0])
    meta = library.read()['clips'].get(library.clip_id(path), {})
    try:
        saved = float(meta.get('saved_at') or path.stat().st_mtime)
    except OSError:
        return 'clip'
    return 'replay' if 0 <= (time.time() if now is None else now) - saved <= FRESH_SECONDS else 'clip'


def state():
    with _lock:
        value = copy.deepcopy(_state)
        value['cue'] = dict(revision=_state['revision'], covered=_covered.is_set(), revealed=_revealed.is_set())
        value['capture'] = dict(_capture)
    value['layout'] = presentation.layout(value['view'], value['camera'])
    return value


def capture_update(status, *, purpose='', seconds=0, path='', message=''):
    with _lock:
        _capture.update(status=status, purpose=purpose, seconds=seconds, path=path, message=message)


def install():
    global _installed
    from . import obs_stage
    settings = stage_settings.read()
    available = obs_stage.install()
    _installed = True
    with _lock:
        _state.update(settings=settings, motion=settings['motion'], **available)
    apply_layout()


def configure(changes):
    settings = stage_settings.save(changes)
    with _lock:
        _state.update(settings=settings, motion=settings['motion'])
        mode = _state['mode']
        view = settings[mode]['companion']
        _state.update(view=view, companion=view != 'off', camera=settings[mode]['camera'],
                      clip_transition=settings[mode]['clip_transition'])
    apply_layout()
    return state()


def set_view(view):
    if view not in ('live', 'desktop', 'off'):
        raise ValueError('Choose live, desktop or off.')
    with _lock:
        mode = _state['mode']
    return configure({mode: {'companion': view}})


def set_companion(enabled):
    """Compatibility voice control for the gated desktop companion."""
    return set_view('desktop' if enabled else 'off')


def begin(kind, *, in_game=False, mode=None, return_label=''):
    with _lock:
        mode = presentation.mode_for(kind, in_game=in_game, requested=mode)
        prefs = _state['settings'][mode]
        view = prefs['companion']
        _state.update(mode=mode, kind=kind, view=view, companion=view != 'off',
                      camera=prefs['camera'], clip_transition=prefs['clip_transition'],
                      return_label=return_label, motion=_state['settings']['motion'])
    return presentation.transition_for(prefs['transition'])


def start(kind, title, index, total, *, context='', next_title='', handoff=False, clip_path='', purpose='highlight'):
    with _lock:
        _covered.clear()
        _revealed.clear()
        _state.update(active=True, kind=kind, title=title[:160], context=context,
                      clip_path=clip_path, purpose=purpose,
                      index=index, total=total, phase='covering' if handoff else 'loading',
                      handoff=handoff, next_title=next_title,
                      cursor_ms=0, duration_ms=0, paused=False, sampled_at=time.time(),
                      revision=_state['revision'] + 1)
    apply_layout()


def sync_labels(data):
    """Reconcile a completed library edit with the currently displayed clip."""
    from . import library
    with _lock:
        path=_state['clip_path']
        if not _state['active'] or not path:
            return
        meta=data['clips'].get(library.clip_id(path), {})
        title,context=presentation.clip_copy(path,meta)
        _state.update(title=title,context=context,purpose='highlight' if library.highlight_candidate(meta) else 'replay_only')


def entering():
    with _lock:
        _state['phase'] = 'entering'


def playing():
    with _lock:
        _state['phase'] = 'playing'
    _set_cover(False)


def acknowledge_cover(revision):
    return acknowledge_cue(revision, 'covered')


def acknowledge_cue(revision, event):
    """Only the current OBS browser cue can acknowledge its opaque frame."""
    with _lock:
        expected = {'covered': 'covering', 'revealed': 'revealing'}.get(event)
        if not _state['active'] or _state['phase'] != expected or revision != _state['revision']:
            return False
        (_covered if event == 'covered' else _revealed).set()
        return True


def cover_for_swap(cancelled, valid, timeout=1.6):
    """Wait on this playback worker; the native matte also covers a lost browser."""
    deadline = time.monotonic() + timeout
    while not _covered.is_set():
        if cancelled.is_set() or not valid():
            return False
        if time.monotonic() >= deadline:
            break
        _covered.wait(.05)
    if cancelled.is_set() or not valid():
        return False
    _set_cover(True)
    with _lock:
        _state['phase'] = 'loading'
    return True


def reveal_for_play(cancelled, valid, timeout=1.8):
    with _lock:
        _state['phase'] = 'revealing'
    _set_cover(False)
    deadline = time.monotonic() + timeout
    while not _revealed.is_set():
        if cancelled.is_set() or not valid():
            return False
        if time.monotonic() >= deadline:
            break
        _revealed.wait(.05)
    return not cancelled.is_set() and valid()


def _set_cover(enabled):
    if _installed:
        from . import obs_stage
        obs_stage.set_cover(enabled)


def waiting(enabled):
    with _lock:
        _state['pending'] = bool(enabled)
        if not _state['active']:
            _state['phase'] = 'saving' if enabled else 'idle'


def progress(status, *, paused=False):
    global _availability_at
    with _lock:
        if not _state['active']:
            return
        for key in ('cursor_ms', 'duration_ms'):
            value = status.get(key)
            if isinstance(value, (int, float)):
                _state[key] = max(0, value)
        _state.update(paused=paused, sampled_at=time.time())
    if _installed and time.monotonic() >= _availability_at:
        _availability_at = time.monotonic() + 2
        from . import obs_stage
        available = obs_stage.availability()
        with _lock:
            _state.update(available)


def returning():
    with _lock:
        _state.update(phase='returning', paused=True)


def finish():
    with _lock:
        _state.update(active=False, title='', context='', index=0, total=0,
                      clip_path='', purpose='highlight',
                      phase='idle', cursor_ms=0, duration_ms=0, next_title='',
                      paused=False, handoff=False, sampled_at=time.time())
    _set_cover(False)
    apply_layout()


def apply_layout():
    if not _installed:
        return
    from . import obs_stage
    obs_stage.apply(state())

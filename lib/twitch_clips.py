"""Create a 60-second Twitch clip alongside a manual OBS save, off the UI thread."""
import os
import threading
import time

import requests
from lib.twitch_clip_session import clip_sessions
from lib.twitch_clips_titles import clip_title

_lock = threading.Lock()
_state = {'status': 'idle', 'message': '', 'url': ''}
_thread = None
_next_request = 0.0
_callbacks = []
COOLDOWN_SECONDS = 90
CLIP_SECONDS = 60
MAX_CALLBACKS = 32


def status():
    with _lock:
        return dict(_state)


def _set(state, message, url=''):
    with _lock:
        _state.update(status=state, message=message, url=url)
    from events import inspect_event
    inspect_event('twitch.clip', owner='twitch_clips', phase=state)


def request_clip(*, title='', on_complete=None, reuse=False):
    """One create per window; chat may observe the existing result without a POST."""
    global _thread, _next_request
    existing = None
    with _lock:
        if (_state['status'] == 'pending' or (_thread and _thread.is_alive())
                or time.monotonic() < _next_request):
            if not reuse or on_complete is None:
                return False
            if _state['status'] == 'pending':
                if len(_callbacks) >= MAX_CALLBACKS:
                    return False
                _callbacks.append(on_complete)
                return True
            existing = dict(_state)
            failed = False
        else:
            _next_request = time.monotonic() + COOLDOWN_SECONDS
            _state.update(status='pending', message='Creating a 60-second Twitch clip…',
                          url='', title='', duration=None)
            _callbacks.clear()
            if on_complete:
                _callbacks.append(on_complete)
            try:
                _thread = threading.Thread(target=_run, args=(title,),
                                           daemon=True, name='twitch-clip')
                _thread.start()
            except Exception:
                _thread = None
                _callbacks.clear()
                failed = True
            else:
                failed = False
    if existing is not None:
        _notify(on_complete, existing)
    if failed:
        _set('error', 'Could not start Twitch clipping. The OBS save is unaffected.')
        return False
    return True


def join():
    """Hub shutdown signals the session first, then reaps its bounded request."""
    with _lock:
        worker = _thread
    if worker:
        worker.join(20)


def _notify(callback, result):
    try:
        callback(result)
    except Exception:
        pass  # Chat delivery cannot invalidate a published clip.


def _run(title):
    _worker(title)
    with _lock:
        callbacks, result = list(_callbacks), dict(_state)
        _callbacks.clear()
    for callback in callbacks:
        _notify(callback, dict(result))


def _worker(title=''):
    try:
        twitch = clip_sessions.get()
        if twitch is None or twitch.stop.is_set():
            _set('error', 'Twitch clipping is unavailable.')
            return
        if not twitch.available():
            _set('error', 'Connect Twitch in Twitch Celebrations to enable clips. The OBS save is unaffected.')
            return
        headers = {'Client-Id': os.environ['TWITCH_CLIENT_ID'],
                   'Authorization': 'Bearer ' + twitch.token()}
        broadcaster = os.environ['TWITCH_BROADCASTER_ID']
        channel = {}
        try:
            context = requests.get('https://api.twitch.tv/helix/channels', headers=headers,
                                   params={'broadcaster_id': broadcaster}, timeout=5)
            context.raise_for_status()
            channel = next(iter(context.json().get('data', [])), {})
        except Exception:
            pass  # Missing title context must not prevent capturing the moment.
        if twitch.stop.is_set():
            _set('error', 'Twitch clipping stopped before creation. The OBS save is unaffected.')
            return
        title = clip_title(title, channel=channel)
        with _lock:
            _state['title'] = title
        # No replay timestamps or durations: Twitch owns the capture window.
        response = requests.post('https://api.twitch.tv/helix/clips', headers=headers,
                                 params={'broadcaster_id': broadcaster,
                                         'duration': CLIP_SECONDS, 'title': title}, timeout=15)
        if response.status_code == 401:
            _set('error', 'Reconnect Twitch in Twitch Celebrations to allow clip creation. The OBS save is unaffected.')
            return
        if response.status_code in (403, 404):
            _set('error', 'Twitch clipping requires a live channel with clips enabled. The OBS save is unaffected.')
            return
        response.raise_for_status()
        clip_id = response.json()['data'][0]['id']
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline and not twitch.stop.wait(2):
            response = requests.get('https://api.twitch.tv/helix/clips', headers=headers,
                                    params={'id': clip_id}, timeout=10)
            response.raise_for_status()
            clips = response.json().get('data', [])
            if clips:
                clip = clips[0]
                duration = float(clip['duration'])
                with _lock:
                    _state['duration'] = duration
                if not CLIP_SECONDS - .1 <= duration <= CLIP_SECONDS + .1:
                    _set('error', f'Twitch published only {duration:g}s of the requested 60s. '
                         'No duplicate was created; check Twitch Clips Manager. The OBS save is unaffected.', clip['url'])
                else:
                    _set('ready', f'Twitch clip ready ({duration:g}s).', clip['url'])
                return
        _set('error', 'Twitch did not confirm the clip. Check Twitch Clips Manager before retrying.')
    except Exception:
        # Never print request/authorization objects or interfere with local saving.
        _set('error', 'Twitch clip could not be confirmed. Check Twitch Clips Manager; the OBS save is unaffected.')

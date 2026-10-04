"""Create a 60-second Twitch clip alongside a manual OBS save, off the UI thread."""
import os
import threading
import time

import requests
from lib.twitch_clip_session import clip_sessions

_lock = threading.Lock()
_state = {'status': 'idle', 'message': '', 'url': ''}


def status():
    with _lock:
        return dict(_state)


def _set(state, message, url=''):
    with _lock:
        _state.update(status=state, message=message, url=url)
    from events import inspect_event
    inspect_event('twitch.clip', owner='twitch_clips', phase=state)


def request_clip():
    with _lock:
        if _state['status'] == 'pending':
            return
        _state.update(status='pending', message='Creating a 60-second Twitch clip…', url='')
    from events import inspect_event
    inspect_event('twitch.clip', owner='twitch_clips', phase='pending')
    try:
        threading.Thread(target=_worker, daemon=True, name='twitch-clip').start()
    except Exception:
        _set('error', 'Could not start Twitch clipping. The OBS save is unaffected.')


def _worker():
    try:
        twitch = clip_sessions.get()
        if twitch is None or not twitch.available():
            _set('error', 'Connect Twitch in Twitch Celebrations to enable clips. The OBS save is unaffected.')
            return
        headers = {'Client-Id': os.environ['TWITCH_CLIENT_ID'],
                   'Authorization': 'Bearer ' + twitch.token()}
        # No replay timestamps or durations: Twitch owns the capture window.
        response = requests.post('https://api.twitch.tv/helix/clips', headers=headers,
                                 params={'broadcaster_id': os.environ['TWITCH_BROADCASTER_ID'],
                                         'duration': 60, 'title': 'Instant Replay'}, timeout=15)
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
                _set('ready', f"Twitch clip ready ({clip['duration']:g}s).", clip['url'])
                return
        _set('error', 'Twitch did not confirm the clip. Check Twitch Clips Manager before retrying.')
    except Exception:
        # Never print request/authorization objects or interfere with local saving.
        _set('error', 'Twitch clip could not be confirmed. Check Twitch Clips Manager; the OBS save is unaffected.')

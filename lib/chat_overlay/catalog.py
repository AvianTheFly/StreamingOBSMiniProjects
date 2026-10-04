"""Public emote catalogs, cached and isolated so provider outages are harmless."""
import concurrent.futures
import json
import os
from pathlib import Path
import threading
import time
import requests

_cache = {}
_lock = threading.Lock()


def _get(url, headers=None):
    response = requests.get(url, headers=headers, timeout=8)
    response.raise_for_status()
    return response.json()


def _seven(data):
    result = {}
    for item in data.get('emotes', []):
        host = item.get('data', {}).get('host', {})
        files = host.get('files', [])
        file = next((f for f in files if f.get('name') == '2x.webp'), None)
        if file:
            base = host.get('url', '')
            if base.startswith('//'):
                base = 'https:' + base
            if base.startswith('https://'):
                result[item['name']] = dict(url=base + '/' + file['name'],
                                           zero_width=bool(item.get('flags', 0) & 1 or item.get('data', {}).get('flags', 0) & 256), provider='7TV')
    return result


def _bttv(data):
    items = data if isinstance(data, list) else data.get('channelEmotes', []) + data.get('sharedEmotes', [])
    return {e['code']: dict(url=f"https://cdn.betterttv.net/emote/{e['id']}/2x", provider='BTTV') for e in items}


def _ffz(data):
    result = {}
    for group in data.get('sets', {}).values():
        for e in group.get('emoticons', []):
            urls = e.get('animated') or e.get('urls', {})
            url = urls.get('2') or urls.get('1')
            if url:
                result[e['name']] = dict(url='https:' + url if url.startswith('//') else url, provider='FFZ')
    return result


def _badges(channel_id):
    client = os.environ.get('TWITCH_CLIENT_ID')
    root = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'StreamingHub'
    token = None
    for folder in ('twitch-celebrations', 'viewer-rewards'):
        try:
            token = json.loads((root / folder / 'credentials.json').read_text()).get('access_token')
        except (OSError, ValueError):
            continue
        if token:
            break
    if not token or not client:
        return {}
    headers = {'Client-ID': client, 'Authorization': 'Bearer ' + token}
    urls = ['https://api.twitch.tv/helix/chat/badges/global']
    if channel_id:
        urls.append('https://api.twitch.tv/helix/chat/badges?broadcaster_id=' + channel_id)
    result = {}
    for url in urls:
        for badge in _get(url, headers).get('data', []):
            for v in badge['versions']:
                result[badge['set_id'] + '/' + v['id']] = v['image_url_2x']
    return result


def _remote_catalog(channel, channel_id=''):
    key = channel, channel_id
    with _lock:
        if key in _cache and time.monotonic() - _cache[key][0] < 300:
            return _cache[key][1]
        jobs = {
            'BTTV global': lambda: _bttv(_get('https://api.betterttv.net/3/cached/emotes/global')),
            'FFZ global': lambda: _ffz(_get('https://api.frankerfacez.com/v1/set/global')),
            '7TV global': lambda: _seven(_get('https://7tv.io/v3/emote-sets/global')),
            'FFZ channel': lambda: _ffz(_get('https://api.frankerfacez.com/v1/room/' + channel)),
            'Twitch badges': lambda: _badges(channel_id),
        }
        if channel_id:
            jobs.update({
                'BTTV channel': lambda: _bttv(_get('https://api.betterttv.net/3/cached/users/twitch/' + channel_id)),
                '7TV channel': lambda: _seven(_get('https://7tv.io/v3/users/twitch/' + channel_id).get('emote_set') or {}),
            })
        result = dict(emotes={}, badges={}, providers={})
        with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
            futures = {name: pool.submit(job) for name, job in jobs.items()}
            # Stable precedence: channel overrides global, 7TV overrides BTTV/FFZ.
            for name, future in futures.items():
                try:
                    values = future.result()
                    result['badges' if name == 'Twitch badges' else 'emotes'].update(values)
                    result['providers'][name] = f'{len(values)} loaded'
                except Exception:
                    result['providers'][name] = 'Unavailable or no set; retry in 5 minutes'
        _cache[key] = time.monotonic(), result
        return result


def catalog(channel, channel_id=''):
    # A local pack survives provider outages and updates independently of remote caches.
    from .chaos_pack import catalog_entries
    emotes, aliases, title = catalog_entries()
    remote = _remote_catalog(channel, channel_id)
    return dict(emotes={**remote['emotes'], **emotes}, badges=remote['badges'],
                providers={**remote['providers'], title: f'{len(emotes)} animated codes installed'},
                pack=dict(title=title, emotes=emotes, aliases=aliases))

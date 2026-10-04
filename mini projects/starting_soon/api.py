from . import interface as runtime
from . import settings, clip_library


def state():
    if not runtime._service:
        return {**settings.read(), 'ready': False, 'active': False, 'playing': False,
                'error': 'Starting Soon module is offline.', 'available_artwork': []}
    return runtime._service.snapshot()


def save(body):
    current = settings.read()
    known = {p for item in current['playlists'] for p in item['paths']}
    proposed = body.get('playlist', [])
    if 'playlists' in body and isinstance(body['playlists'],list):
        proposed = [p for item in body['playlists'] if isinstance(item,dict) and isinstance(item.get('paths'),list)
                    for p in item['paths']]
    if isinstance(proposed,list):
        added = list(dict.fromkeys(p for p in proposed if isinstance(p,str) and p not in known))
        if added:
            clip_library.resolve(added)
    result = settings.save(body)
    if body.get('highlights_enabled') is False:
        runtime.interface.run_action('stop')
    if any(k in body for k in ('layout','custom_box','clip_layouts')):
        runtime.interface.run_action('apply-layout')
    return result


def action(name, body):
    if name == 'queue-next' and body.get('paths'):
        clip_library.resolve(body['paths'])
    return runtime.interface.run_action(name, **body)

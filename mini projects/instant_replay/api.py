"""Public replay commands and inventory; runtime state stays within this feature."""
import threading
from .interface import _live
from .config import REPLAY_DIR
from . import library

class NotReady(RuntimeError):
    pass


def mutate_library(body):
    result=library.mutate(body,REPLAY_DIR)
    from . import stage
    stage.sync_labels(result)
    return result

def clips(*, purpose=None):
    if purpose not in (None, 'highlight', 'replay_only'):
        raise ValueError('Choose highlight or replay_only.')
    listing = _live.get("list_clips")
    data = library.decorate(listing() if callable(listing) else library.disk_rows(REPLAY_DIR))
    if purpose is not None:
        data['clips'] = [c for c in data['clips'] if c['purpose'] == purpose]
    data["ready"] = callable(_live.get("play_sequence"))
    data['busy'] = bool(_live.get('playback_busy', lambda: False)())
    return data


def capture(body):
    try:
        seconds = float(body.get('seconds', 15))
    except (ValueError, TypeError):
        raise ValueError('Choose 3–120 seconds.') from None
    import math
    if not math.isfinite(seconds) or not 3 <= seconds <= 120:
        raise ValueError('Choose 3–120 seconds.')
    handler = _live.get('quick_replay')
    if not callable(handler):
        raise NotReady('Instant Replay is not ready.')
    if not handler(seconds):
        raise NotReady('A capture or replay is already in progress.')
    return {'ok': True, 'purpose': 'replay_only', 'seconds': seconds}

def skip():
    handler = _live.get("skip_clip")
    if handler and _live.get("replay_active", [False])[0]:
        handler()
        return True
    return False

def play(body):
    mode = body.get('mode')
    if mode is not None and mode not in ('replay', 'showcase'):
        raise ValueError('Choose replay or showcase.')
    handler = _live.get("play_sequence")
    if not callable(handler):
        raise NotReady("Instant Replay is not ready")
    if _live.get("playback_busy", lambda: False)():
        raise NotReady("A replay is already playing. Stop it before starting another.")
    if 'paths' in body:
        selected = body['paths']
        if not isinstance(selected, list) or not 1 <= len(selected) <= 200 or body.get('group_id') or body.get('path'):
            raise ValueError('Choose 1–200 saved clips or one collection.')
        paths = [str(library.resolve(str(path), REPLAY_DIR)) for path in selected]
    else:
        paths = library.group_paths(str(body["group_id"]), REPLAY_DIR) if body.get("group_id") else [
            str(library.resolve(str(body.get("path") or ""), REPLAY_DIR))]
    options = {'mode': mode}
    if body.get('group_id') or len(paths) > 1:
        options['presentation'] = 'highlights'
    threading.Thread(target=handler, args=(paths,), kwargs=options,
        daemon=True, name="instant-replay-ui-play").start()

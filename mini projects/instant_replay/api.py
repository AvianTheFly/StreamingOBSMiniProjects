"""Public replay commands and inventory; runtime state stays within this feature."""
import threading
from .interface import _live
from .config import REPLAY_DIR
from . import library

class NotReady(RuntimeError):
    pass


def mutate_library(body):
    if body.get('action') in ('trash', 'restore'):
        # Current selection is published before the worker reads these labels.
        with library.LOCK:
            from pathlib import Path
            from . import stage
            paths=body.get('paths')
            if not isinstance(paths,list):
                raise ValueError('Choose clips from the library.')
            selected={str(library.resolve(str(p),REPLAY_DIR)).casefold() for p in paths}
            current = stage.state()
            queue = queue_state()
            playing=queue.get('current',{}).get('path') if queue.get('current') else None
            playing=playing or (current.get('clip_path') if current.get('active') else None)
            if body['action'] == 'trash' and playing and str(Path(playing).resolve()).casefold() in selected:
                raise NotReady('Stop this clip before moving it to Trash.')
            from lib.settings_backups import SettingsBackups
            SettingsBackups().snapshot()
            result=library.mutate(body,REPLAY_DIR)
    else:
        result=library.mutate(body,REPLAY_DIR)
    if body.get('action') == 'trash':
        remove = _live.get('queue_remove_paths')
        if callable(remove):
            remove(set(body['paths']))
    from . import stage
    stage.sync_labels(result)
    return result

def clips(*, purpose=None):
    if purpose is not None and purpose not in library.PURPOSES:
        raise ValueError('Choose highlight, replay_only or review_later.')
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


def queue_state():
    provider = _live.get('queue_state')
    return provider() if callable(provider) else {'supported': True, 'active': False, 'upcoming': []}


def edit_queue(body):
    handler = _live.get('queue_edit')
    if not callable(handler):
        raise NotReady('Replay playback is not ready.')
    paths = body.get('paths', [])
    if body.get('action') == 'add':
        if not isinstance(paths, list) or not 1 <= len(paths) <= 200:
            raise ValueError('Choose 1–200 clips to add.')
        paths = [str(library.resolve(str(p), REPLAY_DIR)) for p in paths]
        _validate_playable(paths)
    return handler(body, paths)


def _validate_playable(paths):
    labels = library.read()['clips']
    if any(labels.get(library.clip_id(p), {}).get('trashed') for p in paths):
        raise ValueError('Restore this clip from Trash before playing it.')

def play(body):
    mode = body.get('mode')
    if mode is not None and mode not in ('replay', 'showcase'):
        raise ValueError('Choose replay or showcase.')
    handler = _live.get("play_sequence")
    if not callable(handler):
        raise NotReady("Instant Replay is not ready")
    if _live.get("playback_busy", lambda: False)():
        raise NotReady("A replay is already playing. Stop it before starting another.")
    if body.get('random'):
        paths = []
        from .inventory import _replay_files_on_disk
        if not _replay_files_on_disk(highlights_only=True):
            raise ValueError('Keep a replay-ready clip before starting random playback.')
    elif 'paths' in body:
        selected = body['paths']
        if not isinstance(selected, list) or not 1 <= len(selected) <= 200 or body.get('group_id') or body.get('path'):
            raise ValueError('Choose 1–200 saved clips or one collection.')
        paths = [str(library.resolve(str(path), REPLAY_DIR)) for path in selected]
    else:
        paths = library.group_paths(str(body["group_id"]), REPLAY_DIR) if body.get("group_id") else [
            str(library.resolve(str(body.get("path") or ""), REPLAY_DIR))]
    options = {'mode': mode}
    if body.get('random'):
        options.update(random_forever=True, presentation='highlights')
    _validate_playable(paths)
    if body.get('group_id') or len(paths) > 1:
        options['presentation'] = 'highlights'
    threading.Thread(target=handler, args=(paths,), kwargs=options,
        daemon=True, name="instant-replay-ui-play").start()

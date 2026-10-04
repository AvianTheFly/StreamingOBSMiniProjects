"""Public feature contract shared by Hub HTTP adapters and project status."""
import threading

_lock = threading.RLock()
_provider = None


def register(tracker):
    global _provider
    with _lock:
        _provider = tracker


def unregister(tracker):
    global _provider
    with _lock:
        if _provider is tracker:
            _provider = None


def provider():
    with _lock:
        if _provider is None:
            raise ValueError('League Stats is not running')
        return _provider


def state(**filters):
    return provider().snapshot(**filters)


def export(**filters):
    return provider().export(**filters)


def save(patch):
    return provider().save_settings(patch)


def action(key, body):
    tracker = provider()
    if key=='import':
        return tracker.request_import()
    if key=='enrichment':
        return tracker.retry_enrichment()
    if key=='observe':
        return tracker.observe('add',body.get('metric'))
    if key=='undo':
        return tracker.observe('undo')
    if key=='session':
        return tracker.start_session(body)
    if key=='review':
        return tracker.review_match(body)
    if key=='correct-observation':
        return tracker.correct_observation(body)
    if key=='dismiss-spotlight':
        with tracker.lock:
            tracker.community.clear()
        return dict(ok=True)
    raise ValueError('Unknown tracker action')

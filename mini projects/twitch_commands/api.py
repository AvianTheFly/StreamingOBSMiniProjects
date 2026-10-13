"""Public command settings and preview contract; no transport or private feature imports."""
import threading
from . import settings
from .policy import match,render

_lock = threading.Lock()
_provider = None
_jokes = None


def register(provider,jokes=None):
    global _provider, _jokes
    with _lock: _provider, _jokes = provider, jokes


def provider():
    with _lock: value = _provider
    if value is None: raise ValueError('Chat commands are not running.')
    return value


def state():
    result = provider().snapshot()
    with _lock: jokes = _jokes
    if jokes is not None:
        result['jokes'] = jokes.snapshot()
    return result


def save_jokes(body):
    with _lock: jokes = _jokes
    if jokes is None: raise ValueError('Joke rotation is not running.')
    return jokes.save(body)


def save(body):
    return provider().save(body)


def preview(body):
    data = state()
    # Preview uses the same matcher and renderer but never enters the send queue.
    message = dict(text=str(body.get('text',''))[:500],channel=data['channel'],user='preview_viewer',moderator=False)
    row = match(data,message)
    return dict(matched=bool(row),response=render(row,data,message) if row else None)

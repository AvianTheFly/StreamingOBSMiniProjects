"""Public command settings and preview contract; no transport or private feature imports."""
import threading
from . import settings
from .policy import match,render

_lock = threading.Lock()
_provider = None


def register(provider):
    global _provider
    with _lock: _provider = provider


def provider():
    with _lock: value = _provider
    if value is None: raise ValueError('Chat commands are not running.')
    return value


def state():
    return provider().snapshot()


def save(body):
    return provider().save(body)


def preview(body):
    data = state()
    # Preview uses the same matcher and renderer but never enters the send queue.
    message = dict(text=str(body.get('text',''))[:500],channel=data['channel'],user='preview_viewer',moderator=False)
    row = match(data,message)
    return dict(matched=bool(row),response=render(row,data,message) if row else None)

"""
events.py
=========
Lightweight pub/sub bus so mini-projects can talk without importing each other.

Any project can:
  • subscribe("event_name", callback)  — register a handler
  • emit("event_name", key=value)      — fire the event

Thread-safe. Zero dependencies.
"""

import threading
from collections import defaultdict

_lock = threading.Lock()
_listeners: dict[str, list[callable]] = defaultdict(list)


def subscribe(event_name: str, callback: callable) -> None:
    """Register *callback* to be called whenever *event_name* is emitted."""
    with _lock:
        _listeners[event_name].append(callback)


def unsubscribe(event_name: str, callback: callable) -> None:
    """Remove a previously registered callback."""
    with _lock:
        try:
            _listeners[event_name].remove(callback)
        except ValueError:
            pass


def emit(event_name: str, **data) -> None:
    """Fire *event_name*, passing *data* as a dict to every subscriber."""
    with _lock:
        dispatches = list(_listeners.get(event_name, []))
    for cb in dispatches:
        try:
            cb(data)
        except Exception as e:
            print(f"[events] Error in subscriber of '{event_name}': {e}")

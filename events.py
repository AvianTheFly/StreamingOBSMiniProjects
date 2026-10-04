"""
events.py
=========
Lightweight pub/sub bus so mini-projects can talk without importing each other.

Any project can:
  • subscribe("event_name", callback)  — register a handler
  • emit("event_name", key=value)      — fire the event with keyword data
  • unsubscribe("event_name", callback) — remove a previously registered handler

Thread-safe. Zero external dependencies.

Standard Hub Events
-------------------

  "twitch.chat.message"
      Emitted by: lib.twitch_chat (Hub-owned read-only TLS transport)
      Payload: user, channel, text, id, user_id, moderator, sent_at
      Identity/role fields come from Twitch tags, not HTTP/browser input.
      Feature subscribers must queue promptly and enforce their own permissions.
The following event names are used by the hub infrastructure.  Projects that
produce or consume these MUST use the exact names below.

  "game.connected"
      Emitted by:  league (when the League Live Client API becomes reachable)
      Consumed by: scene_voice_switcher (switches to GAME_SCENE = "Test")
      Payload:     {} (no data)

  "game.disconnected"
      Emitted by:  league (when the League Live Client API goes unreachable)
      Consumed by: scene_voice_switcher (switches back to LOBBIES_SCENE)
      Payload:     {} (no data)

  "sfx.play"
      Emitted by:  any project that needs a sound effect played
      Consumed by: sound_effects (plays the named OBS media source)
      Payload:     {"source": str}          — lowercase stem of the SFX file,
                                               e.g. "halo respawn sound effect"
                   {"concurrent": bool}     — optional; if True the SFX plays
                                               alongside whatever is currently
                                               playing instead of stopping it.
                                               Use for sounds that must never
                                               interrupt other audio (e.g. the
                                               Halo Respawn sound).

  "toggle_image_visibility"
      Emitted by:  twitch_integration (on !toggleimage chat command)
      Consumed by: face_cam_prop_tracking browser overlay
      Payload:     {"user": str}

Usage example
-------------
  import events

  # Subscriber (in project's run() function):
  def _on_game_connected(data: dict) -> None:
      switch_scene("Test")

  events.subscribe("game.connected", _on_game_connected)

  # ... run loop ...

  # Unsubscribe on shutdown so the handler doesn't linger:
  events.unsubscribe("game.connected", _on_game_connected)

  # Emitter (in the project that generates the event):
  events.emit("game.connected")
  events.emit("sfx.play", source="halo respawn sound effect")
"""

import threading
import time
from contextlib import contextmanager
from collections import defaultdict

_lock = threading.Lock()
_listeners: dict[str, list[callable]] = defaultdict(list)
_observers = {}
_sequence = 0
_dispatch_context = threading.local()


def observe(callback):
    """Register prompt, read-only diagnostics; release the token on shutdown.

    Observers enqueue and return. They never own dispatch or change business
    state, and their exceptions cannot interrupt application handlers.
    """
    token = object()
    with _lock: _observers[token] = callback
    return token


def unobserve(token):
    with _lock: _observers.pop(token, None)


def listener_name(callback):
    return getattr(callback, '__module__', '') + '.' + getattr(callback, '__qualname__', type(callback).__name__)


def subscriptions():
    """Complete read-only subscriber snapshot; no private callbacks escape."""
    with _lock:
        return {name:[listener_name(cb) for cb in callbacks] for name,callbacks in _listeners.items()}


def inspect_event(event_name, *, owner='', phase='observed', **fields):
    """Observe a local decision without emitting a business event.

    Features retain policy/dispatch. Supply decision fields, never chat text,
    voice audio or credentials. Importing this API installs no observer.
    """
    with _lock: observers = tuple(_observers.values())
    if not observers: return
    record = {'event':event_name, 'owner':owner, 'phase':phase, **fields}
    for observer in observers:
        try: observer(record)
        except Exception: pass


@contextmanager
def inspected_dispatch(event_name, callbacks, *, owner='', metadata=None):
    """Observe fan-out/nesting; leave execution with the actual bus owner."""
    global _sequence
    with _lock:
        active = bool(_observers)
        if active:
            _sequence += 1
            dispatch = _sequence
    if not active:
        yield lambda *_args, **_kwargs: None
        return
    parent = getattr(_dispatch_context, 'dispatch', None)
    _dispatch_context.dispatch = dispatch
    inspect_event(event_name, owner=owner, phase='emitted', dispatch=dispatch, parent=parent,
                  listeners=[listener_name(cb) for cb in callbacks], **(metadata or {}))
    def report(callback, *, failed=False, elapsed_ms=None):
        inspect_event(event_name, owner=owner, phase='failed' if failed else 'received',
                      dispatch=dispatch, parent=parent, listener=listener_name(callback), elapsed_ms=elapsed_ms)
    try: yield report
    finally: _dispatch_context.dispatch = parent


def subscribe(event_name: str, callback: callable) -> None:
    """Register *callback* to be called whenever *event_name* is emitted."""
    with _lock:
        _listeners[event_name].append(callback)


def unsubscribe(event_name: str, callback: callable) -> None:
    """Remove a previously registered callback."""
    with _lock:
        listeners = _listeners.get(event_name)
        if listeners is None:
            return
        try:
            listeners.remove(callback)
        except ValueError:
            return
        if not listeners:
            del _listeners[event_name]


def emit(event_name: str, **data) -> None:
    """
    Fire *event_name*, passing *data* as a dict to every subscriber.

    Callbacks are called synchronously in the emitting thread.
    If a callback blocks (e.g. waits for media to end), start it in
    a daemon thread inside the callback.
    """
    with _lock:
        dispatches = list(_listeners.get(event_name, []))
    # Only decision metadata is observed. Message/transcript bodies and tokens never enter history.
    metadata = {key:data[key] for key in ('requester','project','action','source','scene','sequence','paused','resumed') if key in data}
    with inspected_dispatch(event_name, dispatches, metadata=metadata) as report:
        for cb in dispatches:
            began = time.monotonic()
            failed = False
            try:
                cb(data)
            except Exception as e:
                failed = True
                print(f"[events] Error in subscriber of '{event_name}': {e}")
            finally:
                report(cb, failed=failed, elapsed_ms=round((time.monotonic()-began)*1000, 2))

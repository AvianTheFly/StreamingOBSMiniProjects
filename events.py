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
    """
    Fire *event_name*, passing *data* as a dict to every subscriber.

    Callbacks are called synchronously in the emitting thread.
    If a callback blocks (e.g. waits for media to end), start it in
    a daemon thread inside the callback.
    """
    with _lock:
        dispatches = list(_listeners.get(event_name, []))
    for cb in dispatches:
        try:
            cb(data)
        except Exception as e:
            print(f"[events] Error in subscriber of '{event_name}': {e}")

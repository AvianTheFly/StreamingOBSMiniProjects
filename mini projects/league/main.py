# league/main.py
#
# Pattern A (hotkey-only) with a background watcher thread.
#
# The LeagueAPIWatcher runs in a daemon thread (it has a blocking poll loop).
# The pynput keyboard listener runs here so it can hand B-key presses to the
# watcher without any shared mutable state other than the watcher object itself.

from __future__ import annotations

import atexit
import queue
import threading

from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from .core.league_api import LeagueAPIWatcher


_RECALL_KEY = "b"   # case-insensitive; catches both 'b' and 'B'


def run(
    input_queue: queue.Queue,
    stop_event: threading.Event,
    *,
    startup_event: threading.Event | None = None,
) -> None:
    """Entry point called by the hub's main.py."""

    watcher = LeagueAPIWatcher(stop_event)

    from .interface import _live
    _live["watcher"] = watcher
    _live["kill_audio_player"] = watcher.kill_audio_player

    # Crash-safe: the poll loop runs in a daemon thread, so the hub's 3-second
    # join timeout may expire before the 30-second deferred session save fires.
    # watcher.shutdown() handles streak cleanup + session flush in one call.
    atexit.register(watcher.shutdown)

    # Run the blocking poll loop in a background thread
    watcher_thread = threading.Thread(
        target=watcher.run,
        name="league-watcher",
        daemon=True,
    )
    watcher_thread.start()

    # Keyboard listener — fires on every key press
    def on_press(key) -> None:
        char = key_char(key)
        if char and char.lower() == _RECALL_KEY:
            watcher.on_recall_key()

    kb_token = subscribe_global_hotkeys(on_press)
    print(f"[league] Keyboard listener armed (recall key: '{_RECALL_KEY}').")
    if startup_event is not None:
        startup_event.set()

    # Block until the hub sets stop_event
    stop_event.wait()

    unsubscribe_global_hotkeys(kb_token)
    watcher_thread.join(timeout=3)
    print("[league] Stopped.")

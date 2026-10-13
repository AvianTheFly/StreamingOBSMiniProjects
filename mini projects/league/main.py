# league/main.py
#
# Pattern A (hotkey-only) with a background watcher thread.
#
# The LeagueAPIWatcher runs in a daemon thread (it has a blocking poll loop).
# The Hub's shared keyboard bus delivers recall and stance intent to the watcher.

from __future__ import annotations

import atexit
import queue
import threading

from lib.global_hotkeys import key_char, key_token, subscribe_global_hotkeys, unsubscribe_global_hotkeys
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

    # Keyboard listener — fires on every key press
    def on_press(key) -> None:
        char = key_char(key)
        if key_token(key) in ('enter', '\r', '\n'):
            watcher.on_chat_key()
        elif char and char.lower() == _RECALL_KEY:
            watcher.on_recall_key()
        elif char and char.lower() in 'qwer':
            watcher.on_stance_key(char)

    kb_token = None
    try:
        kb_token = subscribe_global_hotkeys(on_press)
        watcher_thread.start()
        print(f"[league] Keyboard listener armed (recall: B; Udyr stances: Q/W/E/R).")
        if startup_event is not None:
            startup_event.set()
        stop_event.wait()
    finally:
        unsubscribe_global_hotkeys(kb_token)
        if watcher_thread.ident is not None:
            watcher_thread.join(timeout=3)
        watcher.shutdown()
        atexit.unregister(watcher.shutdown)
        print("[league] Stopped.")

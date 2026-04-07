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

from pynput import keyboard

from .league_api import LeagueAPIWatcher


_RECALL_KEY = "b"   # case-insensitive; catches both 'b' and 'B'


def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    """Entry point called by obs_hub/main.py."""

    watcher = LeagueAPIWatcher(stop_event)

    # -- Crash-safe session recording ------------------------------------------
    # If the hub is killed mid-game the deferred timer may never fire.
    # This atexit hook flushes the session immediately on shutdown.
    def _shutdown_hook():
        # Hide kill streak assets immediately on any shutdown (Ctrl+C, crash, etc.)
        watcher._force_streak_reset()
        if watcher.game_connected or watcher._pending_save:
            from datetime import datetime, timezone, timedelta
            end_iso = datetime.now(timezone(timedelta())).isoformat()
            if watcher.game_connected:
                # Cancel the pending timer so we don't double-save.
                if watcher._pending_save:
                    watcher._pending_save.cancel()
                start_iso = watcher._game_start_iso or end_iso
                watcher.game_connected = False
            elif watcher._pending_save:
                # Timer is still pending — save with its time range.
                start_iso = watcher._game_start_iso
                if start_iso is None:
                    return  # nothing to save
                watcher._pending_save.cancel()
            watcher._pending_save = None
            watcher._game_start_iso = None
            from .league_api import _save_session
            _save_session(start_iso, end_iso)
            print("[league] Session flushed on shutdown.")

    atexit.register(_shutdown_hook)

    # Run the blocking poll loop in a background thread
    watcher_thread = threading.Thread(
        target=watcher.run,
        name="league-watcher",
        daemon=True,
    )
    watcher_thread.start()

    # Keyboard listener — fires on every key press
    def on_press(key):
        try:
            char = key.char
        except AttributeError:
            return  # special key (shift, ctrl, etc.) — ignore

        if char and char.lower() == _RECALL_KEY:
            watcher.on_recall_key()

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print(f"[league] Keyboard listener armed (recall key: '{_RECALL_KEY}').")

    # Block until the hub sets stop_event
    stop_event.wait()

    kb.stop()
    watcher_thread.join(timeout=3)
    print("[league] Stopped.")

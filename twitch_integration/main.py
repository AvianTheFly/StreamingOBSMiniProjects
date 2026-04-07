# twitch_integration/main.py
"""
Skeleton Twitch integration project.

Connects to Twitch chat via IRC, prints messages, and provides a command
registration system for future features (OBS integration, script triggers, etc.)
"""

from __future__ import annotations

import queue
import threading

from .bot import TwitchBot


def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    """Called by the hub in a daemon thread."""

    bot = TwitchBot()

    # Run the IRC connection in a background thread so we can still handle
    # queue messages if needed.
    thread = threading.Thread(
        target=bot.run_forever,
        args=(stop_event,),
        daemon=True,
        name="twitch-bot",
    )
    thread.start()

    # ── Main loop ─────────────────────────────────────────────────────────

    while not stop_event.is_set():
        try:
            input_queue.get(timeout=0.5)
        except queue.Empty:
            continue

    # ── Cleanup ───────────────────────────────────────────────────────────
    bot.stop()
    thread.join(timeout=3)
    print("[twitch] Stopped.")

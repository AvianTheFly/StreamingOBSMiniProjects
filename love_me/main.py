"""
love_me/main.py
===============
Always-on sequential media player triggered by the "987" key sequence.

Hotkey behaviour
----------------
  9 → 8 → 7  (within TRIGGER_MAX_INTERVAL ms)
      • If the last item is currently playing  → stop it immediately (toggle off)
      • Otherwise                              → play the next item in sequence

Reset rules
-----------
  • After the last item finishes naturally, the sequence resets to the beginning.
  • If IDLE_RESET_SECONDS pass since the last trigger without a new trigger,
    the sequence also resets to the beginning.
  • Both rules mean: if you wait too long between presses, next press = item 1.

Internal imports
----------------
All sibling modules are imported with package-relative syntax:
    from .config  import ...   ✓
    from .player  import ...   ✓
    from config   import ...   ✗  (causes cross-project pollution)
"""

from __future__ import annotations

import queue
import threading
import time

from pynput import keyboard

# ── Package-relative imports (always find THIS project's modules) ─────────────
from .config import (
    TRIGGER_SEQUENCE,
    TRIGGER_MAX_INTERVAL,
)
from .trigger import SequenceTrigger
from .player  import SequentialPlayer

# How many seconds of inactivity before the sequence resets to item 1.
IDLE_RESET_SECONDS: float = 15.0


def run(
    input_queue: queue.Queue,
    stop_event:  threading.Event,
    done_queue:  queue.Queue = None,
) -> None:
    """Entry point called by the hub."""

    player  = SequentialPlayer()
    trigger = SequenceTrigger(TRIGGER_SEQUENCE, TRIGGER_MAX_INTERVAL)

    seq_str = "".join(TRIGGER_SEQUENCE)
    print(f"[love_me] Hotkey: {seq_str} within {int(TRIGGER_MAX_INTERVAL * 1000)} ms — always armed")
    print(f"[love_me] Idle reset: {IDLE_RESET_SECONDS}s of inactivity resets to item 1")
    player.print_config()
    player.hide_all_sources()

    # Timestamp of the last trigger fire. None = never triggered / already reset.
    _last_trigger_time: list[float | None] = [None]
    _state_lock = threading.Lock()

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _reset_sequence(reason: str) -> None:
        """Reset index to 0 and clear last-trigger time. Call under _state_lock."""
        player.current_index = 0
        _last_trigger_time[0] = None
        trigger.reset()
        print(f"[love_me] Sequence reset ({reason}).")

    def _handle_trigger() -> None:
        with _state_lock:
            now = time.monotonic()

            # ── Idle reset: enough time passed since last trigger → restart ──
            last = _last_trigger_time[0]
            if last is not None and (now - last) >= IDLE_RESET_SECONDS:
                if player.is_busy:
                    threading.Thread(target=player.abort, daemon=True).start()
                _reset_sequence("idle timeout")
                # Fall through: this trigger now plays item 1

            with player.lock:
                idx   = player.current_index
                busy  = player.is_busy
                total = len(player.items)

            # ── Last item is playing → toggle off ────────────────────────────
            if busy and idx == total - 1:
                print(f"[love_me] {seq_str} — last item playing, toggling off.")
                _reset_sequence("toggled off")
                threading.Thread(target=player.abort, daemon=True).start()
                return

            # ── Sequence already exhausted (safety net) ───────────────────────
            if idx >= total:
                _reset_sequence("end of sequence")

            # ── Normal: play next ─────────────────────────────────────────────
            _last_trigger_time[0] = now
            if busy:
                # Abort current item, advance index, then play next
                print(f"[love_me] {seq_str} — skipping to item {player.current_index + 2}/{total}.")
                threading.Thread(
                    target=player.abort_and_advance, daemon=True
                ).start()
            else:
                print(f"[love_me] {seq_str} — playing item {player.current_index + 1}/{total}.")
                player.play_next_async()

    # ── Keyboard listener (always on) ─────────────────────────────────────────

    def on_press(key):
        try:
            k = key.char
        except AttributeError:
            return
        if k is None:
            return
        if trigger.register_key(k):
            _handle_trigger()

    kb_listener = keyboard.Listener(on_press=on_press)
    kb_listener.start()
    print("[love_me] Keyboard listener started.")

    # ── Main loop ─────────────────────────────────────────────────────────────

    while not stop_event.is_set():
        try:
            message = input_queue.get(timeout=0.5)
        except queue.Empty:
            # Auto-reset once the full sequence has played through naturally
            with _state_lock:
                with player.lock:
                    sequence_done = (
                        not player.is_busy
                        and player.current_index >= len(player.items)
                        and player.current_index > 0
                    )
                if sequence_done:
                    _reset_sequence("sequence complete")
            continue

        # Handle any string/dict messages on the queue (e.g. external "abort")
        cmd = ""
        if isinstance(message, str):
            cmd = message.strip().lower()
        elif isinstance(message, dict):
            cmd = str(message.get("name", "")).strip().lower()

        if cmd == "abort":
            print("[love_me] Abort received.")
            with _state_lock:
                _reset_sequence("abort")
            threading.Thread(target=player.abort, daemon=True).start()

    kb_listener.stop()
    print("[love_me] Stopped.")
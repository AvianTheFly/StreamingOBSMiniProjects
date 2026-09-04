"""Standalone keyboard listener.

Run as a subprocess by lib/global_hotkeys.py. Emits one JSON line per key
press to stdout: {"char": <str|null>, "name": <str>}.

Lives in a separate Python process so the Windows WH_KEYBOARD_LL hook
runs free of the hub's GIL — keystrokes never stall on Whisper, numpy,
or any other GIL-holding work in the parent.
"""

from __future__ import annotations

import json
import queue
import sys
import threading


def main() -> None:
    try:
        from pynput import keyboard
    except Exception as exc:
        sys.stderr.write(f"keyboard_worker: pynput unavailable: {exc}\n")
        sys.stderr.flush()
        sys.exit(2)

    out = sys.stdout
    events: queue.Queue = queue.Queue(maxsize=10_000)

    def on_press(key) -> None:
        # Hook callback — must return as fast as possible. Windows blocks
        # ALL keyboard input on this machine until we return.
        char = getattr(key, "char", None)
        name = str(getattr(key, "name", "") or "")
        try:
            events.put_nowait((char, name))
        except queue.Full:
            pass

    def writer_loop() -> None:
        while True:
            char, name = events.get()
            try:
                out.write(json.dumps({"char": char, "name": name}) + "\n")
                out.flush()
            except Exception:
                return

    threading.Thread(target=writer_loop, name="kb-writer", daemon=True).start()

    listener = keyboard.Listener(on_press=on_press)
    listener.start()
    listener.join()


if __name__ == "__main__":
    main()

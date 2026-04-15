from __future__ import annotations

import os
import queue
import re
import threading
import webbrowser
from difflib import SequenceMatcher

from pynput import keyboard

from shared import VoicePTT
from .config import LENS_COMMANDS, PTT_KEY, RECORD_TIMEOUT_SECONDS


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _compact(text: str) -> str:
    return _normalize(text).replace(" ", "")


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _open_url(url: str) -> None:
    try:
        if os.name == "nt":
            os.startfile(url)  # type: ignore[attr-defined]
        else:
            ok = webbrowser.open_new_tab(url)
            if not ok:
                raise RuntimeError("webbrowser.open_new_tab returned False")
        print(f"[browser_lenses] Opened: {url}")
    except Exception as exc:
        print(f"[browser_lenses] Failed to open browser for {url}: {exc}")


def _match_command(raw_text: str) -> str | None:
    normalized = _normalize(raw_text)
    compact    = _compact(raw_text)

    if not normalized:
        return None

    for command_name, data in LENS_COMMANDS.items():
        for alias in data["aliases"]:
            alias_norm    = _normalize(alias)
            alias_compact = _compact(alias)

            if alias_norm    and alias_norm    in normalized: return command_name
            if alias_compact and alias_compact in compact:    return command_name
            if _similar(normalized, alias_norm)    >= 0.84:  return command_name
            if _similar(compact,    alias_compact) >= 0.88:  return command_name

    return None


def _handle_command(raw_text: str) -> None:
    text = raw_text.strip()
    if not text:
        return

    print(f"[browser_lenses] Transcript: {text!r}")
    command_name = _match_command(text)
    if command_name is None:
        print(f"[browser_lenses] No match for transcript: {text!r}")
        return

    _open_url(LENS_COMMANDS[command_name]["url"])


def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    ptt = VoicePTT(
        timeout=RECORD_TIMEOUT_SECONDS,
        on_transcript=lambda text: input_queue.put(text.strip()) if text and text.strip() else None,
        tag="browser_lenses",
    )

    def on_press(key) -> None:
        try:
            if key.char == PTT_KEY:
                ptt.on_trigger()
        except AttributeError:
            return

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print(f"[browser_lenses] Hotkey '{PTT_KEY}' armed.")

    try:
        while not stop_event.is_set():
            try:
                raw = input_queue.get(timeout=0.5)
            except queue.Empty:
                continue
            if isinstance(raw, str) and raw.strip():
                _handle_command(raw)
    finally:
        kb.stop()
        ptt.cancel("shutdown")
        print("[browser_lenses] Stopped.")

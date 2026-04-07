from __future__ import annotations

import os
import queue
import re
import sys
import threading
import webbrowser
from difflib import SequenceMatcher

from pynput import keyboard

from .config import LENS_COMMANDS, PTT_KEY, RECORD_TIMEOUT_SECONDS


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _compact(text: str) -> str:
    return _normalize(text).replace(" ", "")


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _get_voice_mod():
    return sys.modules.get("voice.listener")


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
    compact = _compact(raw_text)

    if not normalized:
        return None

    for command_name, data in LENS_COMMANDS.items():
        for alias in data["aliases"]:
            alias_norm = _normalize(alias)
            alias_compact = _compact(alias)

            if alias_norm and alias_norm in normalized:
                return command_name
            if alias_compact and alias_compact in compact:
                return command_name
            if _similar(normalized, alias_norm) >= 0.84:
                return command_name
            if _similar(compact, alias_compact) >= 0.88:
                return command_name

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

    url = LENS_COMMANDS[command_name]["url"]
    _open_url(url)


def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    recording = [False]
    timer: list[threading.Timer | None] = [None]
    lock = threading.Lock()

    def _send(text: str) -> None:
        if text and text.strip():
            input_queue.put(text.strip())

    def _cancel(reason: str) -> None:
        voice_mod = _get_voice_mod()

        with lock:
            if not recording[0]:
                return
            recording[0] = False
            current_timer = timer[0]
            timer[0] = None

        if current_timer is not None:
            current_timer.cancel()

        if voice_mod is not None:
            try:
                voice_mod.stop_and_transcribe(lambda _: None)
            except Exception as exc:
                print(f"[browser_lenses] stop_and_transcribe during cancel failed: {exc}")

        print(f"[browser_lenses] Recording cancelled ({reason})")

    def _on_ptt() -> None:
        voice_mod = _get_voice_mod()
        if voice_mod is None:
            print("[browser_lenses] Voice module not ready yet.")
            return

        with lock:
            if not recording[0]:
                recording[0] = True
                current_timer = threading.Timer(
                    RECORD_TIMEOUT_SECONDS,
                    lambda: _cancel("timeout"),
                )
                timer[0] = current_timer
                current_timer.start()

                try:
                    voice_mod.start_recording()
                    print("[browser_lenses] Listening...")
                except Exception as exc:
                    recording[0] = False
                    timer[0] = None
                    current_timer.cancel()
                    print(f"[browser_lenses] start_recording failed: {exc}")
                return

            recording[0] = False
            current_timer = timer[0]
            timer[0] = None

        if current_timer is not None:
            current_timer.cancel()

        try:
            voice_mod.stop_and_transcribe(_send)
            print("[browser_lenses] Transcribing...")
        except Exception as exc:
            print(f"[browser_lenses] stop_and_transcribe failed: {exc}")

    def on_press(key) -> None:
        try:
            if key.char == PTT_KEY:
                _on_ptt()
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

            if not isinstance(raw, str) or not raw.strip():
                continue

            _handle_command(raw)
    finally:
        kb.stop()
        _cancel("shutdown")
        print("[browser_lenses] Stopped.")
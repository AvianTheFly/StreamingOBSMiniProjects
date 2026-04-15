from __future__ import annotations

import json
import os
import queue
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

from pynput import keyboard

from .config import (
    BROWSER_CANDIDATES,
    DEBUG_PORT,
    INITIAL_STARTUP_DELAY_SECONDS,
    LENS_COMMANDS,
    PTT_KEY,
    RECORD_TIMEOUT_SECONDS,
    TAB_OPEN_DELAY_SECONDS,
)

_BROWSER_PROC: subprocess.Popen | None = None
_BROWSER_EXE: str | None = None
_PROFILE_DIR = Path(tempfile.gettempdir()) / "browser_lenses_profile"


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _compact(text: str) -> str:
    return _normalize(text).replace(" ", "")


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _get_voice_mod():
    return sys.modules.get("voice.listener")


def _debug_base() -> str:
    return f"http://127.0.0.1:{DEBUG_PORT}"


def _request_json(path: str, method: str = "GET"):
    req = urllib.request.Request(_debug_base() + path, method=method)
    with urllib.request.urlopen(req, timeout=3) as resp:
        data = resp.read().decode("utf-8", errors="replace")
    return json.loads(data)


def _request_nojson(path: str, method: str = "GET") -> bool:
    req = urllib.request.Request(_debug_base() + path, method=method)
    with urllib.request.urlopen(req, timeout=3):
        return True


def _list_tabs() -> list[dict]:
    try:
        data = _request_json("/json/list")
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _find_browser_executable() -> str | None:
    for candidate in BROWSER_CANDIDATES:
        expanded = os.path.expandvars(candidate)
        if os.path.isfile(expanded):
            return expanded
    return None


def _is_debug_ready() -> bool:
    try:
        _request_json("/json/version")
        return True
    except Exception:
        return False


def _launch_browser() -> bool:
    global _BROWSER_PROC, _BROWSER_EXE

    if _is_debug_ready():
        print(f"[browser_lenses] Reusing browser already listening on port {DEBUG_PORT}.")
        return True

    exe = _find_browser_executable()
    if exe is None:
        print("[browser_lenses] No supported browser found. Install Edge, Chrome, or Chromium.")
        return False

    _PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    args = [
        exe,
        f"--remote-debugging-port={DEBUG_PORT}",
        f"--user-data-dir={str(_PROFILE_DIR)}",
        "--new-window",
        "about:blank",
    ]

    try:
        _BROWSER_PROC = subprocess.Popen(args)
        _BROWSER_EXE = exe
    except Exception as exc:
        print(f"[browser_lenses] Failed to launch browser: {exc}")
        return False

    deadline = time.time() + 10.0
    while time.time() < deadline:
        if _is_debug_ready():
            print(f"[browser_lenses] Launched controllable browser: {exe}")
            return True
        time.sleep(0.25)

    print("[browser_lenses] Browser launched, but remote debugging never became ready.")
    return False


def _activate_tab(tab_id: str) -> bool:
    try:
        return _request_nojson(f"/json/activate/{tab_id}", method="PUT")
    except Exception as exc:
        print(f"[browser_lenses] Failed to activate tab {tab_id}: {exc}")
        return False


def _open_new_tab(url: str) -> bool:
    encoded = urllib.parse.quote(url, safe="")
    try:
        _request_nojson(f"/json/new?{encoded}", method="PUT")
        print(f"[browser_lenses] Opened tab: {url}")
        return True
    except urllib.error.HTTPError as exc:
        print(f"[browser_lenses] Failed to open tab {url}: HTTP {exc.code}")
        return False
    except Exception as exc:
        print(f"[browser_lenses] Failed to open tab {url}: {exc}")
        return False


def _find_tab_by_url(url: str) -> dict | None:
    for tab in _list_tabs():
        if tab.get("type") != "page":
            continue
        if tab.get("url") == url:
            return tab
    return None


def _ensure_tab(url: str) -> bool:
    tab = _find_tab_by_url(url)
    if tab is not None:
        return True
    return _open_new_tab(url)


def _focus_url(url: str) -> bool:
    tab = _find_tab_by_url(url)
    if tab is None:
        if not _open_new_tab(url):
            return False
        time.sleep(0.5)
        tab = _find_tab_by_url(url)
        if tab is None:
            print(f"[browser_lenses] Tab was opened but could not be located for URL: {url}")
            return False

    tab_id = tab.get("id")
    if not tab_id:
        print(f"[browser_lenses] Matching tab had no id for URL: {url}")
        return False

    ok = _activate_tab(tab_id)
    if ok:
        print(f"[browser_lenses] Focused existing tab for: {url}")
    return ok


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
    if not _focus_url(url):
        print(f"[browser_lenses] Could not focus URL: {url}")


def _warm_open_all_urls() -> None:
    if not _launch_browser():
        return

    print("[browser_lenses] Opening all configured URLs on startup...")
    time.sleep(INITIAL_STARTUP_DELAY_SECONDS)

    for data in LENS_COMMANDS.values():
        _ensure_tab(data["url"])
        time.sleep(TAB_OPEN_DELAY_SECONDS)


_LOCKOUT_SECONDS = 4.0

def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    recording      = [False]
    timer: list[threading.Timer | None] = [None]
    lockout_until  = [0.0]   # monotonic timestamp; 0 = no lockout
    lock           = threading.Lock()

    _warm_open_all_urls()

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
                voice_mod.stop_and_transcribe(lambda _: None, "browser_lenses")
            except Exception as exc:
                print(f"[browser_lenses] stop_and_transcribe during cancel failed: {exc}")

        lockout_until[0] = time.monotonic() + _LOCKOUT_SECONDS
        print(f"[browser_lenses] Recording cancelled ({reason})")

    def _do_stop() -> None:
        """Stop recording and transcribe — called by 'C' key, double-trigger, or timeout."""
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
                lockout_until[0] = time.monotonic() + _LOCKOUT_SECONDS
                voice_mod.stop_and_transcribe(_send, "browser_lenses")
                print("[browser_lenses] Sending to Whisper…")
            except Exception as exc:
                print(f"[browser_lenses] stop_and_transcribe failed: {exc}")

    def _on_ptt() -> None:
        voice_mod = _get_voice_mod()
        if voice_mod is None:
            print("[browser_lenses] Voice module not ready yet.")
            return

        # Check state under lock; build timer but don't start it yet
        with lock:
            if recording[0]:
                already = True
            else:
                recording[0]  = True
                current_timer = threading.Timer(RECORD_TIMEOUT_SECONDS, _do_stop)
                timer[0]      = current_timer
                already       = False

        if already:
            _do_stop()  # double-trigger: stop immediately
            return

        remaining = lockout_until[0] - time.monotonic()
        if remaining > 0:
            print(f"[browser_lenses] 🔒  Trigger ignored — locked out for {remaining:.1f}s more.")
            return

        current_timer.start()
        started = voice_mod.start_recording("browser_lenses")
        if not started:
            with lock:
                recording[0] = False
                timer[0]     = None
            current_timer.cancel()
            print("[browser_lenses] ⚠  Could not start recording — mic is busy.")
            return

        print(
            f"[browser_lenses] 🎤  Listening… "
            f"(press trigger again or 'C' to stop, auto-stops in {RECORD_TIMEOUT_SECONDS:.0f}s)"
        )

    def on_press(key) -> None:
        try:
            char = key.char
        except AttributeError:
            return
        if char == "C":
            _do_stop()
        elif char == PTT_KEY:
            _on_ptt()

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print(f"[browser_lenses] Hotkey '{PTT_KEY}' armed — press 'C' to stop recording.")

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

"""
stream_title/main.py
====================
Voice-controlled Twitch stream title updater via Twitch Helix API.

Hotkey: '<' (push-to-talk)
  1st press — starts mic recording
  2nd press — stops recording → transcribes → updates Twitch title

Recording auto-cancels after RECORD_TIMEOUT_SECONDS.
Follows Pattern B from the hub reference: run(input_queue, stop_event).
"""

from __future__ import annotations

import json
import queue
import re
import sys
import threading
import time
from pathlib import Path

import requests
from pynput import keyboard

from .config import PTT_KEY, RECORD_TIMEOUT_SECONDS

_HERE = Path(__file__).resolve().parent
_CONFIG = _HERE / "twitch_config.json"


# ─────────────────────────────────────────────────────────────────────────────
#  Twitch Helix API via access-token auto-refresh
# ─────────────────────────────────────────────────────────────────────────────

_load_lock = threading.Lock()


def _load_config() -> dict:
    with _load_lock:
        with open(_CONFIG, encoding="utf-8") as f:
            return json.load(f)


def _save_config(data: dict) -> None:
    with _load_lock:
        with open(_CONFIG, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)


def _refresh_token_if_needed(cfg: dict) -> str:
    """
    Return a valid access token.  If the stored token is missing or about
    to expire, exchanges the refresh token for a new one and persists it.
    """
    now = time.time()
    token = cfg["access_token"]
    expires_at = cfg.get("token_expiry", 0)

    if token and now < expires_at - 60:
        return token  # still valid

    # Need a fresh token
    print("[stream_title] Refreshing Twitch access token…")
    resp = requests.post("https://id.twitch.tv/oauth2/token", data={
        "grant_type":    "refresh_token",
        "refresh_token": cfg["refresh_token"],
        "client_id":     cfg["client_id"],
        "client_secret": cfg["client_secret"],
    })
    if resp.status_code != 200:
        raise RuntimeError(f"Twitch token refresh failed: {resp.text}")

    data = resp.json()
    cfg["access_token"]  = data["access_token"]
    cfg["refresh_token"] = data["refresh_token"]  # Twitch rotates refresh tokens
    cfg["token_expiry"]  = now + data["expires_in"]
    _save_config(cfg)
    print("[stream_title] Token refreshed.")
    return cfg["access_token"]


def get_stream_title() -> str | None:
    """Return the current Twitch stream title."""
    cfg = _load_config()
    token = _refresh_token_if_needed(cfg)

    resp = requests.get(
        f"https://api.twitch.tv/helix/channels?broadcaster_id={cfg['broadcaster_id']}",
        headers={
            "Client-Id":     cfg["client_id"],
            "Authorization": f"Bearer {token}",
        },
    )
    if resp.status_code != 200:
        print(f"[stream_title] ERROR reading title: {resp.text}")
        return None

    return resp.json()["data"][0]["title"]


def set_stream_title(title: str) -> None:
    """Set the Twitch stream title via Helix API."""
    cfg = _load_config()
    token = _refresh_token_if_needed(cfg)

    resp = requests.patch(
        f"https://api.twitch.tv/helix/channels?broadcaster_id={cfg['broadcaster_id']}",
        headers={
            "Client-Id":     cfg["client_id"],
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json",
        },
        json={"title": title},
    )
    if resp.status_code != 204:
        print(f"[stream_title] ERROR setting title: {resp.status_code} {resp.text}")
    else:
        print(f"[stream_title] Twitch title → {title!r}")


# ─────────────────────────────────────────────────────────────────────────────
#  Push-to-talk voice handling
# ─────────────────────────────────────────────────────────────────────────────


def _get_voice_mod():
    return sys.modules.get("voice.listener")


def _send(text: str, q: queue.Queue) -> None:
    if text and text.strip():
        q.put(text.strip())


def _cancel_recording(
    recording: list[bool],
    timer: list[threading.Timer | None],
    lock: threading.Lock,
    reason: str,
) -> None:
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
            print(f"[stream_title] cancel stop_and_transcribe error: {exc}")
    print(f"[stream_title] Recording cancelled ({reason})")


def _on_ptt(
    recording: list[bool],
    timer: list[threading.Timer | None],
    lock: threading.Lock,
    input_queue: queue.Queue,
) -> None:
    voice_mod = _get_voice_mod()
    if voice_mod is None:
        print("[stream_title] Voice module not ready.")
        return

    with lock:
        if not recording[0]:
            recording[0] = True
            current_timer = threading.Timer(
                RECORD_TIMEOUT_SECONDS,
                lambda: _cancel_recording(recording, timer, lock, "timeout"),
            )
            timer[0] = current_timer
            current_timer.start()
            try:
                voice_mod.start_recording()
                print("[stream_title] Listening for new stream title…")
            except Exception as exc:
                recording[0] = False
                timer[0] = None
                current_timer.cancel()
                print(f"[stream_title] start_recording failed: {exc}")
            return

        recording[0] = False
        current_timer = timer[0]
        timer[0] = None

    if current_timer is not None:
        current_timer.cancel()

    try:
        voice_mod.stop_and_transcribe(lambda text: _send(text, input_queue))
    except Exception as exc:
        print(f"[stream_title] stop_and_transcribe failed: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
#  Hub entry point
# ─────────────────────────────────────────────────────────────────────────────


def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    recording: list[bool] = [False]
    timer: list[threading.Timer | None] = [None]
    lock = threading.Lock()

    # Pre-warm the token so the first title change is fast
    try:
        cfg = _load_config()
        _refresh_token_if_needed(cfg)
    except Exception as exc:
        print(f"[stream_title] WARNING: could not pre-load Twitch token: {exc}")

    def on_press(key) -> None:
        try:
            if key.char == PTT_KEY:
                _on_ptt(recording, timer, lock, input_queue)
        except AttributeError:
            return

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print(f"[stream_title] Hotkey '{PTT_KEY}' armed.")
    print(f"[stream_title] Current title: {get_stream_title() or '(empty)'}")

    try:
        while not stop_event.is_set():
            try:
                raw = input_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            if not isinstance(raw, str) or not raw.strip():
                continue

            new_title = raw.strip()
            set_stream_title(new_title)

    finally:
        kb.stop()
        _cancel_recording(recording, timer, lock, "shutdown")
        print("[stream_title] Stopped.")

"""
stream_title/main.py
====================
Voice-controlled Twitch stream title updater via Twitch Helix API.

Hotkey: '<' (push-to-talk)
  1st press — starts mic recording
  2nd press — stops recording → transcribes → updates Twitch title

Recording auto-cancels after RECORD_TIMEOUT_SECONDS.
"""

from __future__ import annotations

import json
import os
import queue
import re
import threading
import time
from pathlib import Path

import requests
from pynput import keyboard

from shared import VoicePTT
from .config import PTT_KEY, RECORD_TIMEOUT_SECONDS

_HERE   = Path(__file__).resolve().parent
_CONFIG = _HERE / "twitch_config.json"


# ─────────────────────────────────────────────────────────────────────────────
#  Twitch Helix API via access-token auto-refresh
# ─────────────────────────────────────────────────────────────────────────────

_load_lock = threading.Lock()


def _load_config() -> dict:
    """Load rotating token fields from twitch_config.json, static creds from ENV."""
    with _load_lock:
        with open(_CONFIG, encoding="utf-8") as f:
            data = json.load(f)
    data["client_id"]      = os.environ["TWITCH_CLIENT_ID"]
    data["client_secret"]  = os.environ["TWITCH_CLIENT_SECRET"]
    data["broadcaster_id"] = os.environ["TWITCH_BROADCASTER_ID"]
    return data


def _save_config(data: dict) -> None:
    """Persist only the rotating token fields — static creds live in .env."""
    token_data = {
        "access_token":  data["access_token"],
        "refresh_token": data["refresh_token"],
        "token_expiry":  data["token_expiry"],
    }
    with _load_lock:
        with open(_CONFIG, "w", encoding="utf-8") as f:
            json.dump(token_data, f, indent=4)


def _refresh_token_if_needed(cfg: dict) -> str:
    """
    Return a valid access token.  If the stored token is missing or about
    to expire, exchanges the refresh token for a new one and persists it.
    """
    now        = time.time()
    token      = cfg["access_token"]
    expires_at = cfg.get("token_expiry", 0)

    if token and now < expires_at - 60:
        return token

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
    cfg["refresh_token"] = data["refresh_token"]
    cfg["token_expiry"]  = now + data["expires_in"]
    _save_config(cfg)
    print("[stream_title] Token refreshed.")
    return cfg["access_token"]


def get_stream_title() -> str | None:
    cfg   = _load_config()
    token = _refresh_token_if_needed(cfg)
    resp  = requests.get(
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
    cfg   = _load_config()
    token = _refresh_token_if_needed(cfg)
    resp  = requests.patch(
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
#  Hub entry point
# ─────────────────────────────────────────────────────────────────────────────

def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    ptt = VoicePTT(
        timeout=RECORD_TIMEOUT_SECONDS,
        on_transcript=lambda text: input_queue.put(text.strip()) if text and text.strip() else None,
        tag="stream_title",
    )

    try:
        cfg = _load_config()
        _refresh_token_if_needed(cfg)
    except Exception as exc:
        print(f"[stream_title] WARNING: could not pre-load Twitch token: {exc}")

    def on_press(key) -> None:
        try:
            if key.char == PTT_KEY:
                ptt.on_trigger()
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
            if isinstance(raw, str) and raw.strip():
                set_stream_title(raw.strip())
    finally:
        kb.stop()
        ptt.cancel("shutdown")
        print("[stream_title] Stopped.")

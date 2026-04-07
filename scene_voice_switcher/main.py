from __future__ import annotations

import queue
import re
import sys
import threading
from difflib import SequenceMatcher

from pynput import keyboard

import obs
from .config import GAME_SCENE, LOBBIES_SCENE, PTT_KEY, RECORD_TIMEOUT_SECONDS, SOURCE_ALIASES

# ---------------------------------------------------------------------------
# Track which source is currently visible so we can hide it on scene change.
# ---------------------------------------------------------------------------
_active_source: str | None = None
_active_source_lock = threading.Lock()


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _compact(text: str) -> str:
    return _normalize(text).replace(" ", "")


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


# ---------------------------------------------------------------------------
# OBS helpers with error guards
# ---------------------------------------------------------------------------

def _safe_switch_scene(scene: str) -> bool:
    """Switch scene and return True on success."""
    try:
        obs.switch_scene(scene)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[scene_voice_switcher] ERROR switching to scene {scene!r}: {exc}")
        return False


def _safe_show_source(scene: str, source: str) -> bool:
    """Show a source and return True on success."""
    try:
        obs.show_source(scene, source)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[scene_voice_switcher] ERROR showing source {source!r} in {scene!r}: {exc}")
        return False


def _safe_hide_source(scene: str, source: str) -> bool:
    """Hide a source and return True on success."""
    try:
        obs.hide_source(scene, source)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[scene_voice_switcher] ERROR hiding source {source!r} in {scene!r}: {exc}")
        return False


def _deactivate_current_source() -> None:
    """Hide whichever Lobbies source is currently active, if any."""
    global _active_source
    with _active_source_lock:
        source = _active_source
        _active_source = None

    if source is not None:
        _safe_hide_source(LOBBIES_SCENE, source)
        print(f"[scene_voice_switcher] Hidden source: {source}")


# ---------------------------------------------------------------------------
# Matching logic
# ---------------------------------------------------------------------------

def _match_lobbies_source(raw_text: str) -> str | None:
    normalized = _normalize(raw_text)
    compact = _compact(raw_text)

    if not normalized:
        return None

    for source_name, aliases in SOURCE_ALIASES.items():
        for alias in aliases:
            alias_norm = _normalize(alias)
            alias_compact = _compact(alias)

            if alias_norm and alias_norm in normalized:
                return source_name
            if alias_compact and alias_compact in compact:
                return source_name
            if _similar(normalized, alias_norm) >= 0.82:
                return source_name
            if _similar(compact, alias_compact) >= 0.86:
                return source_name

    tokens = set(normalized.split())

    # FutureLobby fallback: any combo of future/feature/futur + optional lobby
    has_lobby = any(t in tokens for t in {"lobby", "lobbies"})
    has_future = any(t in tokens for t in {"future", "feature", "futur"})
    if has_future and (has_lobby or len(tokens) == 1):
        return "FutureLobby"

    # TavernLobby fallback
    has_tavern = any(t in tokens for t in {"tavern", "tabern"})
    if has_tavern and (has_lobby or len(tokens) == 1):
        return "TavernLobby"

    return None


def _is_game_command(raw_text: str) -> bool:
    normalized = _normalize(raw_text)
    if not normalized:
        return False

    # Single word "game" or common short phrases
    return normalized in {
        "game",
        "the game",
        "go game",
        "switch game",
        "scene game",
        "game scene",
        "test",
        "go test",
    }


# ---------------------------------------------------------------------------
# Command dispatch
# ---------------------------------------------------------------------------

def _handle_command(raw_text: str) -> None:
    global _active_source

    text = raw_text.strip()
    if not text:
        return

    if _is_game_command(text):
        # Hide any active lobby source before leaving the Lobbies scene.
        _deactivate_current_source()
        if _safe_switch_scene(GAME_SCENE):
            print(f"[scene_voice_switcher] Switched to scene: {GAME_SCENE}")
        return

    source_name = _match_lobbies_source(text)
    if source_name is not None:
        # Always synchronize: hide whatever was tracked, show the requested one.
        # We don't skip even if the name matches, because OBS scene-item state
        # can drift out of sync if the scene was switched manually in OBS.
        with _active_source_lock:
            previous_source = _active_source
            _active_source = source_name

        if previous_source is not None:
            _safe_hide_source(LOBBIES_SCENE, previous_source)

        if _safe_switch_scene(LOBBIES_SCENE):
            if _safe_show_source(LOBBIES_SCENE, source_name):
                print(
                    f"[scene_voice_switcher] Switched to scene: {LOBBIES_SCENE} | "
                    f"Enabled source: {source_name}"
                )
            else:
                with _active_source_lock:
                    _active_source = previous_source
        else:
            with _active_source_lock:
                _active_source = previous_source
        return

    print(f"[scene_voice_switcher] No match for transcript: {text!r}")


# ---------------------------------------------------------------------------
# Main run loop
# ---------------------------------------------------------------------------

def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    recording = [False]
    timer: list[threading.Timer | None] = [None]
    lock = threading.Lock()

    def _get_voice_mod():
        return sys.modules.get("voice.listener")

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
            except Exception as exc:  # noqa: BLE001
                print(f"[scene_voice_switcher] WARNING: stop_and_transcribe failed ({exc})")

        print(f"[scene_voice_switcher] Recording cancelled ({reason})")

    def _on_ptt() -> None:
        voice_mod = _get_voice_mod()
        if voice_mod is None:
            print("[scene_voice_switcher] Voice module not ready yet.")
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
                except Exception as exc:  # noqa: BLE001
                    # If recording fails to start, reset state cleanly.
                    print(f"[scene_voice_switcher] ERROR: start_recording failed ({exc})")
                    recording[0] = False
                    current_timer.cancel()
                    timer[0] = None
                    return
                print("[scene_voice_switcher] Listening...")
                return

            recording[0] = False
            current_timer = timer[0]
            timer[0] = None

        if current_timer is not None:
            current_timer.cancel()

        try:
            voice_mod.stop_and_transcribe(_send)
        except Exception as exc:  # noqa: BLE001
            print(f"[scene_voice_switcher] ERROR: stop_and_transcribe failed ({exc})")

    def on_press(key) -> None:
        try:
            if key.char == PTT_KEY:
                _on_ptt()
        except AttributeError:
            pass  # Special/modifier key — safe to ignore.
        except Exception as exc:  # noqa: BLE001
            print(f"[scene_voice_switcher] WARNING: unexpected key error ({exc})")

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print(f"[scene_voice_switcher] Hotkey '{PTT_KEY}' armed.")

    try:
        while not stop_event.is_set():
            try:
                raw = input_queue.get(timeout=0.5)
            except queue.Empty:
                continue
            except Exception as exc:  # noqa: BLE001
                print(f"[scene_voice_switcher] WARNING: queue error ({exc})")
                continue

            if not isinstance(raw, str) or not raw.strip():
                continue

            try:
                _handle_command(raw)
            except Exception as exc:  # noqa: BLE001
                print(f"[scene_voice_switcher] ERROR in _handle_command: {exc}")

    finally:
        kb.stop()
        _cancel("shutdown")
        # Best-effort: hide any still-active source on exit.
        _deactivate_current_source()
        print("[scene_voice_switcher] Stopped.")
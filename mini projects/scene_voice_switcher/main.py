from __future__ import annotations

import queue
import re
import threading
import time
from difflib import SequenceMatcher

import events as hub_events
import obs
from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from shared import VoicePTT

from .config import GAME_SCENE, LOBBIES_SCENE, PTT_KEY, RECORD_TIMEOUT_SECONDS, SOURCE_ALIASES


# ---------------------------------------------------------------------------
# Text normalisation helpers
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _compact(text: str) -> str:
    return _normalize(text).replace(" ", "")


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _camel_split(name: str) -> list[str]:
    """Split a CamelCase / PascalCase name into lowercase words."""
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", name)
    return [w.lower() for w in spaced.split() if w]


# ---------------------------------------------------------------------------
# Lobby discovery  (called once at startup, after OBS is connected)
# ---------------------------------------------------------------------------

def _discover_lobbies() -> dict[str, list[str]]:
    """
    Query OBS for every source/group in LOBBIES_SCENE and build a voice-alias
    map  {obs_source_name: [alias, alias, ...]}.
    """
    sources = obs.list_group_sources(LOBBIES_SCENE)

    if not sources:
        print(
            f"[scene_voice_switcher] No sources found in '{LOBBIES_SCENE}'. "
            "Is the scene name correct and is OBS connected?"
        )

    result: dict[str, list[str]] = {}

    for name in sources:
        aliases: set[str] = set()
        words = _camel_split(name)
        aliases.add(name.lower())
        aliases.add(" ".join(words))
        aliases.update(words)
        for alias in SOURCE_ALIASES.get(name, ()):
            aliases.add(alias.lower())
        result[name] = sorted(aliases)

    for name, extra_aliases in SOURCE_ALIASES.items():
        if name not in result:
            result[name] = [a.lower() for a in extra_aliases]
            print(
                f"[scene_voice_switcher] '{name}' is in SOURCE_ALIASES but "
                f"not found in '{LOBBIES_SCENE}' - added from config only."
            )

    print(f"[scene_voice_switcher] Discovered {len(result)} lobby source(s):")
    for src, aliases in result.items():
        print(f"    - {src} -> {aliases}")

    return result


# ---------------------------------------------------------------------------
# OBS helpers
# ---------------------------------------------------------------------------

def _safe_switch_scene(scene: str) -> bool:
    try:
        obs.switch_scene(scene)
        return True
    except Exception as exc:
        print(f"[scene_voice_switcher] ERROR switching to scene {scene!r}: {exc}")
        return False


def _safe_show_source(scene: str, source: str) -> bool:
    try:
        obs.show_source(scene, source)
        return True
    except Exception as exc:
        print(f"[scene_voice_switcher] ERROR showing source {source!r} in {scene!r}: {exc}")
        return False


def _safe_hide_source(scene: str, source: str) -> None:
    try:
        obs.hide_source(scene, source)
    except Exception as exc:
        print(f"[scene_voice_switcher] ERROR hiding source {source!r} in {scene!r}: {exc}")


def _hide_all_lobby_sources(lobbies: dict[str, list[str]]) -> None:
    for source in lobbies:
        _safe_hide_source(LOBBIES_SCENE, source)


def _switch_to_lobby_and_show_default(source: str, attempts: int = 5, delay: float = 0.2) -> bool:
    """Switch to the lobby scene and retry the default source briefly."""
    if not _safe_switch_scene(LOBBIES_SCENE):
        return False

    for attempt in range(1, attempts + 1):
        if _safe_show_source(LOBBIES_SCENE, source):
            return True
        if attempt < attempts:
            time.sleep(delay)
    return False


# ---------------------------------------------------------------------------
# Matching logic
# ---------------------------------------------------------------------------

def _match_lobbies_source(raw_text: str, lobbies: dict[str, list[str]]) -> str | None:
    normalized = _normalize(raw_text)
    compact = _compact(raw_text)

    if not normalized:
        return None

    for source_name, aliases in lobbies.items():
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

    return None


def _is_game_command(raw_text: str) -> bool:
    normalized = _normalize(raw_text)
    return normalized in {
        "game", "the game", "go game", "switch game",
        "scene game", "game scene", "test", "go test",
    }


# ---------------------------------------------------------------------------
# Command dispatch
# ---------------------------------------------------------------------------

def _handle_command(
    raw_text: str,
    lobbies: dict[str, list[str]],
    active_source: list[str | None],
    active_lock: threading.Lock,
) -> None:
    text = raw_text.strip()
    if not text:
        return

    if _is_game_command(text):
        _hide_all_lobby_sources(lobbies)
        with active_lock:
            active_source[0] = None
        if _safe_switch_scene(GAME_SCENE):
            print(f"[scene_voice_switcher] Switched to: '{GAME_SCENE}'")
        return

    source_name = _match_lobbies_source(text, lobbies)
    if source_name is not None:
        for src in lobbies:
            if src != source_name:
                _safe_hide_source(LOBBIES_SCENE, src)

        _safe_switch_scene(LOBBIES_SCENE)
        if _safe_show_source(LOBBIES_SCENE, source_name):
            with active_lock:
                active_source[0] = source_name
            print(f"[scene_voice_switcher] Scene: '{LOBBIES_SCENE}' | Showing: '{source_name}'")
        return

    print(f"[scene_voice_switcher] No match for: {text!r}")
    print(f"[scene_voice_switcher] Known lobbies: {', '.join(lobbies.keys())}")


# ---------------------------------------------------------------------------
# Main run loop
# ---------------------------------------------------------------------------

def run(
    input_queue: queue.Queue,
    stop_event: threading.Event,
    *,
    startup_event: threading.Event | None = None,
) -> None:
    lobbies = _discover_lobbies()

    active_source: list[str | None] = [None]
    active_lock = threading.Lock()

    def _hide_active_source() -> None:
        with active_lock:
            src = active_source[0]
            active_source[0] = None
        if src is not None:
            _safe_hide_source(LOBBIES_SCENE, src)

    from .interface import _live
    _live["active_source"] = active_source
    _live["hide_active"] = _hide_active_source

    # league emits these instead of switching scenes directly, so that this
    # project - which owns the "Test" and "Lobbies" scenes - controls all
    # scene transitions.

    def _on_game_connected(data: dict) -> None:
        """League game detected -> switch to game scene."""
        _hide_all_lobby_sources(lobbies)
        with active_lock:
            active_source[0] = None
        if _safe_switch_scene(GAME_SCENE):
            print(f"[scene_voice_switcher] League game started -> '{GAME_SCENE}'.")

    DEFAULT_LOBBY_SOURCE = "TavernLobby"

    def _on_game_disconnected(data: dict) -> None:
        """League game ended -> return to lobby scene, show TavernLobby."""
        for src in lobbies:
            if src != DEFAULT_LOBBY_SOURCE:
                _safe_hide_source(LOBBIES_SCENE, src)
        if _switch_to_lobby_and_show_default(DEFAULT_LOBBY_SOURCE):
            with active_lock:
                active_source[0] = DEFAULT_LOBBY_SOURCE
        else:
            print(
                f"[scene_voice_switcher] Failed to restore default lobby "
                f"'{DEFAULT_LOBBY_SOURCE}' after game end."
            )
        print(f"[scene_voice_switcher] League game ended -> '{LOBBIES_SCENE}' | '{DEFAULT_LOBBY_SOURCE}'.")

    hub_events.subscribe("game.connected", _on_game_connected)
    hub_events.subscribe("game.disconnected", _on_game_disconnected)

    ptt = VoicePTT(
        timeout=RECORD_TIMEOUT_SECONDS,
        on_transcript=lambda text: input_queue.put(text.strip()) if text and text.strip() else None,
        tag="scene_voice_switcher",
    )

    def on_press(key) -> None:
        try:
            char = key_char(key)
            if char == PTT_KEY:
                ptt.on_trigger()
        except Exception as exc:
            print(f"[scene_voice_switcher] Key error ({exc})")

    kb_token = subscribe_global_hotkeys(on_press)
    print(f"[scene_voice_switcher] Hotkey '{PTT_KEY}' armed.")
    if startup_event is not None:
        startup_event.set()

    try:
        while not stop_event.is_set():
            try:
                raw = input_queue.get(timeout=0.5)
            except queue.Empty:
                continue
            except Exception as exc:
                print(f"[scene_voice_switcher] Queue error ({exc})")
                continue

            if not isinstance(raw, str) or not raw.strip():
                continue

            if raw.strip().lower() in ("refresh lobbies", "reload lobbies"):
                lobbies = _discover_lobbies()
                continue

            try:
                _handle_command(raw, lobbies, active_source, active_lock)
            except Exception as exc:
                print(f"[scene_voice_switcher] ERROR in _handle_command: {exc}")
    finally:
        hub_events.unsubscribe("game.connected", _on_game_connected)
        hub_events.unsubscribe("game.disconnected", _on_game_disconnected)
        unsubscribe_global_hotkeys(kb_token)
        ptt.cancel("shutdown")
        with active_lock:
            src = active_source[0]
        if src is not None:
            _safe_hide_source(LOBBIES_SCENE, src)
        print("[scene_voice_switcher] Stopped.")

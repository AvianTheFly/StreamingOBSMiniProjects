from __future__ import annotations

import queue
import threading
import events as hub_events
from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from shared import VoicePTT
from lib.coordination.game_policy import game_scene_policy
from lib.coordination.scenes import scene_director
from lib.coordination.lobbies import lobby_catalog
from .config import LOBBIES_SCENE, PTT_KEY, RECORD_TIMEOUT_SECONDS
from .commands import _match_lobbies_source, _is_game_command
from .inventory import _discover_lobbies, publish_inventory
from .routing import show_lobby, show_game


def _handle_command(raw_text, lobbies, active_source, active_lock):
    text = raw_text.strip()
    if _is_game_command(text):
        if show_game():
            with active_lock:
                active_source[0] = None
        return
    random_command = text.lower() in ('lobby', 'random lobby', 'next lobby', 'another lobby')
    selected = None if random_command else _match_lobbies_source(text, lobbies)
    if selected is None and not random_command:
        print(f'[scene_voice_switcher] No match: {text!r}; lobbies: {list(lobbies)}')
        return
    applied, source = show_lobby(lobbies, selected=selected)
    if applied:
        with active_lock:
            active_source[0] = source
        print(f'[scene_voice_switcher] Showing {source}')


def run(input_queue: queue.Queue, stop_event: threading.Event, *, startup_event=None):
    lobbies = _discover_lobbies()
    publish_inventory(lobbies)
    active_source = [None]
    active_lock = threading.Lock()
    # Events, commands and delayed returns share one bounded-lifetime loop.
    pending_revision = None
    def connected(data):
        input_queue.put(('game.connected', scene_director.snapshot()['manual_revision']))
    def disconnected(data):
        game_scene_policy.hold(disconnected=True)
        input_queue.put(('game.disconnected', scene_director.snapshot()['manual_revision']))
    def revert():
        input_queue.put('game')

    from .interface import _live
    _live['active_source'] = active_source
    _live['hide_active'] = revert
    ptt = None
    kb_token = None
    try:
        hub_events.subscribe('game.connected', connected)
        hub_events.subscribe('game.disconnected', disconnected)
        ptt = VoicePTT(timeout=RECORD_TIMEOUT_SECONDS,
            on_transcript=lambda text: input_queue.put(text.strip()) if text and text.strip() else None,
            tag='scene_voice_switcher')
        def on_press(key):
            if key_char(key) == PTT_KEY:
                ptt.on_trigger()
        kb_token = subscribe_global_hotkeys(on_press)
        print(f'[scene_voice_switcher] Hotkey {PTT_KEY!r} armed.')
        if startup_event is not None:
            startup_event.set()
        while not stop_event.is_set():
            try:
                raw = input_queue.get(timeout=.1)
            except queue.Empty:
                raw = None
            try:
                if isinstance(raw, tuple):
                    event, revision = raw
                    scene_director.cancel_pending('scene_voice_switcher')
                    pending_revision = None
                    if event == 'game.connected':
                        show_game(automatic=True, expected_manual_revision=revision)
                        with active_lock:
                            active_source[0] = None
                    elif not game_scene_policy.automatic_lobbies():
                        pending_revision = revision
                elif isinstance(raw, str) and raw.strip():
                    scene_director.cancel_pending('scene_voice_switcher')
                    pending_revision = None
                    if raw.strip().lower() in ('refresh lobbies', 'reload lobbies'):
                        lobbies = _discover_lobbies()
                        publish_inventory(lobbies)
                    else:
                        lobbies = _discover_lobbies()
                        _handle_command(raw, lobbies, active_source, active_lock)
                if pending_revision is not None and game_scene_policy.hold() <= 0:
                    revision, pending_revision = pending_revision, None
                    if not game_scene_policy.automatic_lobbies() and not stop_event.is_set():
                        applied, source = show_lobby(lobbies, automatic=True, expected_manual_revision=revision)
                        if applied:
                            with active_lock:
                                active_source[0] = source
            except Exception as exc:
                print(f'[scene_voice_switcher] Routing error: {exc}')
    finally:
        scene_director.cancel_pending('scene_voice_switcher')
        hub_events.unsubscribe('game.connected', connected)
        hub_events.unsubscribe('game.disconnected', disconnected)
        lobby_catalog.unregister('scene_voice_switcher')
        unsubscribe_global_hotkeys(kb_token)
        if ptt is not None:
            ptt.cancel('shutdown')
        _live.clear()
        print('[scene_voice_switcher] Stopped.')

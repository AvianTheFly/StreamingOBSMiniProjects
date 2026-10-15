"""Assemble Replay components, bind voice/Hub controls, and handle game lifetime.

Capture, lookup/selection, source loading, playback, and desktop-audio restoration
have separate owners beside this module. Existing public helper imports remain
available for callers while their implementations live in those owners.
"""

from __future__ import annotations

import atexit
import queue
import threading
from datetime import datetime

from .commands import parse_command as _parse_command
from .voice_controls import ReplayVoiceControls
from . import stage
from .trimming import trim_from_end as _trim_from_end
from lib.global_hotkeys import key_char, subscribe_global_hotkeys, unsubscribe_global_hotkeys
from lib.runtime_cleanup import run_cleanup
from shared import VoicePTT

from .config import HOTKEY_LISTEN, RECORD_TIMEOUT_SECONDS
from .kill_tracker import KillTracker
from .runtime_state import ReplayState
from .capture import ReplayCapture, _saved_clip
from .inventory import ReplayInventory
from .selection import ReplaySelection
from .playback import ReplayPlayback
from .source_playback import _start_replay_clip, wait_for_replay_start
from .audio import _mute_desktop, _unmute_desktop

from .cleanup import start_deferred, run_for_game, _read_next_game_num, _write_next_game_num


def run(
    input_queue: queue.Queue,
    stop_event: threading.Event,
    *,
    startup_event: threading.Event | None = None,
) -> None:
    """Called by the hub in a daemon thread."""

    # ── Kill tracker ──────────────────────────────────────────────────────────
    tracker = KillTracker(stop_event)
    tracker.start()

    # ── Auto-cleanup old replay clips (60 s delay so we don't clash with OBS)
    start_deferred(stop_event)

    from .interface import _live
    state = ReplayState()
    capture = ReplayCapture(state, tracker)
    views = ReplayInventory(state)
    playback = ReplayPlayback(state, _live)
    selection = ReplaySelection(state, views, playback)
    _clip_registry = state._clip_registry
    _current_game_label = state._current_game_label
    _lock = state._lock
    _previous_game_clips = state._previous_game_clips
    _replay_active = state._replay_active
    _replay_paused = state._replay_paused
    _skip_clip = state._skip_clip
    _tag_counters = state._tag_counters
    _was_in_game = state._was_in_game
    _on_mark = capture._on_mark
    _on_save = capture._on_save
    _list_clips = views._list_clips
    _on_play = selection._on_play
    _play_clip_path = selection._play_clip_path
    def _end_replay(*, cancelled=False):
        selection.cancel_pending()
        playback._end_replay(cancelled=cancelled)

    def _save_replay(pressed_at=None, **options):
        return selection.capture_and_replay(capture, pressed_at=pressed_at, **options)
    def _quick_replay(seconds=15, pressed_at=None):
        return selection.capture_and_replay(capture, seconds=seconds,
                                            purpose='replay_only', pressed_at=pressed_at)
    _pause_replay = playback._pause_replay
    _resume_replay = playback._resume_replay
    _play_all_clips_sequential = playback._play_all_clips_sequential
    _playback_gate = playback._playback_gate
    generation = object()
    bindings = {
        '_runtime_generation': generation,
        'replay_active': _replay_active, 'replay_paused': _replay_paused,
        'end_replay': _end_replay, 'list_clips': _list_clips, 'playback_detail': {},
        'pause_replay': _pause_replay, 'resume_replay': _resume_replay,
        'play_clip': _play_clip_path, 'play_sequence': _play_all_clips_sequential,
        'playback_busy': _playback_gate.locked, 'skip_clip': _skip_clip.set,
        'queue_state': playback.queue.snapshot, 'queue_edit': playback.edit_queue,
        'queue_remove_paths': playback.queue.remove_paths,
        'play_spec': _on_play, 'save_clip': _on_save, 'mark': _on_mark,
        'stage_state': stage.state, 'set_companion': stage.set_companion,
        'in_game': lambda: tracker.game_connected,
        'save_replay': _save_replay, 'quick_replay': _quick_replay,
    }

    # VoiceService owns microphone, transcription and bounded delivery.
    voice = ReplayVoiceControls(capture, selection, playback, state, stop_event)
    ptt = VoicePTT(
        timeout=RECORD_TIMEOUT_SECONDS,
        on_transcript=voice.dispatch,
        on_timed_transcript=voice.dispatch,
        tag="instant_replay",
    )

    def on_press(key) -> None:
        if not stop_event.is_set() and key_char(key) == HOTKEY_LISTEN:
            # The same gesture listens while idle, playing, paused or waiting.
            ptt.on_trigger()

    kb_token = subscribe_global_hotkeys(on_press)
    try:
        stage.install()
    except Exception as exc:
        print(f"[instant_replay] Stage setup unavailable: {exc}")
    # Publish after microphone/keyboard setup; failed startup must not leave
    # callable controls behind. Cleanup may only withdraw its own generation.
    atexit.register(_unmute_desktop)
    _live.update(bindings)
    print(
        f"[instant_replay] ⌨  Armed — press '{HOTKEY_LISTEN}' to start recording, "
        "then finish speaking and pause, or press 'C' or trigger again to transcribe. "
        "Say 'mark', 'save', 'replay now', or 'play last'. During replay: 'pause', 'resume', 'next', 'stop'."
    )
    if startup_event is not None:
        startup_event.set()

    # ── Main loop — processes nothing directly but keeps the thread alive ─────
    # Commands run separately from the shared transcription worker.
    try:
        while not stop_event.is_set():
            try:
                input_queue.get(timeout=0.5)
            except queue.Empty:
                pass

            # Detect game-end: was in-game but now disconnected → reset registry.
            now_in_game = tracker.game_connected
            if _was_in_game[0] and not now_in_game:
                with _lock:
                    n = len(_clip_registry)
                    # Preserve clips for post-game "play highlights" before clearing.
                    _previous_game_clips.clear()
                    _previous_game_clips.extend(_clip_registry)
                    _clip_registry.clear()
                    _tag_counters.clear()

                    # Assign a persistent game label for the reel that will be compiled.
                    game_num  = _read_next_game_num()
                    date_str  = datetime.now().strftime("%Y-%m-%d")
                    game_label = f"Game {game_num} {date_str}"
                    _write_next_game_num(game_num + 1)
                    _current_game_label[0] = game_label

                print(
                    f"[instant_replay] Game ended — clip registry cleared "
                    f"({n} clip(s) flushed, files remain on disk)."
                )
                print(f"[instant_replay] This game will be labelled: {game_label}")

                def _game_end_merge(_label: str = game_label) -> None:
                    if not stop_event.wait(30):
                        run_for_game(_label)

                threading.Thread(
                    target=_game_end_merge, daemon=True, name="ir-game-end-merge"
                ).start()

            _was_in_game[0] = now_in_game
    finally:
        atexit.unregister(_unmute_desktop)
        run_cleanup("instant_replay", lambda: unsubscribe_global_hotkeys(kb_token),
                    lambda: ptt.cancel("shutdown"), selection.cancel_pending, playback.shutdown, selection.shutdown)
        if _live.get('_runtime_generation') is generation:
            for key in bindings:
                _live.pop(key, None)
        print("[instant_replay] Stopped.")

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
    _cancel_watcher = state._cancel_watcher
    _clip_registry = state._clip_registry
    _current_game_label = state._current_game_label
    _is_multi_clip_active = state._is_multi_clip_active
    _last_save_cmd_time = state._last_save_cmd_time
    _lock = state._lock
    _manual_mark_wall = state._manual_mark_wall
    _previous_game_clips = state._previous_game_clips
    _random_playback_active = state._random_playback_active
    _replay_active = state._replay_active
    _replay_paused = state._replay_paused
    _save_done_event = state._save_done_event
    _save_in_progress = state._save_in_progress
    _scene_session = state._scene_session
    _skip_clip = state._skip_clip
    _tag_counters = state._tag_counters
    _was_in_game = state._was_in_game
    _watcher_thread = state._watcher_thread
    _on_mark = capture._on_mark
    _on_save = capture._on_save
    _list_clips = views._list_clips
    _get_most_recent_clip = views._get_most_recent_clip
    _get_all_clips_in_order = views._get_all_clips_in_order
    _resolve_play_spec = views._resolve_play_spec
    _format_tag_summary = views._format_tag_summary
    _on_play = selection._on_play
    _play_clip_path = selection._play_clip_path
    def _end_replay(*, cancelled=False):
        selection.cancel_pending()
        playback._end_replay(cancelled=cancelled)

    def _save_replay(pressed_at=None):
        return selection.capture_and_replay(capture, pressed_at=pressed_at)
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
        'play_spec': _on_play, 'save_clip': _on_save, 'mark': _on_mark,
        'stage_state': stage.state, 'set_companion': stage.set_companion,
        'in_game': lambda: tracker.game_connected,
        'save_replay': _save_replay, 'quick_replay': _quick_replay,
    }

    # VoiceService delivers commands outside the microphone/inference worker.

    def _run_voice_command(text: str, pressed_at: float | None) -> None:
        if stop_event.is_set():
            return
        print(f"[instant_replay] 💬 Heard: {text!r}")
        cmd, spec, clip_seconds, full_save = _parse_command(text)
        if cmd == "save":
            _on_save(tag=spec, clip_seconds=clip_seconds, full_save=full_save, pressed_at=pressed_at)
        elif cmd == 'save_replay':
            _save_replay(pressed_at)
        elif cmd == 'quick_replay':
            _quick_replay(clip_seconds or 15, pressed_at)
        elif cmd == "play":
            _on_play(spec)
        elif cmd == "mark":
            _on_mark()
        elif cmd == "stop":
            print("[instant_replay] ⏹ Leaving replay.")
            _cancel_watcher.set()
            _end_replay(cancelled=True)
        elif cmd == "next":
            if _replay_active[0]:
                _skip_clip.set()
        elif cmd == "screen":
            stage.set_companion(spec == "on")
        elif cmd == 'view':
            stage.set_view(spec)
        else:
            print(
                f"[instant_replay] ⚠  Didn't recognise a command in {text!r}. "
                "Say 'random', 'stop replay', 'play last', 'save', or 'mark'. See Instant Replay in the Hub for all commands."
            )

    ptt = VoicePTT(
        timeout=RECORD_TIMEOUT_SECONDS,
        on_transcript=lambda text: _run_voice_command(text, None),
        on_timed_transcript=_run_voice_command,
        tag="instant_replay",
    )


    def _on_listen_key() -> None:
        if stop_event.is_set():
            return
        # Pressing "|" during replay:
        #   • Single-clip playback  → cancel immediately (existing behaviour)
        #   • Multi-clip playback   → first press skips to next clip;
        #                             second press (while still in multi) cancels all
        with _lock:
            replay_running = _replay_active[0]
            is_multi = _is_multi_clip_active[0]
            is_random = _random_playback_active[0]

        if replay_running:
            if is_random:
                print("[instant_replay] ⏹ Hotkey pressed during random replay — leaving replay.")
                _cancel_watcher.set()
                _end_replay(cancelled=True)
            elif is_multi and not _skip_clip.is_set():
                print("[instant_replay] ⏭  Hotkey pressed — skipping to next clip.")
                _skip_clip.set()
            else:
                print("[instant_replay] ⏹  Hotkey pressed during replay — cancelling.")
                _cancel_watcher.set()
                _end_replay(cancelled=True)
            return

        ptt.on_trigger()


    def on_press(key) -> None:
        if stop_event.is_set():
            return
        char = key_char(key)
        if char == HOTKEY_LISTEN:
            threading.Thread(target=_on_listen_key, daemon=True).start()

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
        "then press 'C' or trigger again to transcribe (auto-transcribes in 2s). "
        "Say 'save [tag]', 'mark', 'play [spec]', or 'stop replay'."
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

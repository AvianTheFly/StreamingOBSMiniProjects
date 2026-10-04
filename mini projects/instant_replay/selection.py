"""Interpret playback selections and the save-then-play handshake."""
from __future__ import annotations
import re
import threading
import time
from pathlib import Path
from .config import PLAY_AFTER_SAVE_WINDOW
from .config import REPLAY_DIR
from .config import REPLAY_SAVE_TIMEOUT
from .cleanup import list_edited_reels
from .inventory import _replay_files_on_disk
from lib.coordination.scenes import scene_director
from . import stage

_HIGHLIGHTS_KEYWORDS = frozenset(['highlight', 'highlights', 'reel', 'highlight reel', 'last game', 'game', 'recap', 'montage', 'all'])


class ReplaySelection:

    def __init__(self, state, library, playback):
        self.state, self.library, self.playback = (state, library, playback)
        self._deferred_gate = threading.Lock()
        self._deferred_cancel = threading.Event()
        self._deferred_thread = None

    def cancel_pending(self):
        self._deferred_cancel.set()
        stage.waiting(False)

    def shutdown(self):
        self.cancel_pending()
        if self._deferred_thread is not None:
            self._deferred_thread.join(timeout=2)

    def capture_and_replay(self, capture, *, seconds=0, purpose='highlight', pressed_at=None):
        if self.playback._playback_gate.locked() or self._deferred_gate.locked():
            return False
        if not capture._on_save(clip_seconds=seconds, purpose=purpose, pressed_at=pressed_at):
            return False
        return self.queue_saved_replay(force_replay=True, mode='replay')

    def queue_saved_replay(self, *, force_replay=False, mode=None):
        """One bounded save continuation; failures never replay an older capture."""
        if not self._deferred_gate.acquire(blocking=False):
            return False
        self._deferred_cancel.clear()
        with self.state._lock:
            done = self.state._save_done_event[0]
            result = self.state._save_result[0]
        revision = scene_director.snapshot()['manual_revision']
        stage.waiting(True)

        def wait_and_play():
            try:
                deadline = time.monotonic() + REPLAY_SAVE_TIMEOUT + 5
                while not done.is_set() and not self._deferred_cancel.is_set():
                    if time.monotonic() >= deadline:
                        return
                    done.wait(.1)
                if self._deferred_cancel.is_set() or scene_director.snapshot()['manual_revision'] != revision:
                    return
                path = result.get('path')
                if path:
                    stage.waiting(False)
                    self.playback._play_all_clips_sequential([path],
                        presentation='replay' if force_replay else None, mode=mode)
                else:
                    print('[instant_replay] Deferred replay cancelled: capture did not produce a new clip.')
            finally:
                stage.waiting(False)
                self._deferred_gate.release()
        self._deferred_thread = threading.Thread(target=wait_and_play, daemon=True, name='ir-save-then-play')
        try:
            self._deferred_thread.start()
        except BaseException:
            self._deferred_gate.release()
            raise
        return True

    def _on_play(self, spec: str='') -> None:
        """
        Route based on the play spec:
          "" / "last"          -> most recent clip (or deferred save-then-play)
            "random"             -> keep choosing saved clips until stopped
            "all" / "highlights" -> all clips from current game; if none, previous game
          "game N"             -> play the highlight reel for Game N from edited/
          "game last"          -> play the most recent highlight reel from edited/
          "<tag>"              -> most recent clip of that tag
          "<tag> <N>"          -> Nth clip of that tag

        During multi-clip playback, pressing '|' skips to the next clip.
        """
        spec_lower = spec.strip().lower()
        force_replay = spec_lower == 'replay'
        force_showcase = spec_lower == 'showcase'
        if force_replay or force_showcase:
            spec_lower = 'last'
        if spec_lower.startswith(('intro ', 'group ')):
            from . import library
            try:
                clips = library.group_paths(spec_lower.split(' ', 1)[1], REPLAY_DIR, by_name=True)
                self.playback._play_all_clips_sequential(clips, presentation='highlights')
            except ValueError as exc:
                print(f'[instant_replay] {exc}')
            return
        if spec_lower in {'random', 'random clip', 'anything', 'any', 'surprise me'}:
            candidates = _replay_files_on_disk(highlights_only=True)
            if not candidates:
                print('[instant_replay] No saved clips available for random playback.')
                return
            print(f"[instant_replay] 🎲 Continuous random started ({len(candidates)} clip(s)). Press '|' again or say 'stop replay' to leave; use Stop Replay in the Hub too.")
            self.playback._play_all_clips_sequential([], random_forever=True)
            return
        game_match = re.match('game\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|last|latest)$', spec_lower)
        if game_match:
            token = game_match.group(1)
            _WORD_NUMS = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10}
            from . import library
            reels = list_edited_reels()
            archived_numbers = library.game_numbers()
            if token in ('last', 'latest'):
                available_numbers = archived_numbers + [n for n, _ in reels]
                if not available_numbers:
                    print('[instant_replay] No saved game highlights yet.')
                    return
                target_num = max(available_numbers)
            else:
                try:
                    target_num = int(token)
                except ValueError:
                    target_num = _WORD_NUMS.get(token, -1)
            archived = library.game_paths(target_num, REPLAY_DIR)
            if archived:
                print(f'[instant_replay] Playing Game {target_num} ({len(archived)} individual cut(s)).')
                self.playback._play_all_clips_sequential(archived, presentation='highlights')
                return
            matches = [(n, p) for n, p in reels if n == target_num]
            if not matches:
                available = ', '.join((f'Game {n}' for n in sorted(set(archived_numbers + [n for n, _ in reels]))))
                print(f"[instant_replay] No highlights for Game {target_num}. Available: {available or '(none)'}")
                return
            _, reel_path = matches[0]
            print(f'[instant_replay] Playing legacy reel: {reel_path.name}')
            self.playback._play_all_clips_sequential([str(reel_path)], presentation='highlights')
            return
        if spec_lower and any((kw in spec_lower for kw in _HIGHLIGHTS_KEYWORDS)):
            with self.state._lock:
                current_clips = [e['path'] for e in self.state._clip_registry]
                prev_clips = [e['path'] for e in self.state._previous_game_clips]
            from . import library
            current_clips = library.highlight_paths(current_clips)
            prev_clips = library.highlight_paths(prev_clips)
            if current_clips:
                clips = current_clips
                label = f'current game ({len(clips)} clip(s))'
            elif prev_clips:
                clips = prev_clips
                label = f'previous game ({len(clips)} clip(s))'
            else:
                reels = list_edited_reels()
                if reels:
                    _, reel_path = reels[-1]
                    print(f'[instant_replay] No live clips — playing latest reel: {reel_path.name}')
                    self.playback._play_all_clips_sequential([str(reel_path)], presentation='highlights')
                    return
                else:
                    print("[instant_replay] No game clips yet. Save some with '|' + 'save' during a game.")
                    return
            if clips:
                print(f"[instant_replay] Playing {label}. Press '|' to skip to next clip.")
                self.playback._play_all_clips_sequential(clips, presentation='highlights')
                return
        if spec_lower and spec_lower not in ('last',):
            if not any((kw in spec_lower for kw in _HIGHLIGHTS_KEYWORDS)):
                clips = self.library._resolve_play_spec(spec_lower)
                if not clips:
                    print(f'[instant_replay] ⚠  No clips match {spec!r}. Available tags: {self.library._format_tag_summary()}')
                    return
                self.playback._play_all_clips_sequential(clips)
                return
        with self.state._lock:
            save_time = self.state._last_save_cmd_time[0]
            in_progress = self.state._save_in_progress[0]
            done_event = self.state._save_done_event[0]
        now = time.time()
        within_window = save_time is not None and now - save_time <= PLAY_AFTER_SAVE_WINDOW
        if in_progress and within_window:
            print(f'[instant_replay] ⏳ Save in progress — will play automatically once the clip is ready.')

            self.queue_saved_replay(force_replay=force_replay, mode='replay' if force_replay else 'showcase' if force_showcase else None)
            return
        clips = self.library._get_most_recent_clip()
        if force_showcase:
            candidates = _replay_files_on_disk(highlights_only=True)
            clips = [str(candidates[0])] if candidates else []
        if not clips:
            print("[instant_replay] ⚠  No clip ready. Press '|' and say 'save' first.")
            return
        print(f'[instant_replay] ▶ Playing most recent clip: {Path(clips[0]).name}')
        self.playback._play_all_clips_sequential(clips, presentation='replay' if force_replay else None,
                                                mode='replay' if force_replay else 'showcase' if force_showcase else None)

    def _play_clip_path(self, path_value: str) -> None:
        root = Path(REPLAY_DIR).resolve()
        candidate = Path(path_value).resolve()
        try:
            allowed = candidate.is_relative_to(root)
        except ValueError:
            allowed = False
        if not allowed or not candidate.is_file():
            print(f'[instant_replay] Refusing unknown clip path: {path_value}')
            return
        self.playback._play_all_clips_sequential([str(candidate)])

"""Replay marks, capture admission, saving, trimming, and persisted tags."""
from __future__ import annotations
import threading
import time
import math
from pathlib import Path
from .trimming import trim_from_end as _trim_from_end
from obs import save_replay_buffer_and_wait
from lib.twitch_clips import request_clip
from .config import DEATH_PRE_ROLL_SECONDS
from .config import KILL_PRE_ROLL_SECONDS
from .config import REPLAY_SAVE_TIMEOUT


def _saved_clip(replay_file: str, keep_seconds: float | None, *, full_save: bool, tail_seconds: float) -> str | None:
    """Full means the original OBS file; automatic saves retain their cutoff."""
    if full_save:
        return replay_file
    return _trim_from_end(replay_file, keep_seconds, tail_seconds=tail_seconds)

class ReplayCapture:

    def __init__(self, state, tracker):
        self.state, self.tracker = (state, tracker)

    def _on_mark(self) -> None:
        now = time.time()
        with self.state._lock:
            self.state._manual_mark_wall[0] = now
        print('[instant_replay] 📍 Mark set — clip will start from this moment.')

    def _on_save(self, tag: str='', clip_seconds: float=0, full_save: bool=False, pressed_at: float | None=None,
                 *, purpose='highlight') -> bool:
        if purpose not in ('highlight', 'replay_only'):
            raise ValueError('Choose Highlight candidate or Replay only.')
        if purpose == 'replay_only':
            clip_seconds = float(clip_seconds or 15)
            if not math.isfinite(clip_seconds) or not 3 <= clip_seconds <= 120 or full_save:
                raise ValueError('Replay-only captures use 3–120 seconds.')
        from events import inspect_event
        with self.state._lock:
            if self.state._save_in_progress[0]:
                inspect_event('replay.save', owner='instant_replay', phase='busy')
                print('[instant_replay] ⚠  Save already in progress — ignoring.')
                return False
            self.state._save_in_progress[0] = True
            manual_mark = self.state._manual_mark_wall[0]
            first_kill_time = self.tracker.first_kill_wall_time
            last_death_time = self.tracker.last_death_wall_time
        now = time.time() if pressed_at is None else pressed_at
        if full_save:
            keep_seconds = None
            anchor_label = 'full replay buffer'
        elif clip_seconds > 0:
            keep_seconds = clip_seconds
            anchor_label = f'explicit duration ({clip_seconds:.0f}s)'
        elif manual_mark is not None:
            keep_seconds = now - manual_mark
            anchor_label = f'manual mark ({keep_seconds:.1f}s ago)'
        elif first_kill_time is not None and first_kill_time <= now:
            keep_seconds = now - first_kill_time + KILL_PRE_ROLL_SECONDS
            anchor_label = f'kill anchor ({keep_seconds:.1f}s total)'
        elif last_death_time is not None and last_death_time <= now:
            keep_seconds = now - last_death_time + DEATH_PRE_ROLL_SECONDS
            anchor_label = f'death anchor ({keep_seconds:.1f}s total)'
        else:
            keep_seconds = None
            anchor_label = 'full buffer (no mark, kill, or death detected)'
        tag_label = f' [{tag}]' if tag else ''
        print(f'[instant_replay] 💾 Save{tag_label} triggered — anchor: {anchor_label}')
        with self.state._lock:
            self.state._save_in_progress[0] = True
            self.state._last_save_cmd_time[0] = now
            new_event = threading.Event()
            self.state._save_done_event[0] = new_event
            result = {}
            self.state._save_result[0] = result

        def _worker() -> None:
            from . import stage
            clip: str | None = None
            stage.capture_update('saving', purpose=purpose, seconds=clip_seconds,
                                 message='Capturing replay-only moment' if purpose == 'replay_only' else 'Saving highlight candidate')
            inspect_event('replay.save', owner='instant_replay', phase='saving')
            try:
                save_requested = [time.time()]
                def on_save_requested(timestamp):
                    save_requested[0] = timestamp
                    # Every accepted save (voice/shortcut/Hub) shares this path.
                    # Twitch captures its own stream window without delaying OBS.
                    if purpose == 'highlight':
                        try:
                            request_clip()
                        except Exception:
                            print('[instant_replay] Twitch clip request failed; continuing the OBS save.')
                replay_file = save_replay_buffer_and_wait(timeout=REPLAY_SAVE_TIMEOUT, on_save_requested=on_save_requested)
                if not replay_file:
                    print('[instant_replay] ❌ Timed out waiting for replay save. Is the replay buffer running in OBS?')
                    return
                from . import library
                if purpose == 'replay_only':
                    # Classify the OBS original too, so disk scans cannot put a
                    # duplicate of this moment into the montage review pool.
                    library.remember_capture(replay_file, purpose=purpose, saved_at=time.time())
                    clip = _trim_from_end(replay_file, keep_seconds,
                        tail_seconds=max(0, save_requested[0] - now), fast=True,
                        output_dir=Path(replay_file).parent / 'replay-only')
                else:
                    clip = _saved_clip(replay_file, keep_seconds, full_save=full_save,
                                       tail_seconds=max(0, save_requested[0] - now))
                if not clip:
                    return
                with self.state._lock:
                    if purpose == 'highlight':
                        self.state._manual_mark_wall[0] = None
                    idx = self.state._tag_counters.get(tag or 'untagged', 0) + 1
                    self.state._tag_counters[tag or 'untagged'] = idx
                    self.state._clip_registry.append({'tag': tag or 'untagged', 'path': clip, 'index_for_tag': idx, 'saved_at': time.time(), 'purpose': purpose})
                library.remember_capture(clip, tag=tag or 'untagged', saved_at=time.time(),
                                         purpose=purpose, capture_source=replay_file if purpose == 'replay_only' else None)
                result['path'] = clip
                result['purpose'] = purpose
                stage.capture_update('ready', purpose=purpose, seconds=clip_seconds, path=clip,
                                     message='Replay only · excluded from highlight review' if purpose == 'replay_only' else 'Saved · highlight candidate')
                inspect_event('replay.save', owner='instant_replay', phase='saved', source=Path(clip).name)
                print(f"[instant_replay] Clip ready ({tag or 'untagged'} #{idx}) — press '|' and say 'play'.")
            except Exception as exc:
                print(f'[instant_replay] Capture failed: {exc}')
            finally:
                if not result.get('path'):
                    stage.capture_update('error', purpose=purpose, seconds=clip_seconds,
                                         message='Capture failed. Check that the OBS replay buffer is running; no older clip was played.')
                if not clip: inspect_event('replay.save', owner='instant_replay', phase='failed')
                with self.state._lock:
                    self.state._save_in_progress[0] = False
                new_event.set()
        try:
            threading.Thread(target=_worker, daemon=True, name='ir-save-worker').start()
        except Exception:
            with self.state._lock:
                self.state._save_in_progress[0] = False
            new_event.set()
            raise
        return True

"""Admitted highlight, replay-only and review-later captures."""
from __future__ import annotations
import threading
import time
import math
import uuid
from pathlib import Path
from .trimming import trim_from_end as _trim_from_end
from obs import save_replay_buffer_and_wait
from lib.twitch_clips import request_clip
from .config import DEATH_PRE_ROLL_SECONDS
from .config import KILL_PRE_ROLL_SECONDS
from .config import REPLAY_SAVE_TIMEOUT
from .config import REVIEW_CAPTURE_SECONDS


def _saved_clip(replay_file: str, keep_seconds: float | None, *, full_save: bool, tail_seconds: float) -> str | None:
    """Full means the original OBS file; automatic saves retain their cutoff."""
    if full_save:
        return replay_file
    return _trim_from_end(replay_file, keep_seconds, tail_seconds=tail_seconds)

class ReplayCapture:

    def __init__(self, state, tracker):
        self.state, self.tracker = (state, tracker)

    def _on_mark(self, tag='', clip_seconds=0, full_save=False, pressed_at=None) -> bool:
        return self._on_save(tag=tag, clip_seconds=clip_seconds or REVIEW_CAPTURE_SECONDS,
                             full_save=full_save, pressed_at=pressed_at, purpose='review_later')

    def _on_save(self, tag: str='', clip_seconds: float=0, full_save: bool=False, pressed_at: float | None=None,
                 *, purpose='highlight') -> bool:
        if purpose not in ('highlight', 'replay_only', 'review_later'):
            raise ValueError('Choose Replay ready, Replay only or Review later.')
        if purpose == 'replay_only':
            clip_seconds = float(clip_seconds or 15)
            if not math.isfinite(clip_seconds) or not 3 <= clip_seconds <= 120 or full_save:
                raise ValueError('Replay-only captures use 3–120 seconds.')
        elif purpose == 'review_later':
            clip_seconds = float(clip_seconds or REVIEW_CAPTURE_SECONDS)
            if not full_save and (not math.isfinite(clip_seconds) or not 3 <= clip_seconds <= 120):
                raise ValueError('Review captures use 3–120 seconds, or mark full.')
        from events import inspect_event
        with self.state._lock:
            if self.state._save_in_progress[0]:
                inspect_event('replay.save', owner='instant_replay', phase='busy')
                print('[instant_replay] ⚠  Save already in progress — ignoring.')
                return False
            self.state._save_in_progress[0] = True
            first_kill_time = self.tracker.first_kill_wall_time
            last_death_time = self.tracker.last_death_wall_time
        now = time.time() if pressed_at is None else pressed_at
        if full_save:
            keep_seconds = None
            anchor_label = 'full replay buffer'
        elif clip_seconds > 0:
            keep_seconds = clip_seconds
            anchor_label = f'explicit duration ({clip_seconds:.0f}s)'
        elif first_kill_time is not None and first_kill_time <= now:
            keep_seconds = now - first_kill_time + KILL_PRE_ROLL_SECONDS
            anchor_label = f'kill anchor ({keep_seconds:.1f}s total)'
        elif last_death_time is not None and last_death_time <= now:
            keep_seconds = now - last_death_time + DEATH_PRE_ROLL_SECONDS
            anchor_label = f'death anchor ({keep_seconds:.1f}s total)'
        else:
            keep_seconds = None
            anchor_label = 'full buffer (no kill or death detected)'
        tag_label = f' [{tag}]' if tag else ''
        # A scoped event links the button-time moment to its eventual clip, even
        # when encoding finishes after the full game file has closed.
        from events import emit
        marker_id = uuid.uuid4().hex
        emit('recording.replay', stage='requested', id=marker_id, pressed_at=now,
             label=tag, seconds=keep_seconds)
        print(f'[instant_replay] 💾 Save{tag_label} triggered — anchor: {anchor_label}')
        with self.state._lock:
            self.state._save_in_progress[0] = True
            self.state._last_save_cmd_time[0] = now
            new_event = threading.Event()
            self.state._save_done_event[0] = new_event
            result = {'purpose': purpose}
            self.state._save_result[0] = result

        def _worker() -> None:
            from . import stage
            clip: str | None = None
            stage.capture_update('saving', purpose=purpose, seconds=clip_seconds,
                                 message={'replay_only':'Capturing replay-only moment', 'review_later':'Saving for later review', 'highlight':'Saving replay-ready highlight'}[purpose])
            inspect_event('replay.save', owner='instant_replay', phase='saving')
            try:
                save_requested = [time.time()]
                def on_save_requested(timestamp):
                    save_requested[0] = timestamp
                    # Every accepted save (voice/shortcut/Hub) shares this path.
                    # Twitch captures its own stream window without delaying OBS.
                    if purpose == 'highlight':
                        try:
                            request_clip(title=tag)
                        except Exception:
                            print('[instant_replay] Twitch clip request failed; continuing the OBS save.')
                replay_file = save_replay_buffer_and_wait(timeout=REPLAY_SAVE_TIMEOUT, on_save_requested=on_save_requested)
                if not replay_file:
                    print('[instant_replay] ❌ Timed out waiting for replay save. Is the replay buffer running in OBS?')
                    return
                from . import library
                if purpose in ('replay_only', 'review_later'):
                    # Classify the OBS original too, so disk scans cannot put a
                    # duplicate of this moment into the montage review pool.
                    library.remember_capture(replay_file, purpose=purpose, saved_at=time.time())
                    clip = replay_file if full_save else _trim_from_end(replay_file, keep_seconds,
                        tail_seconds=max(0, save_requested[0] - now), fast=True,
                        output_dir=Path(replay_file).parent / ('replay-only' if purpose == 'replay_only' else 'review-later'))
                else:
                    clip = _saved_clip(replay_file, keep_seconds, full_save=full_save,
                                       tail_seconds=max(0, save_requested[0] - now))
                if not clip:
                    return
                with self.state._lock:
                    idx = self.state._tag_counters.get(tag or 'untagged', 0) + 1
                    self.state._tag_counters[tag or 'untagged'] = idx
                    if purpose != 'review_later':
                        self.state._clip_registry.append({'tag': tag or 'untagged', 'path': clip, 'index_for_tag': idx, 'saved_at': time.time(), 'purpose': purpose})
                library.remember_capture(clip, tag=tag or 'untagged', saved_at=time.time(),
                                         purpose=purpose, capture_source=replay_file if purpose in ('replay_only','review_later') and clip != replay_file else None,
                                         title=tag or None)
                result['path'] = clip
                result['purpose'] = purpose
                emit('recording.replay', stage='saved', id=marker_id, path=clip)
                stage.capture_update('ready', purpose=purpose, seconds=clip_seconds, path=clip,
                                     message={'replay_only':'Replay only · excluded from highlight review', 'review_later':'Marked for review · not in automatic replay', 'highlight':'Saved · replay-ready highlight'}[purpose])
                inspect_event('replay.save', owner='instant_replay', phase='saved', source=Path(clip).name)
                follow_up = 'review it in the Clip desk' if purpose == 'review_later' else "press '|' and say 'play'"
                print(f"[instant_replay] Clip ready ({tag or 'untagged'} #{idx}) — {follow_up}.")
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

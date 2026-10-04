"""One replay presentation owner through cancellation, cleanup, and scene return."""
from __future__ import annotations
import random
import threading
import time
from pathlib import Path
import obs
from . import stage
from .presentation import clip_copy
from lib.shared_media.media_startup import MediaStartupCancelled
from coordinator import coordinator
from .config import RETURN_SCENE
from .config import SCENE
from .config import SOURCE_NAME
from .audio import _mute_desktop, _unmute_desktop
from .inventory import _replay_files_on_disk
from .source_playback import _start_replay_clip
from lib.asset_fader import AssetFader
from lib.runtime_cleanup import run_cleanup


class ReplayPlayback:

    def __init__(self, state, live_state):
        self.state, self.live_state = (state, live_state)
        self._playback_gate = threading.Lock()
        self._stopping = threading.Event()
        self.last_random_clip = [None]
        self.replay_fader = AssetFader(SOURCE_NAME, Path(__file__).parent / 'asset_volumes.json')

    def _end_replay(self, *, cancelled: bool=False) -> None:
        self.state._cancel_watcher.set()
        if not self._playback_gate.locked():
            _unmute_desktop(force=True)

    def shutdown(self):
        """Reject new starts, cancel the owner, and wait for audio/scene cleanup."""
        self._stopping.set()
        self._end_replay(cancelled=True)
        if self._playback_gate.acquire(timeout=5):
            self._playback_gate.release()
        else:
            print('[instant_replay] Playback cleanup still pending at shutdown.')

    def _pause_replay(self) -> None:
        with self.state._lock:
            if not self.state._replay_active[0] or self.state._replay_paused[0]:
                return
            self.state._replay_paused[0] = True
        try:
            obs.pause_media(SOURCE_NAME)
        except Exception as exc:
            print(f'[instant_replay] Could not pause replay media: {exc}')
        _unmute_desktop()
        stage.progress({}, paused=True)
        print('[instant_replay] Paused replay.')

    def _resume_replay(self) -> None:
        with self.state._lock:
            if not self.state._replay_active[0] or not self.state._replay_paused[0]:
                return
            self.state._replay_paused[0] = False
        session = self.state._scene_session[0]
        if session is None or not session.owns_scene():
            self._end_replay(cancelled=True)
            return
        _mute_desktop()
        stage.progress({}, paused=False)
        try:
            snapshot = stage.state()
            if snapshot['phase'] == 'playing':
                obs.play_media(SOURCE_NAME)
        except Exception as exc:
            print(f'[instant_replay] Could not resume replay media: {exc}')
        print('[instant_replay] Resumed replay.')

    def _play_all_clips_sequential(self, clips: list[str], *, random_forever: bool=False,
                                   presentation: str | None=None, mode: str | None=None) -> None:
        """One owner controls OBS until a sequence or random session finishes."""
        if self._stopping.is_set():
            return
        if not self._playback_gate.acquire(blocking=False):
            print('[instant_replay] Replay already starting/playing; stop it before choosing another.')
            return
        try:
            if self._stopping.is_set():
                return
            self.state._cancel_watcher.clear()
            self.state._skip_clip.clear()
            with self.state._lock:
                self.state._is_multi_clip_active[0] = random_forever or len(clips) > 1
                self.state._random_playback_active[0] = random_forever
                self.state._replay_active[0] = True
                self.state._replay_paused[0] = False
            from . import library
            labels = library.read()['clips']
            kind = presentation or ('highlights' if random_forever else stage.classify(clips))
            transition = stage.begin(kind, in_game=bool(self.live_state.get('in_game', lambda: False)()),
                                     mode=mode or ('replay' if presentation == 'replay' else None))
            self.state._scene_session[0] = coordinator.scene_session('instant_replay', SCENE, RETURN_SCENE,
                                                                    transition=transition)
            stage.begin(kind, in_game=bool(self.live_state.get('in_game', lambda: False)()),
                        mode=stage.state()['mode'], return_label=self.state._scene_session[0].previous)
            index = 0
            while not self.state._cancel_watcher.is_set():
                session = self.state._scene_session[0]
                if session.activated and (not session.owns_scene()):
                    self.state._cancel_watcher.set()
                    break
                while self.state._replay_paused[0] and (not self.state._cancel_watcher.is_set()):
                    if not session.owns_scene():
                        self.state._cancel_watcher.set()
                        break
                    self.state._cancel_watcher.wait(0.1)
                if self.state._cancel_watcher.is_set():
                    break
                if random_forever:
                    candidates = _replay_files_on_disk(highlights_only=True)
                    if not candidates:
                        print('[instant_replay] Random playback stopped: no saved clips remain.')
                        break
                    pool = [path for path in candidates if path != self.last_random_clip[0]] or candidates
                    choice = random.choice(pool)
                    self.last_random_clip[0] = choice
                    clip = str(choice)
                    total: int | str = '∞'
                    print(f'[instant_replay] ðŸŽ² Random clip: {choice.name}')
                else:
                    if index >= len(clips):
                        break
                    clip = clips[index]
                    total = len(clips)
                index += 1
                if self.state._cancel_watcher.is_set():
                    break
                clip_path = Path(clip)
                self.live_state['playback_detail'] = {'name': labels.get(library.clip_id(clip), {}).get('title') or clip_path.name, 'index': index, 'total': total}
                if not clip_path.is_file() or clip_path.stat().st_size <= 0:
                    print(f'[instant_replay] Missing or empty clip: {clip}')
                    continue
                display_title, context = clip_copy(clip_path, labels.get(library.clip_id(clip), {}))
                next_title = '' if random_forever else (
                    clip_copy(clips[index], labels.get(library.clip_id(clips[index]), {}))[0]
                    if index < len(clips) else '')
                handoff = session.activated and index > 1
                stage.start(kind, display_title, index, total, context=context, next_title=next_title,
                            handoff=handoff,clip_path=str(clip_path),
                            purpose='highlight' if library.highlight_candidate(labels.get(library.clip_id(clip_path), {})) else 'replay_only')
                if handoff and not stage.cover_for_swap(self.state._cancel_watcher, session.owns_scene):
                    self.state._cancel_watcher.set()
                    break
                if session.activated and not session.owns_scene():
                    self.state._cancel_watcher.set()
                    break
                print(f'[instant_replay] Loading: {clip_path.name}')
                try:
                    _start_replay_clip(clip_path, self.state._cancel_watcher, session, self.replay_fader,
                                       labels, hold=handoff)
                    if handoff:
                        if not stage.reveal_for_play(self.state._cancel_watcher, session.owns_scene):
                            raise MediaStartupCancelled('Replay cancelled during reveal')
                        if not self.state._replay_paused[0]:
                            obs.play_media(SOURCE_NAME)
                    elif self.state._replay_paused[0]:
                        obs.pause_media(SOURCE_NAME)
                    stage.playing()
                    if not handoff and not self.state._replay_paused[0]:
                        obs.play_media(SOURCE_NAME)
                except MediaStartupCancelled:
                    self.state._cancel_watcher.set()
                    break
                except TimeoutError as exc:
                    print(f'[instant_replay] {exc}')
                    continue
                if self.state._cancel_watcher.is_set():
                    break
                ended_polls = 0
                deadline = time.monotonic() + 7200
                while not self.state._cancel_watcher.is_set():
                    if not session.owns_scene():
                        self.state._cancel_watcher.set()
                        break
                    if self.state._skip_clip.is_set():
                        self.state._skip_clip.clear()
                        break
                    with self.state._lock:
                        paused = self.state._replay_paused[0]
                    if paused:
                        stage.progress({}, paused=True)
                        deadline += 0.1
                        time.sleep(0.1)
                        continue
                    self.replay_fader.capture()
                    status = obs.get_media_status(SOURCE_NAME)
                    stage.progress(status, paused=False)
                    state = status.get('state')
                    ended_polls = ended_polls + 1 if state in ('OBS_MEDIA_STATE_ENDED', 'OBS_MEDIA_STATE_STOPPED', 'OBS_MEDIA_STATE_NONE', 'OBS_MEDIA_STATE_ERROR') else 0
                    if ended_polls >= 3 or time.monotonic() >= deadline:
                        break
                    time.sleep(0.1)
        except Exception as exc:
            print(f'[instant_replay] Playback failed: {exc}')
        finally:
            def finish_session():
                session = self.state._scene_session[0]
                self.state._scene_session[0] = None
                if session:
                    session.finish(wait_for_transition=True)

            try:
                # Hold the physical source through every cleanup action. Keep its
                # final frame until the ownership-checked return starts.
                run_cleanup('instant_replay', self.replay_fader.capture, stage.returning,
                            finish_session, lambda: obs.park_media_source(SCENE, SOURCE_NAME),
                            lambda: _unmute_desktop(force=True), stage.finish)
            finally:
                with self.state._lock:
                    self.state._replay_active[0] = False
                    self.state._replay_paused[0] = False
                    self.state._is_multi_clip_active[0] = False
                    self.state._random_playback_active[0] = False
                self.live_state['playback_detail'] = {}
                self.state._skip_clip.clear()
                self._playback_gate.release()

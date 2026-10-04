"""Replay capture/playback handshake and game-session metadata, guarded by _lock."""
import threading

class ReplayState:

    def __init__(self):
        self._lock = threading.Lock()
        self._manual_mark_wall: list[float | None] = [None]
        self._clip_registry: list[dict] = []
        self._tag_counters: dict[str, int] = {}
        self._save_in_progress = [False]
        self._last_save_cmd_time: list[float | None] = [None]
        self._save_done_event: list[threading.Event] = [threading.Event()]
        self._save_result = [{}]
        self._replay_active = [False]
        self._replay_paused = [False]
        self._is_multi_clip_active = [False]
        self._random_playback_active = [False]
        self._skip_clip = threading.Event()
        self._previous_game_clips: list[dict] = []
        self._current_game_label: list[str | None] = [None]
        self._scene_session = [None]
        self._watcher_thread: list[threading.Thread | None] = [None]
        self._cancel_watcher = threading.Event()
        self._was_in_game: list[bool] = [False]

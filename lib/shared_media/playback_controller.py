"""Own media intents, source workers, replacement, completion, and cancellation.

Profile/voice/random policy belongs to the caller. AssetPlayback owns the actual
OBS operations; each source worker retains ownership through its final cleanup.
"""
import threading
import obs
from coordinator import coordinator
from lib.runtime_cleanup import run_cleanup
from .playback_worker import PlaybackWorker


class MediaPlayback:
    def __init__(self, cfg, stop_event, name_index, asset_player, *, visible_sources=None,
                 visible_lock=None, shared_sources=(), primary=None):
        self.cfg, self.stop_event, self.name_index = cfg, stop_event, name_index
        self.layered_permission = coordinator.permission(cfg.project_name)
        self.asset_player = asset_player
        self.visible_sources = visible_sources if visible_sources is not None else set()
        self.visible_lock = visible_lock or threading.Lock()
        self.play_lock = threading.RLock()
        self.currently_playing = [None]
        self.current_source_name = [None]
        self.current_play_request_id = [0]
        self.current_worker = [None]
        self.current_completion = [None]
        self.source_workers = {}
        self.shared_source_cursor = [-1]
        self._shared_sources, self._single_source = list(shared_sources), primary
        self._single_source_mode = bool(getattr(cfg, 'single_source_mode', False))


    def _choose_shared_source(self, preferred_previous: str | None=None) -> str:
        if not self._shared_sources:
            return self._single_source or ''
        if len(self._shared_sources) == 1:
            return self._shared_sources[0]
        for offset in range(1, len(self._shared_sources) + 1):
            index = (self.shared_source_cursor[0] + offset) % len(self._shared_sources)
            candidate = self._shared_sources[index]
            if candidate != preferred_previous:
                self.shared_source_cursor[0] = index
                return candidate
        self.shared_source_cursor[0] = (self.shared_source_cursor[0] + 1) % len(self._shared_sources)
        return self._shared_sources[self.shared_source_cursor[0]]

    def worker_for(self, source_name):
        if source_name not in self.source_workers:
            self.source_workers[source_name] = PlaybackWorker(f'{self.cfg.project_name}:{source_name}')
        return self.source_workers[source_name]

    def play_asset(self, name: str) -> threading.Event:
        done = threading.Event()
        if self.stop_event.is_set():
            done.set()
            return done
        entry = self.name_index.get(name)
        if entry is None:
            known = list(self.name_index.keys())
            print(f"[{self.cfg.project_name}] No match for '{name}'. Known: {', '.join(known) or '(none)'}")
            done.set()
            return done
        filepath, default_source_name = entry
        with self.play_lock:
            prev_source = self.current_source_name[0]
            if self.current_worker[0] is not None:
                self.current_worker[0].cancel()
            if self.current_completion[0] is not None:
                self.current_completion[0].set()
            self.currently_playing[0] = name
            source_name = self._choose_shared_source(prev_source) if self._single_source_mode else default_source_name
            self.current_source_name[0] = source_name
            self.current_play_request_id[0] += 1
            request_id = self.current_play_request_id[0]
            worker = self.worker_for(source_name)
            self.current_worker[0] = worker
            self.current_completion[0] = done

        def _do_play(cancelled, ticket) -> None:
            with self.play_lock:
                is_stale = self.current_play_request_id[0] != request_id or cancelled.is_set() or ticket.cancelled.is_set() or self.stop_event.is_set() or (self.currently_playing[0] != name) or (self.current_source_name[0] != source_name)
            if is_stale or not ticket.wait_until_allowed(
                    cancelled=lambda: cancelled.is_set() or self.stop_event.is_set()):
                ticket.finish()
                done.set()
                return
            print(f"[{self.cfg.project_name}] Playing: '{source_name}'")
            with self.visible_lock:
                self.visible_sources.add(source_name)
            try:
                self._play_source(name, filepath, source_name, cancelled, ticket=ticket)
            finally:
                with self.play_lock:
                    try:
                        if self.current_play_request_id[0] == request_id:
                            self.currently_playing[0] = None
                            self.current_source_name[0] = None
                            self.current_worker[0] = None
                            self.current_completion[0] = None
                    finally:
                        ticket.finish()
                        done.set()

        def dispatch(ticket):
            with self.play_lock:
                if self.stop_event.is_set() or ticket.cancelled.is_set() or self.current_play_request_id[0] != request_id:
                    done.set()
                    return False
                try:
                    worker.submit(lambda cancelled: _do_play(cancelled, ticket))
                except Exception:
                    self.currently_playing[0] = None
                    self.current_source_name[0] = None
                    self.current_worker[0] = None
                    self.current_completion[0] = None
                    done.set()
                    ticket.finish()
                    raise
        try:
            coordinator.request(self.cfg.project_name, on_ready=dispatch)
        except Exception:
            with self.play_lock:
                if self.current_play_request_id[0] == request_id:
                    self.stop_current_playback()
            raise
        return done

    def play_asset_concurrent(self, name: str) -> threading.Event | None:
        if self.stop_event.is_set():
            return
        entry = self.name_index.get(name)
        if entry is None:
            print(f"[{self.cfg.project_name}] Concurrent: no match for '{name}'.")
            return
        with self.play_lock:
            source_name = self._choose_shared_source(self.current_source_name[0]) if self._single_source_mode else entry[1]
            worker = self.worker_for(source_name)
            return worker.submit(lambda cancelled: self._play_asset_concurrent(name, source_name, cancelled))

    def _play_asset_concurrent(self, name: str, source_name: str, cancelled) -> None:
        if cancelled.is_set() or self.stop_event.is_set():
            return
        entry = self.name_index.get(name)
        if entry is None:
            print(f"[{self.cfg.project_name}] Concurrent: no match for '{name}'.")
            return
        while not self.layered_permission.wait(.05):
            if cancelled.is_set() or self.stop_event.is_set():
                return
        if cancelled.is_set() or self.stop_event.is_set():
            return
        filepath, default_source_name = entry
        print(f"[{self.cfg.project_name}] Playing (concurrent): '{source_name}'")
        with self.visible_lock:
            self.visible_sources.add(source_name)
        self._play_source(name, filepath, source_name, cancelled)

    def _play_source(self, name, filepath, source_name, cancelled, *, ticket=None):
        try:
            self.asset_player.play(name, filepath, source_name,
                cancelled=lambda: cancelled.is_set() or self.stop_event.is_set(),
                allowed=ticket.allowed.is_set if ticket is not None else self.layered_permission.is_set)
        finally:
            with self.visible_lock:
                self.visible_sources.discard(source_name)

    def stop_current_playback(self) -> None:
        with self.play_lock:
            self.current_play_request_id[0] += 1
            if self.current_worker[0] is not None:
                self.current_worker[0].cancel()
            if self.current_completion[0] is not None:
                self.current_completion[0].set()
            self.current_worker[0] = None
            self.current_completion[0] = None
            current = self.currently_playing[0]
            source_name = self.current_source_name[0]
            self.currently_playing[0] = None
            self.current_source_name[0] = None
            if current and source_name:
                print(f"[{self.cfg.project_name}] Stopping '{source_name}'.")
                run_cleanup(self.cfg.project_name, lambda: obs.stop_media(source_name), lambda: obs.hide_source(self.cfg.scene, source_name))
                with self.visible_lock:
                    self.visible_sources.discard(source_name)
            coordinator.cancel(self.cfg.project_name)

    def cancel_all_playback(self):
        with self.play_lock:
            for worker in self.source_workers.values():
                worker.cancel()

    def stop_current_playing_source(self, current: str, stop_src: str, request_id: int) -> None:
        with self.play_lock:
            if self.currently_playing[0] != current or self.current_source_name[0] != stop_src or self.current_play_request_id[0] != request_id:
                return
            self.stop_current_playback()

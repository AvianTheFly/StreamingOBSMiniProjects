from __future__ import annotations

import threading
import time
from pathlib import Path

import obs
from lib.shared_media.layout_rules import (
    layout_rules_file_for_config,
    load_layout_rules,
    obs_transform_from_rule,
    resolve_rule_for_stem,
)
from lib.shared_media.single_source_state import SingleSourceStateStore

from .config import CONFIG

_TAG = f"[{CONFIG.project_name}]"
_PROJECT_DIR = Path(__file__).resolve().parent

SINGLE_SOURCE_NAME = f"{CONFIG.obs_source_prefix}player"

_STATE_PLAYING = "OBS_MEDIA_STATE_PLAYING"
_STATE_STARTING = {
    "OBS_MEDIA_STATE_OPENING",
    "OBS_MEDIA_STATE_BUFFERING",
    "OBS_MEDIA_STATE_RESTARTING",
}
_STATE_ENDED = {"OBS_MEDIA_STATE_STOPPED", "OBS_MEDIA_STATE_ENDED", "OBS_MEDIA_STATE_NONE"}
_FILE_APPLY_TIMEOUT = 2.0
_START_CONFIRM_POLLS = 3
_START_GRACE_SECONDS = 0.4
_END_CONFIRM_POLLS = 3
_END_GRACE_SECONDS = 0.8
_MIN_VALID_PLAY_SECONDS = 0.2


class SoundboardPlayer:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._is_busy = False
        self._abort_flag = False
        self._paused = False
        self._current_stem: str | None = None
        self._current_file: Path | None = None
        self._play_thread: threading.Thread | None = None
        # include_filters=True: any OBS filter the user adds to the shared
        # soundboard source while a clip is playing is captured as a per-stem
        # override at clip end and re-applied next time that stem plays.
        self._state_store = SingleSourceStateStore(
            project_dir=_PROJECT_DIR,
            scene=CONFIG.scene,
            source_name=SINGLE_SOURCE_NAME,
            tag=_TAG,
            include_filters=True,
            include_audio=False,
            include_audio_volume=False,
            include_media_settings=False,
        )
        self._layout_rules_path = layout_rules_file_for_config(CONFIG)
        self._layout_rules_mtime = -1.0
        self._layout_rules_cache: dict = {}
        self._ensure_source()

    @property
    def is_busy(self) -> bool:
        with self._lock:
            return self._is_busy

    @property
    def is_paused(self) -> bool:
        with self._lock:
            return self._paused

    @property
    def current_stem(self) -> str | None:
        with self._lock:
            return self._current_stem

    @property
    def current_source(self) -> str | None:
        with self._lock:
            return SINGLE_SOURCE_NAME if self._current_stem else None

    def play_async(
        self,
        *,
        stem: str,
        filepath: Path,
        volume_db: float,
        categories: list[str],
        on_finish=None,
    ) -> None:
        with self._lock:
            old_thread = self._play_thread
        if old_thread is not None and old_thread.is_alive():
            self.abort()
            old_thread.join(timeout=5)

        thread = threading.Thread(
            target=self.play,
            kwargs={
                "stem": stem,
                "filepath": filepath,
                "volume_db": volume_db,
                "categories": categories,
                "on_finish": on_finish,
            },
            daemon=True,
            name=f"soundboard:{stem}",
        )
        with self._lock:
            self._play_thread = thread
        thread.start()

    def play(
        self,
        *,
        stem: str,
        filepath: Path,
        volume_db: float,
        categories: list[str],
        on_finish=None,
    ) -> None:
        with self._lock:
            if self._is_busy:
                print(f"{_TAG} Already busy - ignoring play('{stem}')")
                return
            self._is_busy = True
            self._abort_flag = False
            self._paused = False
            self._current_stem = stem
            self._current_file = filepath

        try:
            print(f"{_TAG} Playing: '{SINGLE_SOURCE_NAME}'")

            self._stop_and_hide_source()
            obs.set_media_source_file(SINGLE_SOURCE_NAME, filepath)
            if not self._wait_for_media_file(filepath):
                current = self._current_media_file()
                current_name = current.name if current else "unknown"
                raise RuntimeError(
                    f"OBS did not confirm file swap to '{filepath.name}' (current: '{current_name}')."
                )

            # Changing local_file can make OBS start decoding immediately. Stop
            # that implicit start before the one intentional restart below, or
            # short clips can be heard twice.
            try:
                obs.stop_media(SINGLE_SOURCE_NAME)
            except Exception:
                pass

            self._apply_runtime_media_settings()
            self._state_store.apply_for_stem(stem)
            self._apply_layout_rule(stem, filepath, categories)
            self._apply_runtime_audio_settings(volume_db)

            obs.show_source(CONFIG.scene, SINGLE_SOURCE_NAME)
            settle = max(0.0, float(getattr(CONFIG, "media_swap_settle_ms", 0) or 0) / 1000.0)
            if settle > 0:
                time.sleep(settle)
            else:
                time.sleep(0.03)

            obs.restart_media(SINGLE_SOURCE_NAME)
            self._apply_runtime_audio_settings(volume_db)

            started = self._poll_until_done(expected_file=filepath)
            if not started and not self._abort_flag:
                raise RuntimeError(f"Playback did not start cleanly for '{filepath.name}'.")
        except Exception as exc:
            print(f"{_TAG} Playback failed for '{SINGLE_SOURCE_NAME}': {exc}")
        finally:
            try:
                self._state_store.capture_override_for_stem(stem)
            except Exception as exc:
                print(f"{_TAG} Could not save single-source override for '{stem}': {exc}")
            self._stop_and_hide_source()
            with self._lock:
                self._is_busy = False
                self._paused = False
                self._current_stem = None
                self._current_file = None
            if on_finish:
                try:
                    on_finish()
                except Exception as exc:
                    print(f"{_TAG} Finish callback failed: {exc}")

    def pause(self) -> None:
        with self._lock:
            if not self._is_busy or self._paused:
                return
            self._paused = True
            stem = self._current_stem
        try:
            obs.pause_media(SINGLE_SOURCE_NAME)
        except Exception as exc:
            print(f"{_TAG} Could not pause media: {exc}")
            with self._lock:
                self._paused = False
            return
        print(f"{_TAG} Paused: '{stem}'")

    def resume(self) -> None:
        with self._lock:
            if not self._is_busy or not self._paused:
                return
            self._paused = False
            stem = self._current_stem
        try:
            obs.play_media(SINGLE_SOURCE_NAME)
        except Exception as exc:
            print(f"{_TAG} Could not resume media: {exc}")
            with self._lock:
                if self._current_stem == stem:
                    self._paused = True
            return
        print(f"{_TAG} Resumed: '{stem}'")

    def abort(self) -> None:
        with self._lock:
            if not self._is_busy:
                return
            self._abort_flag = True
            self._paused = False
        self._stop_and_hide_source()
        print(f"{_TAG} Abort requested.")

    def _ensure_source(self) -> None:
        try:
            obs.ensure_shared_sources(
                scene=CONFIG.scene,
                asset_dir=CONFIG.asset_dir,
                prefix=CONFIG.obs_source_prefix,
                monitor=CONFIG.monitor,
                volume_db=CONFIG.default_volume_db,
                slots=1,
            )
        except Exception as exc:
            print(f"{_TAG} Could not ensure shared OBS source: {exc}")
        self._apply_runtime_media_settings()
        self._stop_and_hide_source()
        self._state_store.ensure_baseline()

    def _refresh_layout_rules_if_needed(self) -> None:
        try:
            mtime = self._layout_rules_path.stat().st_mtime
        except OSError:
            return
        if mtime == self._layout_rules_mtime:
            return
        self._layout_rules_mtime = mtime
        self._layout_rules_cache = load_layout_rules(self._layout_rules_path)

    def _apply_layout_rule(self, stem: str, filepath: Path, categories: list[str]) -> None:
        self._refresh_layout_rules_if_needed()
        if not self._layout_rules_cache:
            return
        rule = resolve_rule_for_stem(
            self._layout_rules_cache,
            stem=stem,
            path=filepath,
            categories=categories,
        )
        if not rule:
            return
        try:
            obs.set_source_transform(CONFIG.scene, SINGLE_SOURCE_NAME, obs_transform_from_rule(rule))
        except Exception as exc:
            print(f"{_TAG} Could not apply layout rule for '{stem}': {exc}")

    def _apply_runtime_media_settings(self) -> None:
        try:
            obs.configure_media_source_properties(
                SINGLE_SOURCE_NAME,
                restart_on_activate=False,
                close_when_inactive=True,
                looping=False,
                hw_decode=True,
                clear_on_media_end=False,
            )
        except Exception as exc:
            print(f"{_TAG} Could not set media properties for '{SINGLE_SOURCE_NAME}': {exc}")

    def _apply_runtime_audio_settings(self, volume_db: float) -> None:
        try:
            obs.set_input_mute(SINGLE_SOURCE_NAME, False)
        except Exception as exc:
            print(f"{_TAG} Could not unmute '{SINGLE_SOURCE_NAME}': {exc}")
        try:
            obs.set_input_audio_monitor_type(SINGLE_SOURCE_NAME, CONFIG.monitor)
        except Exception as exc:
            print(f"{_TAG} Could not set monitor mode for '{SINGLE_SOURCE_NAME}': {exc}")
        if CONFIG.audio_tracks:
            try:
                obs.set_input_audio_tracks(SINGLE_SOURCE_NAME, CONFIG.audio_tracks)
            except Exception as exc:
                print(f"{_TAG} Could not set audio tracks for '{SINGLE_SOURCE_NAME}': {exc}")
        try:
            obs.set_input_volume_db(SINGLE_SOURCE_NAME, float(volume_db))
        except Exception as exc:
            print(f"{_TAG} Could not set volume for '{SINGLE_SOURCE_NAME}': {exc}")

    def _current_media_file(self) -> Path | None:
        client = obs.get_obs()
        try:
            resp = client.send("GetInputSettings", {"inputName": SINGLE_SOURCE_NAME}, raw=True)
        except TypeError:
            try:
                resp = client.send("GetInputSettings", {"inputName": SINGLE_SOURCE_NAME})
            except Exception:
                return None
        except Exception:
            return None

        if isinstance(resp, dict):
            settings = resp.get("inputSettings") or resp.get("input_settings") or {}
        else:
            settings = getattr(resp, "inputSettings", None) or getattr(resp, "input_settings", None) or {}
        if not isinstance(settings, dict):
            return None
        local_file = str(settings.get("local_file") or "").strip()
        return Path(local_file) if local_file else None

    def _wait_for_media_file(self, expected_file: Path) -> bool:
        try:
            expected_norm = str(expected_file.resolve()).casefold()
        except Exception:
            expected_norm = str(expected_file).casefold()

        deadline = time.time() + _FILE_APPLY_TIMEOUT
        while time.time() < deadline:
            current = self._current_media_file()
            if current is not None:
                try:
                    current_norm = str(current.resolve()).casefold()
                except Exception:
                    current_norm = str(current).casefold()
                if current_norm == expected_norm:
                    return True
            time.sleep(0.05)
        return False

    def _poll_until_done(self, *, expected_file: Path) -> bool:
        started = False
        play_streak = 0
        end_streak = 0
        provisional_playing_since: float | None = None
        playing_since: float | None = None
        started_at = time.time()

        while True:
            with self._lock:
                if self._abort_flag:
                    return True
                paused = self._paused

            if paused:
                time.sleep(0.05)
                continue

            current_file = self._current_media_file()
            if current_file is not None:
                try:
                    current_norm = str(current_file.resolve()).casefold()
                    expected_norm = str(expected_file.resolve()).casefold()
                except Exception:
                    current_norm = str(current_file).casefold()
                    expected_norm = str(expected_file).casefold()
                if current_norm != expected_norm:
                    print(
                        f"{_TAG} Media source switched files mid-play "
                        f"('{current_file.name}' != '{expected_file.name}')."
                    )
                    return False

            status = obs.get_media_status(SINGLE_SOURCE_NAME) or {}
            state = status.get("state")
            cursor_ms = status.get("cursor_ms")

            if state == _STATE_PLAYING:
                play_streak += 1
                if provisional_playing_since is None:
                    provisional_playing_since = time.time()
                if (
                    not started
                    and (
                        play_streak >= _START_CONFIRM_POLLS
                        or (time.time() - provisional_playing_since) >= _START_GRACE_SECONDS
                    )
                ):
                    started = True
                    playing_since = time.time()
                end_streak = 0
                if cursor_ms is not None:
                    try:
                        if float(cursor_ms) > 0:
                            started = True
                            if playing_since is None:
                                playing_since = time.time()
                    except (TypeError, ValueError):
                        pass
            elif not started:
                if state not in _STATE_STARTING:
                    play_streak = 0
                    provisional_playing_since = None

            if started and state in _STATE_ENDED:
                end_streak += 1
                if playing_since is not None:
                    played_for = time.time() - playing_since
                    if played_for < max(_END_GRACE_SECONDS, _MIN_VALID_PLAY_SECONDS):
                        time.sleep(0.05)
                        continue
                if end_streak >= _END_CONFIRM_POLLS:
                    return True
            elif started:
                end_streak = 0

            if not started and (time.time() - started_at) > CONFIG.media_start_timeout:
                return False

            if (time.time() - started_at) > CONFIG.media_total_timeout:
                return False

            time.sleep(0.05)

    def _stop_and_hide_source(self) -> None:
        try:
            obs.stop_media(SINGLE_SOURCE_NAME)
        except Exception:
            pass
        try:
            obs.hide_source(CONFIG.scene, SINGLE_SOURCE_NAME)
        except Exception:
            pass

from __future__ import annotations

import json
import random
import threading
from pathlib import Path
from typing import Any

import obs


_AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".mp4", ".mkv", ".mov", ".webm"}
_MONITOR_ONLY = "OBS_MONITORING_TYPE_MONITOR_ONLY"


class LeagueKillAudioPlayer:
    def __init__(
        self,
        *,
        project_dir: Path,
        asset_dir: Path,
        scene: str,
        source_prefix: str,
        tag: str = "[league]",
        default_volume_db: float = 0.0,
        monitor: str = _MONITOR_ONLY,
    ) -> None:
        self.project_dir = Path(project_dir)
        self.asset_dir = Path(asset_dir)
        self.scene = str(scene)
        self.source_prefix = str(source_prefix)
        self.tag = str(tag)
        self.default_volume_db = float(default_volume_db)
        self.monitor = str(monitor)
        self.state_file = self.project_dir / "audio_hotkeys_editor.json"
        self.source_name = f"{self.source_prefix}player"
        self._lock = threading.Lock()
        self._current_stem: str | None = None
        self._play_generation = 0
        self._ready = False

    @property
    def current_stem(self) -> str | None:
        with self._lock:
            return self._current_stem

    def ensure_ready(self) -> str:
        if self._ready:
            return self.source_name
        single = obs.ensure_single_source(
            scene=self.scene,
            asset_dir=self.asset_dir,
            prefix=self.source_prefix,
            monitor=self.monitor,
            volume_db=self.default_volume_db,
        )
        self.source_name = str(single or self.source_name)
        try:
            obs.show_source(self.scene, self.source_name)
        except Exception:
            pass
        self._ready = True
        return self.source_name

    def list_assets(self) -> list[Path]:
        if not self.asset_dir.is_dir():
            return []
        return [
            path
            for path in sorted(self.asset_dir.iterdir(), key=lambda item: item.name.lower())
            if path.is_file() and path.suffix.lower() in _AUDIO_EXTS
        ]

    def play_random(self) -> bool:
        assets = self.list_assets()
        if not assets:
            print(f"{self.tag} No kill audio files found in {self.asset_dir}")
            return False
        chosen = random.choice(assets)
        self.play_file(chosen)
        return True

    def play_file(self, path: Path) -> None:
        path = Path(path)
        source_name = self.ensure_ready()
        stem = path.stem
        with self._lock:
            self._play_generation += 1
            generation = self._play_generation
            self._current_stem = stem

        try:
            obs.set_media_source_file(source_name, path)
            obs.set_input_audio_monitor_type(source_name, self.monitor)
            obs.set_input_volume_db(source_name, self._effective_volume_db(stem))
            obs.show_source(self.scene, source_name)
            obs.restart_media(source_name)
            print(f"{self.tag} Kill audio: '{path.name}'")
        except Exception as exc:
            print(f"{self.tag} Could not play kill audio '{path.name}': {exc}")
            with self._lock:
                if self._play_generation == generation:
                    self._current_stem = None
            return

        threading.Thread(
            target=self._wait_for_end,
            args=(source_name, generation),
            daemon=True,
            name="league-kill-audio-wait",
        ).start()

    def stop(self) -> None:
        try:
            obs.stop_media(self.ensure_ready())
        except Exception:
            pass
        with self._lock:
            self._current_stem = None

    def volume_state(self) -> dict[str, Any]:
        current = self.current_stem
        return {
            "profile": "default",
            "current_stem": current,
            "source_name": self.source_name if current else None,
        }

    def _wait_for_end(self, source_name: str, generation: int) -> None:
        try:
            obs.wait_for_media_end(source_name, start_timeout=3.0, total_timeout=30.0)
        except Exception:
            pass
        finally:
            with self._lock:
                if self._play_generation == generation:
                    self._current_stem = None

    def _effective_volume_db(self, stem: str) -> float:
        state = self._read_state()
        profiles = state.get("profiles")
        if not isinstance(profiles, dict) or not profiles:
            return round(self.default_volume_db, 2)

        profile_name = str(
            state.get("live_profile")
            or state.get("active_profile")
            or next(iter(profiles))
        )
        payload = profiles.get(profile_name)
        if not isinstance(payload, dict):
            return round(self.default_volume_db, 2)

        offsets = payload.get("file_volume_offsets")
        if not isinstance(offsets, dict):
            offsets = {}
        project_db = float(payload.get("project_volume_db") or 0.0)
        profile_db = float(payload.get("profile_volume_db") or 0.0)
        file_db = float(offsets.get(stem, 0.0) or 0.0)
        return round(project_db + profile_db + file_db, 2)

    def _read_state(self) -> dict[str, Any]:
        if not self.state_file.is_file():
            return {}
        try:
            raw = json.loads(self.state_file.read_text(encoding="utf-8"))
        except Exception:
            return {}
        return raw if isinstance(raw, dict) else {}

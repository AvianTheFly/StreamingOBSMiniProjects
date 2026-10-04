"""Read effective Hub and module settings without starting a runtime."""
from __future__ import annotations
import json
from pathlib import Path
import obs
from lib.project_settings import load_project_settings
from .media_config import MediaProjectConfig
_HUB_SETTINGS_FILE = Path(__file__).resolve().parents[2] / "hub_settings.json"


def _read_hub_trigger_mode(project_name: str) -> str:
    try:
        data = json.loads(_HUB_SETTINGS_FILE.read_text(encoding="utf-8"))
        modes = data.get("project_trigger_modes") or {}
        mode = modes.get(project_name, "abort")
        return mode if mode in ("abort", "pause", "keep_playing") else "abort"
    except Exception:
        return "abort"

def _feature_enabled(cfg: MediaProjectConfig, key: str, default: bool) -> bool:
    if key in cfg.features:
        return bool(cfg.features[key])
    return bool(getattr(cfg, key, default))

def _project_dir(cfg: MediaProjectConfig):
    return cfg.project_dir or cfg.phrases_file.parent

def _load_runtime_settings(cfg: MediaProjectConfig):
    try:
        return load_project_settings(
            _project_dir(cfg),
            hotkeys_file=Path(_project_dir(cfg)) / "hotkeys.json",
            asset_dir=cfg.asset_dir,
            valid_extensions=cfg.valid_extensions,
        )
    except Exception:
        return None

def _read_input_audio_tracks(source_name: str) -> dict[str, bool]:
    client = obs.get_obs()
    try:
        resp = client.send("GetInputAudioTracks", {"inputName": source_name}, raw=True)
    except TypeError:
        resp = client.send("GetInputAudioTracks", {"inputName": source_name})
    except Exception:
        return {}

    if isinstance(resp, dict):
        tracks = resp.get("inputAudioTracks") or resp.get("input_audio_tracks") or {}
    else:
        tracks = getattr(resp, "input_audio_tracks", None) or getattr(resp, "inputAudioTracks", None) or {}
    if not isinstance(tracks, dict):
        return {}
    return {str(key): bool(value) for key, value in tracks.items() if str(key).strip()}

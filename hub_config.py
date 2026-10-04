from __future__ import annotations

import os
import json
from pathlib import Path


def _load_saved_settings() -> dict:
    try:
        data = json.loads((Path(__file__).parent / 'hub_settings.json').read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


_saved_settings = _load_saved_settings()


def _value(name: str):
    """The Settings page overrides environment values on the next Hub start."""
    saved = _saved_settings.get(name.lower())
    if isinstance(saved, (str, int, float)) and not isinstance(saved, bool):
        if str(saved).strip():
            return str(saved)
    # A null microphone selection means use the system default device.
    if name == 'MIC_DEVICE' and name.lower() in _saved_settings and saved is None:
        return 'default'
    return os.environ.get(name)


def _env_int(name: str, default: int | None) -> int | None:
    raw = _value(name)
    if raw is None or raw.strip() == "":
        return default
    if raw.strip().lower() in {"none", "default"}:
        return None
    return int(raw)


def _env_float(name: str, default: float) -> float:
    raw = _value(name)
    return default if raw is None or raw.strip() == "" else float(raw)


# Voice / ASR. WHISPER_MODEL may be a model name such as "large-v3" or a local
# model directory path if you keep models outside this repo.
WHISPER_MODEL: str = _value("WHISPER_MODEL") or "large-v3"
WHISPER_DEVICE: str = _value("WHISPER_DEVICE") or "cuda"
WHISPER_COMPUTE: str = _value("WHISPER_COMPUTE") or "float16"
WHISPER_LANGUAGE: str = _value("WHISPER_LANGUAGE") or "en"
# Bound CPU inference so voice commands leave room for the game and OBS.
WHISPER_CPU_THREADS: int = max(1, _env_int("WHISPER_CPU_THREADS", 2) or 2)

# Microphone. Run tools/mic_test.py first to identify the correct device index.
MIC_DEVICE: int | None = _env_int("MIC_DEVICE", 1)
MIC_SAMPLE_RATE: int = _env_int("MIC_SAMPLE_RATE", 16_000) or 16_000
MIC_CHUNK_SAMPLES: int = _env_int("MIC_CHUNK_SAMPLES", 512) or 512
RMS_THRESHOLD: float = _env_float("RMS_THRESHOLD", 0.01)
SPEECH_PAD_CHUNKS: int = _env_int("SPEECH_PAD_CHUNKS", 20) or 20
MIN_SPEECH_CHUNKS: int = _env_int("MIN_SPEECH_CHUNKS", 8) or 8

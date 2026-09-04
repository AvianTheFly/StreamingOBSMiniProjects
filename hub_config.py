from __future__ import annotations

import os


def _env_int(name: str, default: int | None) -> int | None:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    if raw.strip().lower() in {"none", "default"}:
        return None
    return int(raw)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return default if raw is None or raw.strip() == "" else float(raw)


# Voice / ASR. WHISPER_MODEL may be a model name such as "large-v3" or a local
# model directory path if you keep models outside this repo.
WHISPER_MODEL: str = os.environ.get("WHISPER_MODEL", "large-v3")
WHISPER_DEVICE: str = os.environ.get("WHISPER_DEVICE", "cuda")
WHISPER_COMPUTE: str = os.environ.get("WHISPER_COMPUTE", "float16")
WHISPER_LANGUAGE: str = os.environ.get("WHISPER_LANGUAGE", "en")

# Microphone. Run tools/mic_test.py first to identify the correct device index.
MIC_DEVICE: int | None = _env_int("MIC_DEVICE", 1)
MIC_SAMPLE_RATE: int = _env_int("MIC_SAMPLE_RATE", 16_000) or 16_000
MIC_CHUNK_SAMPLES: int = _env_int("MIC_CHUNK_SAMPLES", 512) or 512
RMS_THRESHOLD: float = _env_float("RMS_THRESHOLD", 0.01)
SPEECH_PAD_CHUNKS: int = _env_int("SPEECH_PAD_CHUNKS", 20) or 20
MIN_SPEECH_CHUNKS: int = _env_int("MIN_SPEECH_CHUNKS", 8) or 8

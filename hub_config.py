"""
hub_config.py
=============
Voice / mic settings for the OBS hub.

Per-project hotkeys are defined within each project's own files.
"""

# ── Voice / ASR ───────────────────────────────────────────────────────────────
WHISPER_MODEL:    str   = "large-v3"
WHISPER_DEVICE:   str   = "cuda"
WHISPER_COMPUTE:  str   = "float16"    # float16 is optimal for 2080Ti
WHISPER_LANGUAGE: str   = "en"

# ── Microphone ────────────────────────────────────────────────────────────────
# Run mic_test.py first to identify the correct device index.
# Set MIC_DEVICE to the number shown by mic_test.py, e.g. MIC_DEVICE = 2
# Leave as None to use the system default.
MIC_DEVICE: int | None = 1

MIC_SAMPLE_RATE:   int   = 16_000      # Hz — Whisper requires 16 kHz input
MIC_CHUNK_SAMPLES: int   = 512         # samples per audio callback tick (~32 ms at 16 kHz)
RMS_THRESHOLD:     float = 0.01        # 0.0–1.0; raise if you get false triggers in silence
SPEECH_PAD_CHUNKS: int   = 20          # silent chunks to wait before ending an utterance (~0.64 s)
MIN_SPEECH_CHUNKS: int   = 8           # discard clips shorter than this (~0.26 s)
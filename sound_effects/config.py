# sound_effects/config.py

from pathlib import Path

# ── Assets ────────────────────────────────────────────────────────────────────
SOUND_EFFECTS_DIR = Path(r"F:\EVERYTHING STREAM RELATED\Assets\VisualAndAudio\soundeffects")

# ── OBS ───────────────────────────────────────────────────────────────────────
SCENE = "Sound Effects"

# ── Hotkey trigger ────────────────────────────────────────────────────────────
TRIGGER_SEQUENCE     = ["9", "8", "9"]
TRIGGER_MAX_INTERVAL = 0.150  # seconds to type the sequence

# ── Voice / recording ─────────────────────────────────────────────────────────
AUTO_RECORD_TIMEOUT: float = 2.0   # seconds before auto-stop if not manually ended

# ── Media playback ────────────────────────────────────────────────────────────
MEDIA_START_TIMEOUT = 5.0

# ── Source sync ───────────────────────────────────────────────────────────────
VALID_EXTENSIONS = {".mp3", ".mp4", ".wav", ".ogg", ".webm"}

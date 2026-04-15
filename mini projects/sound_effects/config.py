# sound_effects/config.py

import os
from pathlib import Path

# ── Assets ────────────────────────────────────────────────────────────────────
SOUND_EFFECTS_DIR = Path(os.environ["SOUND_EFFECTS_DIR"])

# ── OBS ───────────────────────────────────────────────────────────────────────
SCENE = "Sound Effects"

# ── Hotkey trigger ────────────────────────────────────────────────────────────
# Each inner list is a separate sequence that fires the same action.
# The shift variants (rows 2 & 4) are grouped so they're easy to split off later.
TRIGGER_SEQUENCES = [
    ["9", "8", "9"],    # primary
    ["(", "*", "("],    # shift+primary  ← easy to remove/separate in future
]
TRIGGER_MAX_INTERVAL = 0.150  # seconds to type the sequence

# ── Voice / recording ─────────────────────────────────────────────────────────
AUTO_RECORD_TIMEOUT: float = 2.0   # seconds before auto-stop if not manually ended

# ── Media playback ────────────────────────────────────────────────────────────
MEDIA_START_TIMEOUT = 5.0

# ── Source sync ───────────────────────────────────────────────────────────────
VALID_EXTENSIONS = {".mp3", ".mp4", ".wav", ".ogg", ".webm"}

# ── Manual direct-play hotkeys ─────────────────────────────────────────────────
# After typing 989, press one of these keys within MANUAL_TRIGGER_WINDOW seconds
# to play an SFX instantly — no voice recording needed.
# Set each value to the SFX file stem (without extension), or "" to leave unassigned.
MANUAL_TRIGGER_SFXS: dict[str, str] = {
    "!": "hooray",   # 989!
    "@": "hooray",   # 989@
    "#": "mom frog",   # 989#
    "$": "oh no",   # 989$
    "%": "",   # 989%
    "^": "",   # 989^
}
MANUAL_TRIGGER_WINDOW: float = 1  # seconds after 989 to wait for a manual key

# instant_replay/config.py

# ── League Live Client API ────────────────────────────────────────────────────
LEAGUE_API_URL         = "https://127.0.0.1:2999/liveclientdata/allgamedata"
LEAGUE_POLL_INTERVAL   = 0.5    # seconds between polls while in-game
LEAGUE_REQUEST_TIMEOUT = 2      # seconds before giving up on a request

# ── Clip window ───────────────────────────────────────────────────────────────
# The clip will start this many seconds BEFORE the first detected kill
# (only used when no manual mark has been set).
KILL_PRE_ROLL_SECONDS: float = 10.0

# The clip will start this many seconds BEFORE the detected death
# (only used when no manual mark or kill anchor has been set).
DEATH_PRE_ROLL_SECONDS: float = 8.0

# ── OBS ───────────────────────────────────────────────────────────────────────
SCENE        = "InstantReplay"
SOURCE_NAME  = "InstantReplayMedia"
RETURN_SCENE = "Test"   # scene to return to after replay finishes

# Instant Replay Logo
INSTANT_REPLAY_LOGO_SCENE = "InstantReplay"
INSTANT_REPLAY_LOGO_SOURCE = "InstantReplayLogo"

# How long to wait for OBS to confirm the replay buffer was written to disk.
REPLAY_SAVE_TIMEOUT: float = 15.0

# ── ffmpeg ────────────────────────────────────────────────────────────────────
# Trimmed file is written next to the original replay; originals are untouched.
TRIMMED_SUFFIX = "_ir_trimmed.mkv"

# ── Voice hotkey ──────────────────────────────────────────────────────────────
# Press to start recording; press 'C' or press again to stop and transcribe
# (say "save", "mark", or "play"). Auto-transcribes after RECORD_TIMEOUT_SECONDS.
HOTKEY_LISTEN = "|"

# Auto-transcribes after this many seconds if the trigger is not pressed again.
RECORD_TIMEOUT_SECONDS: float = 2.0

# ── Clip storage ─────────────────────────────────────────────────────────────
# Directory where OBS saves replay buffer files AND where trimmed clips land.
import os as _os
REPLAY_DIR = _os.environ["REPLAY_DIR"]

# Legacy subfolder for highlight reels created by older versions. New saves stay
# as individual clips and receive searchable game/session metadata instead.
EDITED_DIR = _os.path.join(REPLAY_DIR, "edited")

# ── Audio muting during replay playback ──────────────────────────────────────
# Desktop Audio is fully muted while a replay plays so the viewer only hears
# the replay audio.  Unmuted immediately when the replay ends.
DESKTOP_AUDIO_INPUT: str = "Desktop Audio"

# If "play" is spoken within this many seconds of a "save" command, the play
# will block until the save+trim finishes and then auto-trigger.
PLAY_AFTER_SAVE_WINDOW: float = 8.0

# ── Clip tags (voice aliases for save denotations) ────────────────────────────
# When the user says "save win", "save escape", etc., any token in the
# transcription after the save word is matched against these alias groups.
# The fuzzy fallback in _parse_command catches mishears not listed here.
SAVE_TAG_ALIASES: dict[str, list[str]] = {
    "win": [
        "win", "wins", "winned", "winner", "winning", "winna", "wynn",
        "wine", "whine", "whin", "whin", "when", "wend", "wen", "wench",
        "ween", "went", "wim", "whim", "wynn", "gwynn", "thin", "in",
        "been", "bin", "tin", "pin", "gin", "fin", "chin", "shin",
    ],
    "escape": [
        "escape", "escaped", "escapes", "escaping", "escapee", "escapade",
        "eskimo", "s-cape", "a-scape", "scape", "scapes", "scaping",
        "cape", "capes", "cape", "skip", "skate", "slope", "scope",
        "scoop", "skit", "skate", "space", "a cape", "the cape",
    ],
    "fail": [
        "fail", "failed", "fails", "failing", "fale", "phail",
        "feel", "fell", "fill", "file", "foul", "fowl", "veil", "vail",
        "pail", "tail", "sail", "bail", "mail", "trail", "tale", "sale",
        "pale", "gale", "dale", "bale", "stale", "vale", "kale",
        "hail", "nail", "rail", "wall", "fall", "hall", "call",
    ],
}

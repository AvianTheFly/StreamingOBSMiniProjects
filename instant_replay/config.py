# instant_replay/config.py

# ── League Live Client API ────────────────────────────────────────────────────
LEAGUE_API_URL         = "https://127.0.0.1:2999/liveclientdata/allgamedata"
LEAGUE_POLL_INTERVAL   = 0.5    # seconds between polls while in-game
LEAGUE_REQUEST_TIMEOUT = 2      # seconds before giving up on a request

# ── Clip window ───────────────────────────────────────────────────────────────
# The clip will start this many seconds BEFORE the first detected kill
# (only used when no manual mark has been set).
KILL_PRE_ROLL_SECONDS: float = 10.0

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
# First press  → start recording
# Second press → stop and transcribe  (say "save", "mark", or "play")
HOTKEY_LISTEN = "|"

# Safety cap — auto-cancels recording if the second press never comes.
RECORD_TIMEOUT_SECONDS: float = 2.0

# ── Cleanup ───────────────────────────────────────────────────────────────────
# Directory where OBS saves replay buffer files.
REPLAY_DIR = r"F:\EVERYTHING STREAM RELATED\Assets\VisualAndAudio\replays"

# ── Clip tags (voice aliases for save denotations) ────────────────────────────
# When the user says "save win", "save escape", etc., the first word after
# "save" is matched against these alias groups to determine the clip tag.
SAVE_TAG_ALIASES: dict[str, list[str]] = {
    "win": ["win", "wins", "winned", "wine", "when", "went", "wend", "wen", "wench",
            "wen's", "winning", "winner", "winna", "ween"],
    "escape": ["escape", "escaped", "escapes", "escapeing", "eskimo", "escapee",
               "capes", "scapes", "s-capes", "kape", "scaping", "escapade"],
    "fail": ["fail", "failed", "fails", "fale", "phail", "feel", "file", "fill",
             "fell", "veil", "phail"],
    "objective": ["objective", "objectives", "obj", "object", "objectsive",
                  "objections", "objection"],
}

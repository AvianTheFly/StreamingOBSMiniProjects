# league/config.py

from pathlib import Path


_PROJECT_DIR = Path(__file__).resolve().parent

# ── League API ────────────────────────────────────────────────────────────────
LEAGUE_API_URL         = "https://127.0.0.1:2999/liveclientdata/allgamedata"
POLL_INTERVAL          = 0.5
DISCONNECTED_INTERVAL  = 1.0
REQUEST_TIMEOUT        = 2

# ─────────────────────────────────────────────────────────────────────────────
# OBS Event Sources
#
# Each entry below maps a game event to an OBS scene + source.
# Set SCENE and SOURCE to your actual OBS values.
# Set ENABLED = False to skip that event entirely (no handler runs, no OBS call).
# Set DURATION to how long (seconds) the source stays visible, or None to leave
# it visible indefinitely (you must hide it yourself via another event).
# ─────────────────────────────────────────────────────────────────────────────

# ── Respawn SFX (Halo sound at 3 seconds) ─────────────────────────────────────
RESPAWN_SFX_SOURCE = "Halo Respawn sound effect"
# The clip is about 3.3 seconds long; allow for the 0.5-second API polling step.
RESPAWN_SFX_LEAD_SECONDS = 3.5

# ── Death / Respawn ───────────────────────────────────────────────────────────
# Death border stays visible until respawn — no duration needed.
DEATH_SCENE            = "LeagueGameAssets"
DEATH_SOURCE           = "DeathBorder"
DEATH_ENABLED          = True

RESPAWN_SCENE            = "LeagueGameAssets"
RESPAWN_SOURCE           = "RespawnBorder"
RESPAWN_DISPLAY_DURATION = 12.0   # seconds
RESPAWN_ENABLED          = True

# ── Recall ────────────────────────────────────────────────────────────────────
# Reuses the respawn border — duration controls how long it shows after recall.
RECALL_MIN_WAIT       = 3.0
RECALL_WATCH_WINDOW   = 14.0
RECALL_MANA_DELTA     = 20.0
RECALL_RESOURCE_TYPE  = "MANA"

# ── Level-up effect ───────────────────────────────────────────────────────────
LEVEL_UP_SCENE   = "LeagueGameAssets"
LEVEL_UP_GROUP   = "LevelUp"
LEVEL_UP_SOURCES = ["levelupSprite1", "levelupSprite2"]
LEVEL_UP_ENABLED = True

LEVEL_UP_ICON_SIZE = 128

LEVEL_UP_BOTTOM_POSITIONS = [
    (20,  900),
    (1772, 900),
]
LEVEL_UP_TOP_POSITIONS = [
    (20,  20),
    (1772, 20),
]

LEVEL_UP_RISE_DURATION   = 0.6
LEVEL_UP_BOUNCE_COUNT    = 3
LEVEL_UP_BOUNCE_HEIGHT   = 60
LEVEL_UP_BOUNCE_DURATION = 0.25
LEVEL_UP_HOLD_DURATION   = 1.5
LEVEL_UP_FPS             = 20

# ── Udyr HUD Animation (Test scene) ──────────────────────────────────────────
# Shown while in-game; hidden on death, shown on respawn, hidden on game end.
UDYR_ANIMATION_SCENE  = "Test"
UDYR_ANIMATION_SOURCE = "LeagueHudUdyrAnimation"

# ── Game Start ────────────────────────────────────────────────────────────────
GAME_START_SCENE    = "LeagueGameAssets"
GAME_START_SOURCE   = "GameStartOverlay"   # ← set your OBS source name here
GAME_START_DURATION = 5.0                  # seconds visible, or None = stay on
GAME_START_ENABLED  = False                # ← flip to True to activate

# ── Minions Spawning ──────────────────────────────────────────────────────────
MINIONS_SPAWNING_SCENE    = "LeagueGameAssets"
MINIONS_SPAWNING_SOURCE   = "MinionsSpawningOverlay"
MINIONS_SPAWNING_DURATION = 4.0
MINIONS_SPAWNING_ENABLED  = False

# ── First Brick (first tower destroyed in the game) ───────────────────────────
FIRST_BRICK_SCENE    = "LeagueGameAssets"
FIRST_BRICK_SOURCE   = "FirstBrickOverlay"
FIRST_BRICK_DURATION = 5.0
FIRST_BRICK_ENABLED  = False

# ── Turret Killed ─────────────────────────────────────────────────────────────
# Fires when ANY turret dies.  If you only want your kills, filter in the handler.
TURRET_KILLED_SCENE    = "LeagueGameAssets"
TURRET_KILLED_SOURCE   = "TurretKilledOverlay"
TURRET_KILLED_DURATION = 5.0
TURRET_KILLED_ENABLED  = False

# ── Inhibitor Killed ──────────────────────────────────────────────────────────
INHIB_KILLED_SCENE    = "LeagueGameAssets"
INHIB_KILLED_SOURCE   = "InhibKilledOverlay"
INHIB_KILLED_DURATION = 5.0
INHIB_KILLED_ENABLED  = False

# ── Dragon Kill ───────────────────────────────────────────────────────────────
DRAGON_KILL_SCENE    = "LeagueGameAssets"
DRAGON_KILL_SOURCE   = "DragonKillOverlay"
DRAGON_KILL_DURATION = 5.0
DRAGON_KILL_ENABLED  = False

# Elder Dragon gets its own optional source — set ELDER_DRAGON_SOURCE = None to
# reuse DRAGON_KILL_SOURCE for Elder kills too.
ELDER_DRAGON_SOURCE   = None   # e.g. "ElderDragonOverlay", or None
ELDER_DRAGON_DURATION = 6.0

# ── Herald Kill ───────────────────────────────────────────────────────────────
HERALD_KILL_SCENE    = "LeagueGameAssets"
HERALD_KILL_SOURCE   = "HeraldKillOverlay"
HERALD_KILL_DURATION = 5.0
HERALD_KILL_ENABLED  = False

# ── Baron Kill ────────────────────────────────────────────────────────────────
BARON_KILL_SCENE    = "LeagueGameAssets"
BARON_KILL_SOURCE   = "BaronKillOverlay"
BARON_KILL_DURATION = 6.0
BARON_KILL_ENABLED  = False

# ── Champion Kill (you kill an enemy) ─────────────────────────────────────────
CHAMPION_KILL_SCENE    = "LeagueGameAssets"
CHAMPION_KILL_SOURCE   = "ChampionKillOverlay"
CHAMPION_KILL_DURATION = 4.0
CHAMPION_KILL_ENABLED  = True

# Flash the respawn border briefly on each kill
CHAMPION_KILL_BORDER_SCENE    = "LeagueGameAssets"
CHAMPION_KILL_BORDER_SOURCE   = "RespawnBorder"
CHAMPION_KILL_BORDER_DURATION = 0.5   # seconds

# ── Kill Streak Triangles ──────────────────────────────────────────────────────
# One triangle is revealed per kill (random, no repeats).
# If 16 seconds pass without another kill, all triangles are hidden.
# Once all 4 are revealed they stay visible until the timer expires.
KILL_STREAK_SCENE   = "LeagueGameAssets"
KILL_STREAK_TIMEOUT = 16.0   # seconds between kills before reset

# Kill streak logo — shown alongside triangles, hidden when streak expires.
KILL_STREAK_LOGO    = "KillStreakLogo"

# The four triangle sources — order doesn't matter, selection is randomised.
KILL_STREAK_SOURCES = [
    "BearTriangle",
    "TurtleTriangle",
    "RamTriangle",
    "PhoenixTriangle",
]

# ── Assist Kill  ──────────────────────────────────────────────────────────────
# Reuses the same border + triangle system as champion kills.
ASSIST_KILL_ENABLED  = True

# ── Multikill ─────────────────────────────────────────────────────────────────
# One source per streak tier. Set a source to None to skip that tier.
MULTIKILL_SCENE    = "LeagueGameAssets"
MULTIKILL_DURATION = 4.0
MULTIKILL_ENABLED  = False

MULTIKILL_SOURCES = {
    2: "DoubleKillOverlay",    # Double Kill
    3: "TripleKillOverlay",    # Triple Kill
    4: "QuadraKillOverlay",    # Quadra Kill
    5: "PentaKillOverlay",     # Penta Kill
}

# ── Ace ───────────────────────────────────────────────────────────────────────
ACE_SCENE    = "LeagueGameAssets"
ACE_SOURCE   = "AceOverlay"
ACE_DURATION = 6.0
ACE_ENABLED  = False


# -- Kill audio (single OBS source, swapped per event) -----------------------
LEAGUE_KILL_AUDIO_DIR = Path(r"F:\EVERYTHING STREAM RELATED\Assets\VisualAndAudio\league events\kills")
LEAGUE_KILL_AUDIO_SCENE = "Sound Effects"
LEAGUE_KILL_AUDIO_PREFIX = "league__"
LEAGUE_KILL_AUDIO_MONITOR = "OBS_MONITORING_TYPE_MONITOR_ONLY"
LEAGUE_KILL_AUDIO_DEFAULT_VOLUME_DB = 0.0
LEAGUE_KILL_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".mp4", ".mkv", ".mov", ".webm"}
LEAGUE_AUDIO_HOTKEYS_FILE = _PROJECT_DIR / "audio_hotkeys.json"


def discover_editor_projects() -> list[dict]:
    return [
        {
            "key": "league",
            "name": "League",
            "profile_dir": _PROJECT_DIR,
            "asset_dir": LEAGUE_KILL_AUDIO_DIR,
            "hotkeys_file": LEAGUE_AUDIO_HOTKEYS_FILE,
            "extensions": sorted(LEAGUE_KILL_AUDIO_EXTENSIONS),
            "config_defaults": {
                "asset_dir": str(LEAGUE_KILL_AUDIO_DIR),
                "scene": LEAGUE_KILL_AUDIO_SCENE,
                "obs_source_prefix": LEAGUE_KILL_AUDIO_PREFIX,
                "project_volume_db": 0.0,
                "profile_volume_db": 0.0,
                "audio_settings_enabled": True,
                "categories_enabled": False,
                "obs_layout_enabled": False,
                "single_source_mode": True,
            },
            "features": {
                "audio_settings_enabled": True,
                "categories_enabled": False,
                "obs_layout_enabled": False,
            },
            "can_create_profiles": False,
        }
    ]

# specific_song/config.py

from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
# Folder that holds all the .mp4 song files.
ASSETS_DIR = Path(r"F:\EVERYTHING STREAM RELATED\Assets\VisualAndAudio\songs")

# JSON database: lives right next to this config file.
SONGS_JSON = Path(__file__).resolve().parent / "songs.json"

# ── OBS ───────────────────────────────────────────────────────────────────────
SCENE = "SpecificSongs"

# Prefix applied to every OBS source name created by this project.
# Prevents collisions with other sub-projects (e.g. meme_songs) that may
# use the same .mp4 stem names.  Does NOT affect songs.json or the asset files.
OBS_SOURCE_PREFIX = "ss__"

# Optional: force a media restart when a song starts.
RESTART_MEDIA_ON_PLAY = False

# ── Hotkey ────────────────────────────────────────────────────────────────────
TRIGGER_SEQUENCE     = ["i", "l", "i"]
TRIGGER_MAX_INTERVAL = 0.600   # seconds — generous for a 3-key chord

# Hotkey to immediately stop / hide the currently playing song.
# Mirrors the same sequence used by love_me for symmetry — change freely.
STOP_SEQUENCE     = ["9", "8", "7"]
STOP_MAX_INTERVAL = 0.300   # seconds

# ── Recording ─────────────────────────────────────────────────────────────────
# Auto-cancel mic if the closing "ili" isn't pressed within this many seconds.
RECORD_TIMEOUT_SECONDS: float = 20.0

# ── Matching ──────────────────────────────────────────────────────────────────
# Minimum similarity (0–1) for a candidate to be accepted.
MATCH_THRESHOLD: float = 0.20

# ── Media polling ─────────────────────────────────────────────────────────────
POLL_INTERVAL       = 0.10    # seconds between OBS media-state checks
MEDIA_START_TIMEOUT = 5.0     # seconds before giving up waiting for playback to start
MEDIA_TOTAL_TIMEOUT = 600.0   # hard ceiling (10 min) per song

# ── Canvas ────────────────────────────────────────────────────────────────────
# Must match your OBS canvas resolution.  Used for jump animation start/end Y.
CANVAS_WIDTH  = 1920
CANVAS_HEIGHT = 1080

# ── Bass Animation ─────────────────────────────────────────────────────────────
# Set to True to enable real-time bass-reactive scaling of the OBS source.
BASS_ANIMATION_ENABLED = True

# sounddevice index for your VB-Cable Output device.
# Run list_audio_devices.py from the hub root to find the right number.
BASS_DEVICE_INDEX = None  # default input device

# Bass frequency band to isolate (Hz).
BASS_LOW_HZ  = 60.0
BASS_HIGH_HZ = 180.0

# IIR smoothing for the bass level [0–1]. Higher = slower/smoother response.
# 0.75 = smooth enough to suppress jitter, still reacts to real hits.
BASS_SMOOTHING = 0.80   # smoothed enough to kill noise, still reacts to hits

# Only react when bass level exceeds this threshold (0–1).
BASS_THRESHOLD = 0.30   # low enough to catch real hits, high enough to ignore hiss

# Bass-reactive scale pulse on each beat hit.
BASS_MAX_SCALE = 1.5   # 35% bigger at peak — more oomph

# How often the animation loop updates OBS (seconds). 0.033 = ~30 fps.
ANIM_INTERVAL = 0.033

# ── Fixed source display size ──────────────────────────────────────────────────
# Every mp4 is rendered into this exact box regardless of its native resolution.
# OBS will letterbox/pillarbox if the aspect ratio doesn't match.
# 100% of canvas = full canvas size.
FIXED_SOURCE_WIDTH  = CANVAS_WIDTH
FIXED_SOURCE_HEIGHT = CANVAS_HEIGHT

# ── Full-screen transform ──────────────────────────────────────────────────────
# Applied to the source when a song plays so it fills the whole canvas.
# scaleX/scaleY are computed at runtime from the source's actual resolution,
# but positionX/Y and alignment are fixed here.
FULLSCREEN_POSITION_X: float = 0.0
FULLSCREEN_POSITION_Y: float = 0.0
FULLSCREEN_ALIGNMENT:  int   = 5   # OBS top-left alignment constant

# Resting position: centered on the canvas.
# These must be derived from the actual fixed source size, not hard-coded 80%.
BASS_PADDING_X = round((CANVAS_WIDTH  - FIXED_SOURCE_WIDTH) / 2)
BASS_PADDING_Y = round((CANVAS_HEIGHT - FIXED_SOURCE_HEIGHT) / 2)

# ── Onset / beat detection ────────────────────────────────────────────────────
# The current frame's bass energy must be this many times larger than the
# previous frame to count as an onset.  1.35 = 35% sudden jump.
# Raise if you're getting false triggers; lower if real hits are being missed.
ONSET_RATIO     = 1.40   # 40% energy jump = real hit
ONSET_MIN_LEVEL = 0.18   # ignore silence / noise floor
ONSET_COOLDOWN  = 0.14   # ~430 BPM max — blocks double-fires on one kick

# ── Dance animation ────────────────────────────────────────────────────────────
# Figure-8 motion: each bass beat advances the source one step around a
# Lissajous figure-8 path.  The path is defined by two independent sine
# waves — X cycles twice as fast as Y — producing a smooth infinity loop.
#
# DANCE_X_AMP  — half-width of the figure-8 in pixels (left/right travel)
# DANCE_Y_AMP  — half-height of the figure-8 in pixels (up/down travel)
# DANCE_TILT   — peak tilt in degrees, follows the X position
# DANCE_STEPS  — how many beats complete one full figure-8 loop
DANCE_X_AMP  = 18.0   # pixels left/right  — subtle on an 80%-canvas source
DANCE_Y_AMP  = 9.0    # pixels up/down     — enough vertical arc to feel like a ∞
DANCE_TILT   = 2.0    # degrees max tilt — gentle lean on a large source
DANCE_STEPS  = 20     # beats per full loop — higher = lazier drift (lower = faster)

# Pulse decay: seconds for the scale pop to fall back to 1.0 after a hit.
PULSE_DECAY  = 0.12   # snappier return so each hit feels punchy

# ── Jump animation ─────────────────────────────────────────────────────────────
# On song start the source jumps from below the canvas up to its resting corner.
# On song end it drops back down.
JUMP_DURATION   = 0.40   # seconds for the full jump arc (in or out)
JUMP_EASE_POWER = 3      # cubic easing: higher = sharper snap at the landing end

# ── Image Mask / Blend filter ──────────────────────────────────────────────────
# Set to False to skip applying the mask filter programmatically entirely.
# Useful if you'd rather configure it manually in OBS and leave it alone.
MASK_FILTER_ENABLED = False

# Mask image — resolved relative to ASSETS_DIR so it moves with the project.
# gradient.png lives one level up from the songs subfolder.
MASK_PATH = ASSETS_DIR.parent / "gradient.png"

# Name given to the filter we create programmatically.
MASK_FILTER_NAME = "ss_mask"

# opacity: int 0–100
MASK_OPACITY = 90

# type: effect filename string used by OBS internally.
#   "mask_color_filter.effect"  = Color Mask (color channel)  ← what you want
#   "mask_alpha_filter.effect"  = Alpha Mask
#   "blend_mul_filter.effect"   = Blend Multiply
MASK_TYPE = "mask_color_filter.effect"

# stretch: bool — maps to the "Stretch Image" checkbox in OBS UI.
# In OBS source: lock_aspect = !obs_data_get_bool(settings, SETTING_STRETCH)
# So True here = stretch image checked = no aspect lock.
MASK_STRETCH = True
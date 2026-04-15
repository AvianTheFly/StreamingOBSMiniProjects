# love_me/config.py

# Trigger is now a sibling file inside this mini-project folder.
# If you want to share it across projects, move trigger.py to obs_hub/shared/
# and update this path to "shared.trigger".
TRIGGER_MODULE = "trigger"
TRIGGER_CLASS  = "SequenceTrigger"

TRIGGER_SEQUENCE     = ["9", "8", "7"]
TRIGGER_MAX_INTERVAL = 0.300  # seconds

SCENE = "LoveMe"

# display_name = item shown/hidden in the scene
# monitor_name = actual media input OBS polls for state
ITEMS = [
    {"display_name": "LoveMe1",         "monitor_name": "LoveMe1"},
    {"display_name": "love ME 2 faker", "monitor_name": "LoveMe2"},
    {"display_name": "Love me 3 faker", "monitor_name": "LoveMe3"},
    {"display_name": "love me song",    "monitor_name": "love me song"},
]

POLL_INTERVAL = 0.10

MEDIA_PLAYING    = "OBS_MEDIA_STATE_PLAYING"
MEDIA_END_STATES = {
    "OBS_MEDIA_STATE_STOPPED",
    "OBS_MEDIA_STATE_ENDED",
    "OBS_MEDIA_STATE_NONE",
}

MEDIA_START_TIMEOUT = 5.0
MEDIA_TOTAL_TIMEOUT = 600.0

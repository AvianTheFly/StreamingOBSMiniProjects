"""Hotkey-editor form metadata, independent of HTTP and saved user settings.

Change labels, field types and conditional visibility here. Module CONFIG values
are adapted in lib.editor_config; server.py merges saved overrides and handles
requests. This module performs no I/O.
"""

CONFIG_FIELDS = [
    {"section": "Core", "key": "asset_dir", "label": "Asset Folder", "type": "path", "help": "Folder scanned for audio and video files."},
    {"section": "Core", "key": "scene", "label": "OBS Scene", "type": "text", "help": "OBS scene this profile controls."},
    {"section": "Core", "key": "obs_source_prefix", "label": "OBS Source Prefix", "type": "text", "help": "Prefix used when creating/re-linking OBS sources. Keep this stable to preserve existing sources."},
    {"section": "Core", "key": "event_name", "label": "Hub Event", "type": "text", "help": "Optional event name other projects can emit to play media."},
    {"section": "Core", "key": "valid_extensions", "label": "File Types", "type": "text", "help": "Comma-separated extensions, like .mp3, .mp4, .webm."},
    {"section": "Triggers", "key": "trigger_sequences", "label": "Trigger Sequences", "type": "text", "help": "Key sequences that activate this profile, e.g. '/ *'. Separate multiple with ' ; '."},
    {"section": "Triggers", "key": "trigger_max_interval", "label": "Trigger Speed", "type": "number", "step": "0.01", "help": "Seconds allowed between trigger keys."},
    {"section": "Triggers", "key": "manual_trigger_window", "label": "Manual Key Window", "type": "number", "step": "0.1", "help": "Seconds after the trigger sequence to accept direct hotkeys."},
    {"section": "Triggers", "key": "auto_record_timeout", "label": "Voice Auto Stop", "type": "number", "step": "0.1", "help": "Seconds before voice capture auto-transcribes."},
    {"section": "Interface Hotkeys", "key": "interface_hotkeys", "label": "Project Controls", "type": "hotkey_map", "help": "Hotkeys for verbs like start listen, abort listen, stop, random, next, reload, pause, and resume."},
    {"section": "Features", "key": "manual_hotkeys_enabled", "label": "Manual Hotkeys", "type": "boolean", "help": "Allow trigger sequence + direct key media playback."},
    {"section": "Features", "key": "voice_commands_enabled", "label": "Voice Commands", "type": "boolean", "help": "Allow trigger sequence to open voice matching."},
    {"section": "Features", "key": "random_commands_enabled", "label": "Random / Next Commands", "type": "boolean", "help": "Allow voice commands like random, next, stop, and random category."},
    {"section": "Features", "key": "categories_enabled", "label": "Categories", "type": "boolean", "help": "Use category tags for organization and layout filtering."},
    {"section": "Features", "key": "obs_layout_enabled", "label": "OBS Canvas Rules", "type": "boolean", "help": "Use OBS canvas layout rules for video sources."},
    {"section": "Features", "key": "audio_settings_enabled", "label": "Audio Settings", "type": "boolean", "help": "Show and apply monitor, volume, and track routing settings."},
    {"section": "Matching", "key": "matching_strategy", "label": "Scoring System", "type": "select", "options": [["hybrid", "Fuzzy + TF-IDF Tie Break"], ["weighted", "Weighted Fuzzy / Tokens"], ["embedding", "Weighted + Embeddings"]], "help": "Voice matcher scoring method."},
    {"section": "Matching", "key": "fuzzy_scorer", "label": "Fuzzy Scorer", "type": "select", "options": [["WRatio", "WRatio"], ["token_set_ratio", "Token Set"], ["token_sort_ratio", "Token Sort"], ["partial_ratio", "Partial"], ["ratio", "Simple Ratio"]], "help": "RapidFuzz scorer used for fuzzy matching."},
    {"section": "Matching", "key": "fuzzy_threshold", "label": "Match Strictness", "type": "number", "step": "1", "help": "Higher means voice matches must be closer."},
    {"section": "Matching", "key": "semantic_gap", "label": "Tie Break Gap", "type": "number", "step": "1", "help": "How close matches can be before they are treated as ambiguous."},
    {"section": "Matching", "key": "fuzzy_weight", "label": "Fuzzy Weight", "type": "number", "step": "0.05", "help": "Weighted scoring contribution from fuzzy text similarity."},
    {"section": "Matching", "key": "token_weight", "label": "Token Weight", "type": "number", "step": "0.05", "help": "Weighted scoring contribution from shared words."},
    {"section": "Matching", "key": "embedding_weight", "label": "Embedding Weight", "type": "number", "step": "0.05", "help": "Weighted scoring contribution from optional local embeddings."},
    {"section": "Matching", "key": "embedding_model", "label": "Embedding Model", "type": "text", "help": "Optional sentence-transformers model name. Empty uses all-MiniLM-L6-v2 if installed."},
    {"section": "Playback", "key": "media_start_timeout", "label": "Media Start Timeout", "type": "number", "step": "0.1", "help": "Seconds to wait for OBS media playback to start."},
    {"section": "Playback", "key": "media_total_timeout", "label": "Media Total Timeout", "type": "number", "step": "1", "help": "Maximum seconds to wait for media playback to finish."},
    {"section": "Audio", "key": "monitor", "label": "Audio Monitor", "type": "select", "options": [["OBS_MONITORING_TYPE_MONITOR_ONLY", "Monitor Only"], ["OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT", "Monitor and Output"], ["OBS_MONITORING_TYPE_NONE", "No Monitor"]], "help": "OBS monitor mode applied during source sync."},
    {"section": "Audio", "key": "default_volume_db", "label": "New Source Volume dB", "type": "number", "step": "0.5", "help": "Volume applied to newly-created OBS media sources."},
    {"section": "Audio", "key": "project_volume_db", "label": "Mini Project Volume dB", "type": "number", "step": "0.5", "help": "Global additive volume layer for this mini project/profile."},
    {"section": "Audio", "key": "profile_volume_db", "label": "Active Profile Volume dB", "type": "number", "step": "0.5", "help": "Additive volume layer for the current editor profile. File offsets stay relative."},
    {"section": "Audio", "key": "audio_tracks", "label": "Audio Tracks", "type": "text", "help": "Optional OBS output tracks, e.g. 2,3,4,5,6. Empty leaves routing unchanged."},
    {"section": "Debug", "key": "verbose_matcher", "label": "Verbose Voice Logs", "type": "boolean", "help": "Print voice matching diagnostics in the hub console."},
]


VOICE_COMMANDS_FIELD = {
    "section": "Voice Commands",
    "key": "voice_commands",
    "label": "Built-in Commands",
    "type": "info",
    "help": "Say these after the trigger sequence. 'random [category]' shuffles from that category.",
}


def config_fields_for_project(proj: dict) -> list[dict]:
    fields = list(CONFIG_FIELDS)
    if "voice_commands" in (proj.get("config_defaults") or {}):
        fields.append(VOICE_COMMANDS_FIELD)
    return fields



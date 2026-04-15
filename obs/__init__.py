# obs/__init__.py
#
# Single import point for all OBS interactions.
#
# Usage in any mini-project:
#
#   from obs import show_source, hide_source, switch_scene   # preferred
#   from obs import get_obs                                   # raw client, if needed
#   from obs import sync_assets, MONITOR_ONLY                # asset ↔ scene sync
#
# Never import from obs.interaction, obs.client, or obs.sync directly —
# those are implementation details that may change.

from .client import get_obs, reset_obs
from .interaction import (
    show_source, hide_source, toggle_source, hide_sources,
    show_source_animated, show_logo_animated,
    switch_scene, get_current_scene, list_scenes, create_scene_if_missing,
    get_media_state, stop_media, restart_media, pause_media, play_media, wait_for_media_end,
    create_media_source, delete_source, list_sources, list_group_sources,
    start_stream, stop_stream, start_record, stop_record,
    get_stream_status,
    set_text,
    get_source_filters, set_source_filter_enabled,
    create_source_filter, set_source_filter_settings, remove_source_filter,
    get_scene_item_id,
    set_source_transform, get_source_transform, set_source_transform_by_id,
    configure_input_audio,
    set_input_audio_tracks,
    save_replay_buffer_and_wait, set_media_source_file, configure_media_source_properties,
    get_input_volume, set_input_volume_db, set_input_volume_mul,
    get_input_audio_monitor_type, set_input_audio_monitor_type,
    get_input_list, set_desktop_audio_volume,
    set_input_mute, get_input_mute,
    get_stream_title, set_stream_title, create_scene_item,
)
from .sync import (
    sync_assets,
    MONITOR_ONLY,
    MONITOR_AND_OUT,
    NO_MONITOR,
)

__all__ = [
    # Connection
    "get_obs", "reset_obs",
    # Source visibility
    "show_source", "hide_source", "toggle_source", "hide_sources",
    "show_source_animated", "show_logo_animated",
    # Scenes
    "switch_scene", "get_current_scene", "list_scenes", "create_scene_if_missing",
    # Media playback
    "get_media_state", "stop_media", "restart_media", "pause_media", "play_media",
    "wait_for_media_end", "set_media_source_file",
    # Source management
    "create_media_source", "delete_source", "list_sources", "list_group_sources",
    # Stream / record
    "start_stream", "stop_stream", "start_record", "stop_record", "get_stream_status",
    # Text sources
    "set_text",
    # Filters
    "get_source_filters", "set_source_filter_enabled",
    "create_source_filter", "set_source_filter_settings", "remove_source_filter",
    # Transform / position
    "get_scene_item_id",
    "set_source_transform", "get_source_transform", "set_source_transform_by_id",
    # Audio
    "configure_input_audio",
    "set_input_audio_tracks",
    "get_input_volume", "set_input_volume_db", "set_input_volume_mul",
    "get_input_audio_monitor_type", "set_input_audio_monitor_type",
    "get_input_list", "set_desktop_audio_volume",
    # Replay buffer
    "save_replay_buffer_and_wait",
    "configure_media_source_properties",
    # Mute
    "set_input_mute", "get_input_mute",
    # Stream title
    "get_stream_title", "set_stream_title",
    "create_scene_item",
    # Asset sync
    "sync_assets",
    "MONITOR_ONLY", "MONITOR_AND_OUT", "NO_MONITOR",
]
# obs/__init__.py
# Expose the most commonly used things at the package level.

from .client import get_obs, reset_obs
from .interaction import (
    show_source, hide_source, toggle_source, hide_sources,
    show_source_animated, show_logo_animated,
    switch_scene, get_current_scene, list_scenes,
    get_media_state, restart_media, wait_for_media_end,
    create_media_source, delete_source, list_sources,
    start_stream, stop_stream, start_record, stop_record,
    get_stream_status,
    set_text, set_filter_enabled,
    get_source_filters, set_source_filter_enabled,
    create_source_filter, set_source_filter_settings, remove_source_filter,
    set_source_transform, get_source_transform, configure_input_audio,
    save_replay_buffer_and_wait, set_media_source_file,
    get_input_volume, set_input_volume_db, set_input_volume_mul,
    get_input_list, set_desktop_audio_volume,
    get_stream_title, set_stream_title,
)

__all__ = [
    "get_obs", "reset_obs",
    "show_source", "hide_source", "toggle_source", "hide_sources",
    "show_source_animated", "show_logo_animated",
    "switch_scene", "get_current_scene", "list_scenes",
    "get_media_state", "restart_media", "wait_for_media_end",
    "create_media_source", "delete_source", "list_sources",
    "start_stream", "stop_stream", "start_record", "stop_record",
    "get_stream_status",
    "set_text", "set_filter_enabled",
    "get_source_filters", "set_source_filter_enabled",
    "create_source_filter", "set_source_filter_settings", "remove_source_filter",
    "set_source_transform", "get_source_transform", "configure_input_audio",
    "save_replay_buffer_and_wait", "set_media_source_file",
    "get_input_volume", "set_input_volume_db", "set_input_volume_mul",
    "get_input_list", "set_desktop_audio_volume",
    "get_stream_title", "set_stream_title",
]
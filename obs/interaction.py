"""Compatibility facade; implementations are split by OBS responsibility.

New code imports the public obs package, which re-exports these same functions.
"""
from .animations import (
    show_source_animated,
    show_logo_animated,
)
from .scenes import (
    switch_scene,
    get_current_scene,
    list_scenes,
    create_scene_if_missing,
)
from .media import (
    get_media_state,
    get_media_status,
    stop_media,
    restart_media,
    pause_media,
    play_media,
    wait_for_media_end,
    create_media_source,
    set_media_source_file,
    configure_media_source_properties,
    park_media_source,
)
from .audio import (
    _is_unsupported_audio_error,
    get_input_audio_monitor_type,
    set_input_audio_monitor_type,
    get_input_volume,
    set_input_volume_db,
    ensure_input_on_stream_track,
    set_input_volume_mul,
    get_input_list,
    set_input_mute,
    get_input_mute,
    set_desktop_audio_volume,
    set_input_audio_tracks,
    configure_input_audio,
)
from .outputs import (
    start_stream,
    stop_stream,
    start_record,
    stop_record,
    get_stream_status,
    save_replay_buffer_and_wait,
    get_stream_title,
    set_stream_title,
)
from .sources import (
    _get_scene_item_id,
    show_source,
    hide_source,
    toggle_source,
    hide_sources,
    delete_source,
    create_scene_item,
    list_sources,
    list_group_sources,
    set_text,
    get_source_filters,
    set_source_filter_enabled,
    create_source_filter,
    set_source_filter_settings,
    remove_source_filter,
    get_scene_item_id,
    set_source_transform,
    set_source_transform_by_id,
    get_source_transform,
    get_canvas_size,
    get_scene_source_transforms,
    get_scene_sources,
    set_scene_source_visible,
)

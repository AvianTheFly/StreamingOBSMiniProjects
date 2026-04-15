# obs/ — CLAUDE.md

## What this directory is

The OBS abstraction layer. All WebSocket communication with OBS goes through
this package. Mini-projects must `import obs` and use only the functions
exported from `obs/__init__.py`. Never import `obsws_python` directly.

## Usage

```python
import obs

obs.show_source("MyScene", "MySource")
obs.hide_source("MyScene", "MySource")
obs.switch_scene("TargetScene")
obs.restart_media("SourceName")
obs.wait_for_media_end("SourceName", start_timeout=5.0, total_timeout=60.0)
```

## Key files

| File | Role |
|---|---|
| `__init__.py` | Single public API — all exported functions listed here |
| `client.py` | OBS WebSocket connection management (`get_obs()`, `reset_obs()`) |
| `interaction.py` | All OBS operations — show/hide, switch scene, media, filters, audio, etc. |
| `obs_config.py` | Connection defaults: host, port, password (overridden by `.env`) |

## Connection

The connection is a lazy singleton in `client.py`. First call to `get_obs()`
connects; subsequent calls return the cached client. `reset_obs()` forces a
reconnect (used after connection errors).

Connection parameters are read from `obs_config.py` or overridden by `.env`:
```
OBS_HOST=localhost
OBS_PORT=4455
OBS_PASSWORD=your_password
```

## Available functions (grouped)

**Source visibility:**
`show_source`, `hide_source`, `toggle_source`, `hide_sources`,
`show_source_animated`, `show_logo_animated`

**Scenes:**
`switch_scene`, `get_current_scene`, `list_scenes`, `create_scene_if_missing`

**Media playback:**
`get_media_state`, `stop_media`, `restart_media`, `pause_media`, `play_media`,
`wait_for_media_end`, `set_media_source_file`, `configure_media_source_properties`

**Source management:**
`create_media_source`, `delete_source`, `list_sources`, `list_group_sources`

**Audio:**
`get_input_volume`, `set_input_volume_db`, `set_input_volume_mul`,
`get_input_audio_monitor_type`, `set_input_audio_monitor_type`,
`set_desktop_audio_volume`, `configure_input_audio`, `set_input_audio_tracks`

**Filters:**
`get_source_filters`, `set_source_filter_enabled`,
`create_source_filter`, `set_source_filter_settings`, `remove_source_filter`

**Transform / position:**
`get_scene_item_id`, `set_source_transform`, `get_source_transform`,
`set_source_transform_by_id`

**Stream / record:**
`start_stream`, `stop_stream`, `start_record`, `stop_record`, `get_stream_status`

**Replay buffer:**
`save_replay_buffer_and_wait`

**Text sources:**
`set_text`

**Stream title (OBS-side):**
`get_stream_title`, `set_stream_title`

## Adding a new OBS operation

1. Implement the function in `interaction.py`.
2. Export it from `__init__.py` (add to both the `from .interaction import (...)` block
   and the `__all__` list).
3. Never bypass the abstraction — if `obsws_python` adds a new API, wrap it here.

# `obs/` Package — Claude Reference

> **Read this before writing any mini-project code that touches OBS.**
> All functions here are importable as `from obs import <name>` or via `import obs`.
> Never import `obsws_python` directly. Never call `obs.get_obs()` for routine operations.
> Source of truth: `obs/interaction.py` and `obs/__init__.py`.

---

## How the connection works

`obs/client.py` holds a **single shared `obsws_python.ReqClient`** for the entire hub process.
All functions below use it automatically via `get_obs()` internally.

```python
# Raw client — only if you need an OBS call not wrapped below
from obs import get_obs
client = get_obs()
client.send("SomeRequest", {"key": "value"})

# Force a reconnect (e.g. after OBS restarts mid-session)
from obs import reset_obs
reset_obs()
```

Connection settings come from environment variables loaded in `obs/obs_config.py`:
- `OBS_HOST` (default `localhost`)
- `OBS_PORT` (default `4455`)
- `OBS_PASSWORD`

---

## Full API reference

### Source visibility

```python
obs.show_source(scene: str, source: str) -> None
```
Make a source visible in a scene.

```python
obs.hide_source(scene: str, source: str) -> None
```
Hide a source. Also stops any idle coin-spin animation thread on that source.

```python
obs.toggle_source(scene: str, source: str, duration: float | None = None) -> None
```
Show a source, optionally sleep `duration` seconds, then hide it.
If `duration` is None, just shows it (no auto-hide).

```python
obs.hide_sources(scene: str, sources: list[str]) -> None
```
Hide multiple sources in one call. Silently skips any that error.

---

### Animated source show (league / replay branding)

```python
obs.show_source_animated(
    scene: str,
    source: str,
    jump_duration: float = 2.0,
    filter_name: str = "3D Block",
) -> None
```
Launches a source from off-screen bottom with a smoothstep slide-up.
During ascent it ramps into a coin-spin via the "3D Block" filter.
After landing it starts a **background daemon thread** doing a continuous idle coin-spin.
The idle spin is automatically killed when `hide_source()` is called on the same source.
Rest position is loaded from `obs/positions.json`; run `python tools/detect_positions.py` to update it.

```python
obs.show_logo_animated(
    scene: str,
    source: str,
    filter_name: str = "3D Block",
    jump_duration: float = 1.5,
) -> None
```
Slides a logo up from below the 1080p canvas with an X-axis spin (1.5 rotations during ascent).
Lands at the exact saved position/scale/filter from `tools/logo_config.json`.
Does **not** start an idle spin — source sits still after landing.

---

### Scene switching

```python
obs.switch_scene(scene: str) -> None
obs.get_current_scene() -> str
obs.list_scenes() -> list[str]

obs.create_scene_if_missing(scene: str) -> bool
# Creates the scene if it doesn't already exist.
# Returns True if it was created, False if it already existed.
# Use at mini-project startup to ensure required scenes exist.
```

---

### Scene item ID resolution

```python
obs.get_scene_item_id(scene: str, source: str) -> int
```
Returns the integer `sceneItemId` for `source` in `scene`.
Raises `RuntimeError` if not found after 3 retries.

**When to use this:** Cache the item_id once before an animation loop, then call
`set_source_transform_by_id()` inside the loop to avoid a lookup on every frame.

---

### Transform / position

```python
obs.set_source_transform(scene: str, source: str, transform: dict) -> None
obs.get_source_transform(scene: str, source: str) -> dict
```
Standard transform get/set — resolves source name to item_id on each call.
Fine for one-shot moves.

```python
obs.set_source_transform_by_id(scene: str, item_id: int, transform: dict) -> None
```
Same as `set_source_transform` but skips the item_id lookup.
**Use this in animation loops** (20–25 fps). Pair with `get_scene_item_id()`.

**transform dict keys** (all optional, OBS ignores unrecognised keys):

| Key | Type | Notes |
|---|---|---|
| `positionX` | float | Canvas X coordinate |
| `positionY` | float | Canvas Y coordinate |
| `scaleX` | float | Horizontal scale multiplier |
| `scaleY` | float | Vertical scale multiplier |
| `rotation` | float | Degrees clockwise |
| `boundsType` | str | e.g. `"OBS_BOUNDS_SCALE_INNER"`, `"OBS_BOUNDS_NONE"` |
| `boundsWidth` | float | Bounding box width (used when boundsType is set) |
| `boundsHeight` | float | Bounding box height |
| `alignment` | int | Alignment bitmask (default 5 = top-left) |

**get_source_transform return dict** includes all of the above plus read-only fields:
`sourceWidth`, `sourceHeight`, `width`, `height`, `cropLeft/Right/Top/Bottom`.

---

### Media playback

```python
obs.get_media_state(source: str) -> str | None
```
Returns one of the state strings below, or `None` on error.

```python
obs.restart_media(source: str) -> None   # seek to start and play
obs.play_media(source: str) -> None      # resume from current position
obs.pause_media(source: str) -> None     # pause at current position
obs.stop_media(source: str) -> None      # stop (resets position)
```

```python
obs.wait_for_media_end(
    source: str,
    poll_interval: float = 0.10,
    start_timeout: float = 5.0,
    total_timeout: float = 600.0,
) -> bool
```
Blocks the calling thread until the source finishes playing.
Returns `True` if it ended cleanly, `False` on timeout or if it never started.
Intended to be called from a daemon thread, not the hub's main thread.

```python
obs.set_media_source_file(source: str, filepath: str | Path) -> None
```
Point an existing `ffmpeg_source` input at a new file without changing any other settings.
Call `restart_media()` afterwards to play it.

```python
obs.configure_media_source_properties(
    source: str,
    *,
    restart_on_activate: bool | None = None,
    close_when_inactive: bool | None = None,
    looping: bool | None = None,
) -> None
```
Set behavioural properties on an `ffmpeg_source` without touching other settings.
Only specified (non-`None`) keys are written. Equivalent to checking the checkboxes
in OBS → source properties dialog:
- `restart_on_activate=True` — "Restart playback when source becomes active"
- `close_when_inactive=True` — "Close file when inactive"
- `looping=True` — "Loop"

Call this after `create_media_source` (and on every sync) to ensure properties are set.

**Media state constants:**
```
"OBS_MEDIA_STATE_PLAYING"
"OBS_MEDIA_STATE_PAUSED"
"OBS_MEDIA_STATE_STOPPED"
"OBS_MEDIA_STATE_ENDED"
"OBS_MEDIA_STATE_NONE"      ← source doesn't exist or has no file
"OBS_MEDIA_STATE_ERROR"
```

---

### Source management

```python
obs.create_media_source(
    scene: str,
    source_name: str,
    filepath: str | Path,
    hidden: bool = True,
) -> bool
```
Add a new `ffmpeg_source` to a scene. Idempotent — returns `True` if it already exists.
Sets `restart_on_activate=True`, `close_when_inactive=True`, `looping=False`.

```python
obs.delete_source(scene: str, source_name: str) -> bool
```
Remove the source from the scene and delete the underlying input. Returns `True` on success.

```python
obs.list_sources(scene: str) -> dict[str, int]
```
Returns `{source_name: scene_item_id}` for every item in the scene.
Returns an empty dict (not an exception) if the scene doesn't exist or OBS errors.

---

### Filters

```python
obs.get_source_filters(source: str) -> list[dict]
```
Returns all filters on a source. Each dict has keys: `name`, `kind`, `enabled`, `settings`.

```python
obs.set_source_filter_enabled(source: str, filter_name: str, enabled: bool) -> None
```
Enable or disable a filter by name.

```python
obs.create_source_filter(
    source: str,
    filter_name: str,
    filter_kind: str,
    settings: dict,
) -> None
```
Add a new filter. Common `filter_kind` values: `"color_filter"`, `"color_grade_filter"`,
`"mask_filter_v2"`, `"sharpness_filter_v2"`.

```python
obs.set_source_filter_settings(source: str, filter_name: str, settings: dict) -> None
```
Push settings onto an existing filter. Uses `overlay=True` — OBS **merges** the supplied
keys into the existing settings instead of replacing them all. Safe to call with partial dicts.

```python
obs.remove_source_filter(source: str, filter_name: str) -> None
```

---

### Text sources

```python
obs.set_text(source: str, text: str) -> None
```
Update the displayed text of a "Text (GDI+)" or "Text (FreeType 2)" source.

---

### Audio — volume & monitoring

```python
obs.get_input_volume(input_name: str) -> dict | None
# Returns {"mul": float, "db": float} or None on failure.

obs.set_input_volume_db(input_name: str, db: float) -> None
# 0 dB = 100%, -inf dB = silent. Common values: 0.0, -6.0, -23.0, -40.0.

obs.set_input_volume_mul(input_name: str, mul: float) -> None
# 1.0 = 100%, 0.0 = silent.

obs.set_desktop_audio_volume(level_percent: float, input_name: str | None = None) -> None
# Convenience: 0–100 percent. Auto-detects "Desktop Audio" if input_name is None.

obs.get_input_audio_monitor_type(input_name: str) -> str | None
obs.set_input_audio_monitor_type(input_name: str, monitor_type: str) -> None

obs.get_input_list() -> list[str]
# All OBS input names — useful for finding the right name for audio inputs.
```

```python
obs.configure_input_audio(
    input_name: str,
    monitor_type: str | None = None,
    volume_db: float | None = None,
    volume_mul: float | None = None,
) -> None
```
Convenience wrapper — set monitor type and/or volume in one call.
Supply `volume_db` or `volume_mul`, not both.

**Monitor type constants:**
```
"OBS_MONITORING_TYPE_NONE"                 ← default, no monitoring
"OBS_MONITORING_TYPE_MONITOR_ONLY"         ← hear locally, not on stream
"OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT"   ← hear AND send to stream
```

---

### Audio — track routing

```python
obs.set_input_audio_tracks(source: str, tracks: dict) -> None
```
Control which of OBS's 6 output tracks an input is sent to.
`tracks` maps track number strings to booleans.

```python
# Route a media source to tracks 2-6 only (exclude commentary track 1):
obs.set_input_audio_tracks("MySong.mp4", {
    "1": False,
    "2": True, "3": True, "4": True, "5": True, "6": True,
})
```

---

### Stream & recording

```python
obs.start_stream() -> None
obs.stop_stream() -> None
obs.start_record() -> None
obs.stop_record() -> None
obs.get_stream_status() -> dict   # {"active": bool, "bytes": int | None}
```

---

### Replay buffer

```python
obs.save_replay_buffer_and_wait(timeout: float = 15.0) -> str | None
```
Trigger OBS to save the replay buffer. Blocks until OBS fires the `ReplayBufferSaved`
event (file fully written). Returns the **absolute path** to the saved file, or `None`
if the event doesn't arrive within `timeout` seconds.

Internally opens a second `EventClient` connection just for the event and closes it
immediately after — this is fine and expected.

---

### Stream title

```python
obs.get_stream_title() -> str | None   # reads from OBS stream service settings
obs.set_stream_title(title: str) -> None
```
Note: this reads/writes the OBS stream service title field, not the Twitch Helix API.
For Twitch the `stream_title` mini-project updates both.

---

## Common patterns

### One-shot source flash (show for N seconds)

```python
import obs
obs.toggle_source("MyScene", "MySource", duration=3.0)
```

### Play a media file and block until it finishes

```python
import obs

obs.set_media_source_file("MyVideoSource", r"C:\path\to\clip.mp4")
obs.show_source("MyScene", "MyVideoSource")
obs.restart_media("MyVideoSource")
obs.wait_for_media_end("MyVideoSource", start_timeout=5.0, total_timeout=120.0)
obs.hide_source("MyScene", "MyVideoSource")
```

### Sync a folder of files to OBS sources

```python
import obs
from pathlib import Path

SCENE = "SoundEffects"
ASSETS = Path(r"F:\...\Assets\SFX")

existing = obs.list_sources(SCENE)     # {name: item_id}
for p in ASSETS.glob("*.mp4"):
    if p.stem not in existing:
        obs.create_media_source(SCENE, p.stem, p, hidden=True)
```

### Animation loop (cache item_id, set transform by id)

```python
import obs, time

item_id = obs.get_scene_item_id("Sprites", "MySprite")   # cache once

for frame in range(100):
    obs.set_source_transform_by_id("Sprites", item_id, {
        "positionX": frame * 10.0,
        "positionY": 500.0,
        "rotation":  frame * 3.6,
    })
    time.sleep(0.04)   # ~25 fps
```

### Configure audio for a media source before playback

```python
import obs

obs.configure_input_audio(
    "MySong.mp4",
    monitor_type="OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT",
    volume_db=0.0,
)
obs.set_input_audio_tracks("MySong.mp4", {
    "1": False,   # exclude from commentary/game track
    "2": True, "3": True, "4": True, "5": True, "6": True,
})
```

### Save a replay clip and get its path

```python
import obs

path = obs.save_replay_buffer_and_wait(timeout=15.0)
if path:
    print(f"Saved: {path}")
else:
    print("Replay save timed out")
```

---

## What NOT to do

| Wrong | Right |
|---|---|
| `import obsws_python` in a mini-project | `import obs` |
| `from obs.client import get_obs` (in a mini-project) | `import obs` and use named functions |
| `from obs.interaction import show_source` | `from obs import show_source` |
| `obs.get_obs().get_scene_item_id(...)` | `obs.get_scene_item_id(scene, source)` |
| `obs.get_obs().set_scene_item_enabled(...)` | `obs.show_source(scene, source)` |
| `obs.get_obs().set_scene_item_transform(...)` | `obs.set_source_transform()` or `obs.set_source_transform_by_id()` |
| `obs.set_source_transform()` in a tight animation loop | Cache item_id, use `obs.set_source_transform_by_id()` |
| `obs.set_source_filter_settings()` with a full settings dict | Fine — `overlay=True` means it merges, not replaces |

The only legitimate reason to call `obs.get_obs()` in a mini-project is for a raw
`client.send("RequestName", {...})` when no named wrapper exists yet. If you find
yourself doing this repeatedly, add a wrapper to `obs/interaction.py` and export it
from `obs/__init__.py`.

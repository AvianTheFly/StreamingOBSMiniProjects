# Streaming Scripts v2

Local OBS automation hub for running small streaming mini projects together.

## Supported Modules

The Hub intentionally loads only these stream modules:

- `league`
- `league_api` — one-source alerts in the `League API` scene; see [setup and media guide](mini%20projects/league_api/README.md).
- `soundboard`
- `tik_tok`
- `scene_voice_switcher`
- `love_me`
- Music (internal module key: `specific_song`)
- `instant_replay`
- `twitch_celebrations` — varied border parties for raids/follows/subs/gifts/cheers;
  [setup and extension guide](mini%20projects/twitch_celebrations/README.md).

It also loads `sound_effects` as a supporting audio module used by League.
Legacy folders such as `stream_title` and `browser_lenses` are retained for
reference but are disabled and are not discovered by the Hub.

## Start Here

- Install Python packages: `py -3.11 -m pip install -r requirements.txt`
- Install FFmpeg and make sure `ffmpeg` and `ffprobe` are on `PATH`.
- Double-click `Run Hub.bat` from File Explorer.
- Run the hub from PowerShell: `py -3.11 hub.py`
- Run only one project: `py -3.11 hub.py --only soundboard`
- Open the hotkey editor: `py -3.11 hotkey_editor.py`
- Check the environment: `py -3.11 tools/doctor.py`

In **Instant Replay**, pick a clip and **Load preview** to trim it. Drag the start/end
sliders, enter times in seconds, or use **Start here / End here** while scrubbing.
**Preview selection** plays just that moment; enable **Loop selection** to refine it.
**Save trimmed copy** adds a full-resolution cut to the library for OBS or a
compilation, keeping the original and its saved audio level. Trimming works with OBS closed.

## Important Folders

- `mini projects/`: project-specific code and config.
- `lib/`: reusable framework code shared by projects.
- `obs/`: the only supported OBS API boundary.
- `voice/`: shared microphone and Whisper listener.
- `tools/`: diagnostics and one-off maintenance commands.

## Code entry points

Start with the layer that owns the change; these files are shared by the running Hub.

| Responsibility | Start here |
| --- | --- |
| Application startup and shutdown | `hub.py` (UI + modules), `main.py` (module runner) |
| Supported module discovery | `lib/project_registry.py` |
| Module config to editor field defaults | `lib/editor_config.py` |
| Browser UI and its API | `hub_ui/app/`, `hub_ui/server.py` |
| Shared asset/hotkey editor | `lib/hotkey_editor/`; `hotkey_editor.py` is its launcher |
| Hotkey-editor labels, field types and visibility | `lib/hotkey_editor/schema.py` |
| Editor profile defaults, responses and profile changes (no I/O) | `lib/hotkey_editor/profiles.py` |
| Song-name scoring shared by playback and editor previews | `lib/shared_media/phrase_scoring.py` |
| Playback arbitration between modules | `coordinator.py`, `hub_rules.py` |
| Live module interfaces and registry | `lib/project_runtime.py` (also exported by `shared.py`) |
| Shared hotkey/voice helpers and event bus | `shared.py`, `events.py` |
| Typed hotkey sequence matching | `lib/key_sequences.py` (also exported by `shared.py`) |
| OBS operations | `obs/` |
| Shared-source per-asset volume tracking | `lib/asset_fader.py` |
| Settings transactions and recovery | `lib/project_settings.py`, `lib/settings_backups.py` |
| Module-specific behavior | `mini projects/<module>/main.py` and `interface.py` |

Both launchers use `main.run_hub()` for runtime setup, discovery, filtering and
module startup. Importing either launcher does not parse arguments or start
services. The UI waits for OBS if it is offline; the console launcher exits.
The embedded hotkey editor uses `open_browser=False` and the Hub's `stop_event`
so browser behavior and shutdown stay local to that server.

For League alerts, `engine.py` detects and schedules events, `editor.py` validates
and persists settings, `presentation.py` switches media setups, and `main.py`
owns the running service. `http_server.py` handles browser requests;
`control.js` and `presentation.js` implement editing, while `overlay.html` renders
playback. These are under `mini projects/league_api/`.

Module JSON files and media are live user data, not disposable fixtures. Keep
existing paths stable when extracting code. See `AGENTS.md` for preservation and
restart requirements. `tmp_obs_debug/` contains local diagnostic artifacts, not
application source.

## Design Rule

Mini projects should stay thin. If two projects need the same behavior, put it in
`lib/`, `obs/`, `voice/`, or `tools/` and call it from project config/glue.

## Configuration

Personalized settings live in each supported module's folder. The old
`media_profiles` folder is not the active settings source. When migrating a
module, carry its profiles, phrases, layout rules, per-asset state and volume
offsets together.

The Hub saves changed JSON settings every two seconds to versioned history under
`%LOCALAPPDATA%/StreamingHub/settings-history/` (one directory per checkout).
OBS scene collection JSON files are also backed up there under `_obs_scenes`.
Missing module settings are recovered from the latest backup on startup.
Existing files are never automatically rolled back: valid UI changes and new
volume settings remain authoritative. Earlier versions are retained for recovery
after accidental replacement; backups are local, outside Git. Changes made and
undone between polls may not be captured, and OBS changes are backed up after OBS
writes its scene collection to disk.

Copy `.env.example` to `.env` and fill in machine-specific paths and secrets.
Do not commit `.env`.

Voice model settings are environment-driven. `WHISPER_MODEL` can be a model name
such as `large-v3` or a local folder outside the repo.

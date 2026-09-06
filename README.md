# Streaming Scripts v2

Local OBS automation hub for running small streaming mini projects together.

## Supported Modules

The Hub intentionally loads only these stream modules:

- `league`
- `soundboard`
- `tik_tok`
- `scene_voice_switcher`
- `love_me`
- Music (internal module key: `specific_song`)
- `instant_replay`

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

## Important Folders

- `mini projects/`: project-specific code and config.
- `lib/`: reusable framework code shared by projects.
- `obs/`: the only supported OBS API boundary.
- `voice/`: shared microphone and Whisper listener.
- `tools/`: diagnostics and one-off maintenance commands.

## Design Rule

Mini projects should stay thin. If two projects need the same behavior, put it in
`lib/`, `obs/`, `voice/`, or `tools/` and call it from project config/glue.

## Shared OBS Media Sources

Soundboard and TikTok intentionally reuse one OBS media source and hot-swap its
`local_file`; do not create one OBS source per asset. Filters are still per
asset: capture the outgoing file's complete filter chain before a swap and
apply the incoming file's saved chain afterward. An asset with no saved filter
state must load with no filters.

For responsive hotkeys, the bounded shared players keep their media loaded while
hidden; per-file players release it. Repeated playback of the same file should
restart without rewriting `local_file`. Playback watchers must check request IDs
so an older trigger cannot hide or save state for a newer asset on the same input.

## Instant Replay Library

Replay clips stay as individual files; game-end cleanup must not merge or
delete them. The library stores non-destructive playback ranges, user tags,
game/session labels, and Intro Montage membership in `REPLAY_DIR`. Thumbnail
and browser-preview caches also live there and are excluded from the clip list.
Only the explicit **Trim actual file** action rewrites a clip.

## Configuration

Copy `.env.example` to `.env` and fill in machine-specific paths and secrets.
Do not commit `.env`.

Voice model settings are environment-driven. `WHISPER_MODEL` can be a model name
such as `large-v3` or a local folder outside the repo.

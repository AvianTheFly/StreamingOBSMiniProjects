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

## Configuration

Copy `.env.example` to `.env` and fill in machine-specific paths and secrets.
Do not commit `.env`.

Voice model settings are environment-driven. `WHISPER_MODEL` can be a model name
such as `large-v3` or a local folder outside the repo.

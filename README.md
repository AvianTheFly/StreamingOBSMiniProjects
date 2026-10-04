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

- Customize your compact desktop chat: **Hub → Chat Overlay**.
  See [chat controls, emotes and desktop setup](docs/CHAT-OVERLAY.md).

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

The Instant Replay shortcut/voice **save** command and **Save Replay** button also
request a 60-second Twitch clip titled **Instant Replay**. Twitch Celebrations must
be connected with clip permission, and your Twitch channel must be live with clips
enabled. The Hub confirms publication and shows the clip link in Instant Replay;
you can rename it later in Twitch. Twitch captures its own stream window, so its
clip can differ from your locally marked/trimmed replay. Twitch failures do not
prevent the local OBS save. Saving a trimmed copy does not create another Twitch clip.

## Important Folders

- `mini projects/`: project-specific code and config.
- `lib/`: reusable framework code shared by projects.
- `obs/`: the only supported OBS API boundary.
- `voice/`: shared microphone and Whisper listener.
- `tools/`: diagnostics and one-off maintenance commands.

## Code entry points

Start with the layer that owns the change; these files are shared by the running Hub.
The [architecture map](docs/ARCHITECTURE.md) explains startup, module interaction,
audio ownership, browser/Twitch/League flows, concurrency and extension boundaries.

| Responsibility | Start here |
| --- | --- |
| Application startup and shutdown | `hub.py` (UI + modules), `main.py` (module runner) |
| Supported module discovery | `lib/project_registry.py` |
| Module config to editor field defaults | `lib/editor_config.py` |
| Browser UI and HTTP lifecycle | `hub_ui/app/`, `hub_ui/server.py` |
| Hub feature HTTP endpoints | `hub_ui/routes/` (controls, audio, profiles, projects) |
| Hub audio reconciliation | `hub_ui/audio.py` |
| Hub actions, typed workflows and browser updates | `hub_ui/commands.py`, `hotkeys.py`, `updates.py` |
| Hub settings and live status views | `hub_ui/settings.py`, `project_status.py` |
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

## Browser production effects

After opening the soundboard trigger window, Ctrl+6 plays the existing muffin song with animated border characters through
`Hub Soundboard Effects`. The Soundboard page has a **Test Muffin Dance** button.
The original audio level and recording/stream routing are preserved. See
[browser effect architecture](lib/browser_effects/README.md) for the modular renderer,
playback contract and instructions for adding effects.

Twitch Celebrations connects automatically with saved authorization. Its control
page reports raid/follow/sub/gift/cheer subscription health and the last live event.
An OBS-first startup now reloads the alert page once its local server is ready.

## Lobby worlds and screen privacy

The Scene Voice Switcher page selects Tavern, Future, Mountain Forge, Moonlit
Sanctuary, Sky Harbor, Storm Coast or Phoenix Observatory. **Random lobby** and the backtick voice command
**next lobby** choose another available location. Queue entries also vary the
location; an unchanged queue cannot reclaim a scene after you choose another.
Automatic requests respect temporary scene ownership, and stale post-game
returns never change lobby visibility. Named voice commands include **forge**,
**sanctuary**, **sky harbor**, **tavern**, **future**, and **game**.
Also say **storm coast**, **coast**, **phoenix observatory**, or **desert**.

League production's **Between games** setting chooses chatting lobbies or the
saved custom idle scene. This checkout uses chatting lobbies. A confirmed idle
phase, queue cancellation/dodge, or post-game return chooses another location,
after the cinematic result hold finishes. Queue/ready-check/bans retain one
location; completed bans enter the champion world, and game start enters Test.
Repeated client updates do not rotate locations or reclaim manual scene choices.
Pending returns wait for temporary playback and reject newer deliberate choices,
including those made during the result hold or a slow client read. Startup and
an unavailable client preserve the current program scene. Without League client
automation, game-disconnected events provide the held lobby return instead.

Type **asterisk then minus** (`*-`) within 0.8 seconds to show your desktop;
type **minus then asterisk** (`-*`) to hide it. These are ordered sequences.
They change the real Display Capture item inside **Hub Display Capture**.
Parent scenes retain visible nested scene items, and **Test** retains its direct
gameplay capture. Automatic queue and chatting-lobby entries hide the shared
desktop; showing it explicitly afterward stays effective until another entry or
hide command. League's Show screen button also reveals the desktop inside the
current lobby when chatting-lobby mode is selected.
The old Tavern 3D filter is preserved on **Hub Desktop Panel**. Replay's optional
desktop viewport shares the same gate and is parked outside the canvas when unused.
The unused legacy `youtube` window-capture item inside SpecificSongs is hidden
to prevent unrelated browser windows bypassing screen-hide; its settings remain.

New art is in `mini projects/scene_voice_switcher/art/`: each `*-base.png` has
a matching `*-foreground-cutout.png` with identical RGB pixels and transparent
background. OBS layers are background, nested desktop, **FaceCamWithProps**,
foreground, then live **Hub Lobby Chat**. Camera filtering stays in your existing
camera scene. Lobby chat uses your channel/settings, with larger OBS-only text;
desktop chat settings are preserved. These are static scenes with the live
camera/chat/desktop layers. Existing Tavern/Future artwork and placements remain.
Adding locations retains already installed transforms, item order and visibility.
The additional generation prompts are saved in `output/lobbies/expanded-generation-prompts.json`.

Visual research: Peanut's [workshop](https://www.twitch.tv/theburntpeanut/clip/ToughPlacidAubergineTBTacoLeft-7UaFjTcpVDrtp3w5),
[hideout](https://www.twitch.tv/theburntpeanut_247/clip/AmericanLaconicCourgetteHotPokket-NbGw1lEY1CRjsfX6),
and [beach bar](https://streamscharts.com/channels/theburntpeanut/streams/322114724348)
suggested the host-in-a-place composition. The new locations use this channel's
fantasy materials and four-spirit imagery.

`tools/install_lobby_scenes.py` installs native scenes with OBS open. The separate
`tools/migrate_lobby_groups.py <active-collection.json>` only runs with OBS closed;
WebSocket cannot add group members. Both snapshot settings first. Original raw
inputs are retained, and history outside the repository provides recovery copies.
Do not restore old module volumes when recovering only an OBS collection.

# Preserve the personalized streaming setup

- Recording and Instant Replay storage was changed on 2026-09-29 to
  `C:\StreamingMedia\Replays`. Keep OBS's recording directory and the root
  `.env` `REPLAY_DIR=C:/StreamingMedia/Replays` synchronized. See
  `RECORDING-STORAGE.md` before changing replay paths or restoring settings.

- The supported application is this checkout's `Run Hub.bat` / `hub.py`. Do not
  launch archived copies, the legacy `media_profiles` module, or v3 as substitutes.
- Soundboard's only desired profile is `default` in
  `mini projects/soundboard/hotkeys_editor.json`. It includes `@ -> hooray`.
- Profile data, phrases, volume offsets, per-asset OBS filters, transforms and
  layout rules are user data. Preserve them during coding, branch changes and
  module migrations. A module migration must carry all of these files, not just
  hotkeys. Never replace them with example/default files to fix an import issue.
- Snapshot settings with `lib.settings_backups.SettingsBackups().snapshot()`
  before changing settings or switching branches. History is outside this repo
  under LOCALAPPDATA/StreamingHub/settings-history; never delete it during cleanup.
- Honor the most recently set volume. Do not restore an older snapshot's master
  volume merely because other settings from that snapshot are needed.
- A shared-source OBS fader edit belongs to the actual loaded asset, not every
  asset in the module. Preserve asset-specific levels across file swaps. Only an
  explicit project/master UI adjustment should change the whole module.
- Per-asset placement takes precedence over generic dimension layout rules.
- After code changes requiring a restart, restart the correct Hub for the user.
  Identify its process and keyboard child, avoid duplicate listeners, use a hidden
  window for background launches, and verify the UI and modules become ready.

# Maintain the modular architecture

Read `ARCHITECTURE.md` and `CONTRIBUTING.md` before extending runtime behavior.
These rules apply to fixes as well as new features:

- Identify the owner of the state or resource before editing. Extend that owner
  or its public contract. Keep feature policy in its feature package and reusable
  mechanics in `lib/`. Keep entry points as assembly and lifecycle code.
- Give each file a coherent responsibility. Split policy, persistence, transport,
  presentation, and worker lifetime when they change for different reasons.
  Prefer small explicit components over adding branches to a growing `main.py`.
- Feature packages must not import another feature's implementation or `_live`
  dictionary. Use project interfaces, scoped events, or shared contracts such as
  `game_scene_policy` and `clip_sessions`. HTTP adapters call public feature APIs;
  they do not own playback, capture, or private feature state.
- `SceneDirector` is the only owner of OBS program-scene writes. Automatic
  features call `scene_director.request` with an owner and reason. Temporary
  presentations use `SceneSession`; never remember a scene and restore it later
  without checking ownership. Delayed work must reject stale intent.
- Shared project pause/resume goes through the coordinator. Complete the actual
  `PlaybackTicket`, never a project name. Use scoped pause claims for handoffs;
  never call bulk pause/resume. Admission callbacks schedule work and return
  promptly. Do not wait on the coordinator while holding a player/source lock.
- Each physical source has one playback worker through final cleanup. A replaced
  request is cancelled; its cleanup completes before source reuse. Layered work
  still respects its module's shared permission gate. Do not create competing
  source controllers or unbounded threads for repeated triggers.
- Use the existing owners for microphone access, keyboard hooks, decoder startup,
  conversion budgets, OBS connections, and browser channels. New global resources
  need an explicit Hub-owned lifecycle, stop signal, and bounded cleanup.
- Imports define code; they must not start threads, bind sockets, connect to OBS,
  write settings, or install hooks. Register runtime providers during startup and
  unregister them during shutdown, including partial startup failures.
- Publish complete snapshots of asset/profile maps. Use `json_transaction` or
  `update_json` for an entire read/modify/write and `write_json` for atomic writes.
  Preserve unknown fields and malformed personal data; do not silently reset it.
- Before handing off code, run `py -3.11 tools/check_architecture.py` and relevant
  tests with `py -3.11 -X utf8 tools/run_offline_tests.py`. Run the full offline
  suite for changes to shared infrastructure. Do not weaken a boundary check to
  hide a violation; introduce a justified public contract instead.
- Update the responsibility map and relevant regression tests when ownership
  changes. Keep compatibility facades thin. Architecture-check exceptions must
  name a concrete composition or standalone maintenance owner and explain why.

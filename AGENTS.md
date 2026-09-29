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

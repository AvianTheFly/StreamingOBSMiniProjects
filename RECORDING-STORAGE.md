# Recording and Instant Replay storage

Updated 2026-09-29 at the user's request because F: was nearly full.

Current output folder: `C:\StreamingMedia\Replays`.

- OBS active profile: `Untitled`, Simple output mode.
- OBS `SimpleOutput/FilePath`, `AdvOut/RecFilePath`, and `AdvOut/FFFilePath`
  point to this folder. The recording directory was changed through the running
  OBS WebSocket API so OBS retains it in the active profile.
- Supported Hub: `F:\EVERYTHING STREAM RELATED\Streaming Scripts v2\hub.py`.
- Root `.env`: `REPLAY_DIR=C:/StreamingMedia/Replays`.
- Instant Replay derives `clips` and `edited` folders from `REPLAY_DIR`.
  Trims and new recording/replay-buffer saves use the new folder.

## Existing media and settings

313 files were copied from `F:\EVERYTHING STREAM RELATED\Assets\Replays`
to the new location and verified by relative filename and size. The old
`Full Streams` directory (about 100 GB) was excluded and remains on F:.
Original files were retained on F:; this change does not reclaim their space.
Do not delete the old recordings unless the user requests it.

The Instant Replay `replay_library.json` paths and path-derived clip IDs were
migrated. Tags, saved timestamps, game associations and groups were preserved.
`asset_volumes.json` path keys were migrated with their existing volume values.
The copied root library's paths were also updated.

Settings were snapshotted with `SettingsBackups().snapshot()`. Additional
pre-change copies of `.env`, OBS `basic.ini`, and Instant Replay JSON settings
are under `%LOCALAPPDATA%\StreamingHub\recording-location-backup-2026-09-29`.
These backups include credentials; do not publish them or print their contents.

## Verification and future changes

OBS's live recording directory and Simple profile path both returned the new
folder. A replay-buffer test wrote a nonempty MP4 there, and the restarted Hub
reported Instant Replay ready and listed the new file. The replay buffer resumed
and the live stream stayed running throughout. The Hub was restarted with its
existing `hub.py --no-browser` arguments without duplicate keyboard listeners.

For future changes, snapshot settings, preserve media and per-asset volumes,
update OBS and `.env` together, migrate library paths and path-derived IDs, and
restart the supported Hub to load the new environment. Do not restore the old
F: path accidentally during unrelated settings recovery. OBS records and replay
buffer saves share the recording directory; keep both aligned with the Hub.

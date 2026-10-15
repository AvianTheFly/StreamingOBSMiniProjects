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

## One-minute review captures (2026-10-10)

Press `|`, then say `mark` to save the last 60 seconds for later review.
OBS SimpleOutput and AdvOut `RecRBTime` are 75 seconds: a useful minute plus
15 seconds for voice transcription and the save request. The running Replay
Buffer output was verified with `max_time_sec=75`; its 1500 MB limit is unchanged.
Kill and death highlights retain 30 seconds of lead-in. Kills separated by at
most 30 seconds share the first-kill anchor. Replay-only quick captures retain
their existing selectable duration. Storage remains `C:\StreamingMedia\Replays`.
A pre-change profile copy is in `C:\StreamingMedia\HubReviewArtifacts\replay-minute-20261010`;
it may include private settings and must not be published.

## Automatic League recordings (updated 2026-10-14)

Champion select starts recording; gameplay verifies OBS every two seconds.
Confirmed end stops it after 60 seconds; a new draft closes the old file first.
Live gameplay overrides stale idle client phases. Transport loss alone never
stops a recording. OBS and REPLAY_DIR remain C:/StreamingMedia/Replays.

- *K* or *k*: keep the current owned game or the latest completed game permanently.
- *D* or *d*: delete the latest completed game, or queue the active game for
  deletion after OBS closes it. Keep cancels a queued active-game delete.
- / then *: mark a moment in the active owned game. Type the whole sequence
  within 0.8 seconds. Existing *- and -* screen shortcuts remain unchanged.
- Instant Replay saves add original-button-time markers and attach the finished
  clip path, including when encoding finishes after the game has closed.

Completed files move to Unreviewed Games and expire after three days unless kept.
Keep moves them to Kept Games; kept files never expire. Cleanup runs once a
minute while the Hub is running and OBS recording is stopped. Missed deadlines
run on the next eligible Hub poll. Existing journaled pending files without an
expiry get a fresh three-day grace period. Other videos, old F: recordings and
separate replay clips are never swept. Delete checks allowed folders and exact
size/mtime, saves intent before unlink, and recovers interrupted removal. Moves
wait for closed, stable files and preserve both filenames on collision.

Open League production → Game recordings & markers in the Hub, or
http://127.0.0.1:7431/recordings. Select a game and click a marker to seek. Older
managed games have individual Keep/Delete controls. Deleted games retain metadata.
The atomic match_recordings.json stores decisions, expiry, markers, clock anchors
and audio labels, preserving unknown fields. Existing manual recordings remain
manual. An active recording survives Hub shutdown and stays manual after restart;
a journaled file already being finalized resumes finalization on startup.

### Audio

OBS Simple recording uses tracks 2 and 3 (RecTracks=6): one video stream and two
synchronized audio streams, with no duplicate video or separate sidecar to lose.
The first audio stream is clean game/microphone audio; the second is the full
mix with music. The browser previews clean audio. Select the second stream in
a video editor or a player with audio-track selection. Both share a time origin.

Desktop Audio, Chrome capture, ss__player and Hub Love_Me Effects are excluded
from track 2. Spotify/Chrome playback reaches the full mix through Desktop Audio;
application-specific League and Discord captures supply clean audio. Track 3
mirrors the existing live-mix routing. Volumes, filters and placements survive.
Preflight blocks changed output tracks or known music sources on track 2.
Music physically picked up by the microphone cannot be removed by app routing.
The replay buffer also retains both tracks, with clean audio first.

Diagnostic recordings and replays verified one video/two synchronized audio
streams and isolated test tones. Diagnostic footage is outside personal inventory
under C:/StreamingMedia/HubReviewArtifacts/game-recording-20261014 and
output/game-recording-update. OBS profile backups remain outside the checkout
under LOCALAPPDATA/StreamingHub/recording-audio-backup-20261014.

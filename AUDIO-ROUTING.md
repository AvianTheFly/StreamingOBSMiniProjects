# Stream and recording audio

Configured September 16, 2026 for OBS profile `Untitled`, collection `live_duplicate`.
Verified and extended to Twitch VODs/clips October 2, 2026.

- Stream uses track 1: Desktop Audio plus microphone and existing direct OBS audio.
- Twitch VOD audio uses the same clean track 2 as local recordings. In Simple
  output mode, keep both `SimpleOutput.UseAdvanced=true` and
  `SimpleOutput.VodTrackEnabled=true`; both are required for the Twitch VOD feed.
  Twitch clips use that saved audio feed as well. Sources are already separated
  through OBS application capture and monitoring; no virtual audio driver is needed.
- Local recordings and Replay Buffer save **only track 2** (`SimpleOutput.RecTracks=2`). Keep recording quality at High Quality/Small (`RecQuality=Small`); Same as Stream would bypass this separation.
- Desktop Audio is assigned only to track 1, so Chrome and Spotify remain audible in headphones and on stream but are absent from recordings.
- `Recording Audio - No Music` contains audio-only application captures for League game, League client, and Discord. It is nested across existing scenes. These sources use track 2 only and do not monitor back to headphones.
- Microphone uses tracks 1 and 2.
- Specific Songs uses Monitor Only and track 1. Its monitored audio reaches the stream through Desktop Audio; it has no path to track 2.
- Soundboard, TikTok, and League effect players use Monitor and Output with track 2. Monitoring feeds headphones/Desktop Audio for the stream; direct output feeds recordings. Soundboard musical stingers and music inside wanted media clips are intentionally retained with those clips.
- Other apps are heard on stream through Desktop Audio but need their own application capture if they should also be recorded. Do not add Desktop Audio to track 2.

Module routing is saved in each module's `editor_config_overrides.json`; saved shared-source audio routing agrees with it. Existing hotkeys, volumes, transforms, and filters were preserved. The Soundboard still has only `default`, including `@ -> hooray`.

Validation: a five-second two-track recording included both the music-path 440 Hz tone and effect-path 880 Hz tone on track 1. Track 2 retained 880 Hz and rejected 440 Hz (below -160 dB in the spectral check). After reinitializing OBS's encoders, a fresh replay saved with one audio stream. Replay Buffer is enabled and running. Existing input volume multipliers matched the pre-change backup. Live League gameplay was not running during validation, so game capture was configured by its saved executable/window identity rather than tested in a match.

Backups and verification clips: `%LOCALAPPDATA%/StreamingHub/settings-history/2eb8bc17aa91/_audio_routing/20260916-213508`. Settings history also contains the pre-change module settings and OBS scene collection. Restore selectively; do not overwrite newer volume choices with old backup values.

October 2 verification: OBS 32.1.1 was offline from Twitch with Replay Buffer
running. Its recording selection was already track 2, but its Twitch VOD feed
was disabled. Enabled only the two Simple output VOD switches through the live
OBS API after taking a settings snapshot and preserving the active profile in
`%LOCALAPPDATA%/StreamingHub/audio-routing-backup-2026-10-02`.
A fresh recording retained an 880 Hz effect tone while rejecting the 440 Hz
monitored music tone by over 120 dB. Desktop Audio meters confirmed the monitored
music reached the live mix. Existing input levels, routing, monitoring and the
program scene were checked unchanged, and temporary verification sources were
removed. Machine-readable recording/replay checks are in
`output/audio-routing-20261002/`. The Twitch switches were read back from the
running OBS profile and saved `basic.ini`. Twitch delivery remains a live-stream
check; no broadcast was started for this maintenance.

Reference: [OBS Twitch VOD Track Guide](https://obsproject.com/kb/twitch-vod-track-guide)
and [Elgato's VOD/clip audio guide](https://www.elgato.com/us/en/explorer/products/stream-deck/how-to-set-up-a-twitch-vod-track-in-obs/).

October 3: Mood cues adds `Hub Love_Me Effects` inside the existing LoveMe scene.
New variations use Monitor Only / track 1, reaching the live mix through Desktop
Audio and staying out of clean track 2. A per-variation retain control uses
Monitor and Output / track 2 for cleared stingers. Original sources retain their
routing. The latest project/profile master plus variation offset sets its level;
a browser fader edit belongs only to the last-loaded variation. See the module's
`README.md` for cue alignment and controls.

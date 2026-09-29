# Stream and recording audio

Configured September 16, 2026 for OBS profile `Untitled`, collection `live_duplicate`.

- Stream uses track 1: Desktop Audio plus microphone and existing direct OBS audio.
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

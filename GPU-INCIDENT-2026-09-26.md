# September 26 live-stream GPU incident

Local time: America/New_York. Saved diagnostics strongly correlate this incident
with the Hub's CUDA Whisper transcription, not the League API 404 messages.

- 04:16:16: GPU 55%, 10,643 MiB used of 11,264 MiB; voice idle;
  OBS 60 FPS, 2.1 ms average rendering time.
- 04:16:21: voice transcription busy; GPU 100%; OBS 13.8 FPS,
  70.2 ms rendering time.
- 04:16:32: GPU 99%; voice still busy; OBS 6.7 FPS, 149 ms rendering.
- Through 04:17:54: repeated 99–100% GPU samples with voice busy and
  severe OBS rendering stalls. OBS also logged growing audio buffering.
- 04:18:06: voice idle, OBS disconnected after the user's shutdown;
  GPU 28%. Restarting OBS subsequently restored 60 FPS.

The pasted Hub log reports a two-second specific-song voice command before the
stall and its transcription completing after OBS disconnected. This is strong
evidence of GPU contention during voice inference. It does not prove the
underlying reason inference took so long or exclude driver/OBS contributions.
The diagnostics busy flag includes the transcript callback as well as inference.

## Applied mitigation

Preserved `large-v3`; set this checkout's `.env` to `WHISPER_DEVICE=cpu` and
`WHISPER_COMPUTE=int8`. Added `WHISPER_CPU_THREADS` (default two) to hub_config
and passed it to WhisperModel to bound CPU use. Voice latency and numerical
precision can differ. No microphone audio or recognition benchmark was run
against the live broadcast.

Snapshotted settings with SettingsBackups before changes. Restarted only this
checkout's Hub, replacing PID 8508 and its keyboard child 17352 with Hub 23812
and child 11020. OBS streaming remained active with an increasing stream
duration; no OBS stop, restart, encoder, scene-collection or volume change was
issued by this investigation.

Verification: seven offline GPU/voice safety tests pass; edited Python files
compile. All ten modules, CPU Whisper and microphone report ready. Hub,
editor and League overlay HTTP endpoints return 200. OBS reports 60 FPS and
2.07 ms rendering after restart. GPU memory measured 5,766 MiB, but the scene
and game state changed, so this is not an isolated memory benchmark. All
personalized JSON files in the before/after settings manifest are unchanged.

## Remaining separate issue

Replay SceneSession reads `ProjectStatus.is_paused`, which the actual status
type does not define. The pasted log confirms this prevents its pause calls.
This incident mitigation does not alter replay coordination during the stream.
It needs a separate fix that represents actual paused state, with real status
objects in the tests, rather than guessing that inactive means paused.

Original diagnostics, pre-restart OBS log, pre-change environment backup and
personalized-settings hash manifest are preserved outside the repository at
`C:/Users/Michael/AppData/Local/StreamingHub/diagnostics/incident-20260926-0416/`.
The environment backup may contain credentials; keep it local. Rolling
performance logging remains enabled for any recurrence.

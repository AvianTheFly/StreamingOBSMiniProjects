# Code cleanup audit

Updated 2026-09-30. The main-workflow cleanup pass is complete. The user clarified
that the priority is clear responsibilities and shared infrastructure. This pass
covered startup/shutdown, voice, media playback, profiles, songs, replay and shared
service ownership. Exhaustive exploration of unusual branches is outside its scope.
See `ARCHITECTURE.md` for the responsibility map.

## Required behavior

- Run the supported `hub.py` checkout with one keyboard child.
- Preserve personal profiles, phrases, volumes, OBS filters and placement.
- Keep Soundboard's `default` profile and `@ -> hooray` binding.
- Keep OBS output paths and `REPLAY_DIR` at `C:\StreamingMedia\Replays`.
- Snapshot settings before settings changes and retain external backup history.
- Preserve immediate hotkey response, command cancellation and live settings edits.

## Verified repairs

| Area | Repair | Evidence |
| --- | --- | --- |
| Settings persistence | Shared atomic JSON writer with separate temporary files and bounded Windows lock retries | Failed-write and simultaneous-writer tests; profile preservation tests |
| Volume ownership | Shared transactions for editor, profile and fader writes; finite-number validation | Audio settings and cleanup tests |
| Hotkeys | Reload settings on file changes; separate queues per worker; EOF ends dispatch; partial startup stops its child | Hotkey reload, stale-queue, EOF and failed-start tests |
| Voice | Tag audio by recording session; retain queued audio on send; cancellation skips inference; listener/model reuse | Voice lifecycle and GPU audit tests |
| Layout metadata | Editor and playback share bounded probes and transform functions; preserve zero scale; reject nonfinite values | Media loading cost tests |
| Playback workers | Release pending state if a worker thread cannot start | Playback ownership and cleanup tests |
| HTTP startup | Release ports after failed browser server or viewer service construction | Cleanup tests |
| Hub rules and requests | Validate before replacing rules; expose failed saves; reject malformed request bodies | Persistence and Hub architecture tests |
| Idle work | Skip unchanged backup files and unwatched UI status; coalesce League snapshots; avoid repeated OBS settings writes | Backup, architecture, League and viewer reward tests |
| Module lifecycle | Serialize Love Me replacements; keep separate cancellation signals for random sessions; wait for actual song completion; attempt every shutdown action | 11 module lifecycle tests, including blocked old playback and asynchronous song startup |
| Replay shutdown | Cancel the delayed game-end merge and reject late voice/hotkey commands after shutdown | Shutdown event gates in Instant Replay's actual entry points |
| Duplicate Hub processes | Hold an OS lock for the supported checkout before starting any modules | Three single-instance tests; live duplicate launch rejected without a second listener |
| Service failure cleanup | Release browser and viewer reward servers after partial thread startup; cancel viewer workers without stopping the Hub; close monitor log on failed startup | Failure injection at all five viewer thread starts, failed browser shutdown watcher, failed monitor start |
| Performance diagnostics | Omit voice transcript history, consumer lists and free-form errors from rolling performance samples; retain Voice UI history | Collector privacy regression and Voice service summary/UI tests |
| Shared media ownership | One replaceable worker per OBS source; preserve layering on different sources; save the old asset before the next file loads; cancel media waits and late requests | Actual shared playback entry-point tests with blocked cleanup, layered sources, delayed coordination, failed file swaps and placement overrides |
| Project readiness | Wake startup on module readiness or exit; stop waiting during shutdown | Early module exit, readiness and shutdown interruption tests |
| Shared asset execution | Extract `AssetPlayback` from duplicated exclusive/layered paths; one owner applies asset state, layout, audio, startup, completion, override capture and parking | Existing shared playback workflow and placement tests exercise the extracted component |
| Application lifetime | Supported runner releases modules, UI, diagnostics, browser timer and keyboard worker in one shutdown path; project startup tracks partial ownership | Supported Hub startup/shutdown contract test and existing startup checks |
| Trigger window | Replace separate timer/flag/locking implementations in Soundboard, Specific Song and generic media with `ManualTriggerWindow`; preserve module-specific manual keys and voice send behavior | Shared manual-winner, expiry and close workflow tests; existing module and voice suites |
| Live profiles | Extract duplicated profile selection, file stamps and binding construction into `RuntimeProfiles`; detect changes to either settings file; refresh action bindings on profile activation | Profile-selection/volume workflow, unchanged-file and live-file-edit checks; Soundboard trigger integration test |
| Replay boundaries | Move command/tag parsing to `commands.py` and bounded FFmpeg trimming to `trimming.py`; keep runner imports compatible | Existing replay command, library/group-name and real multi-audio-track cutoff tests |
| Asset levels | Share project/profile/category/file level composition in `asset_volume_db` | Two assets retain different offsets and read the latest project level |
| Song boundaries | Separate command/category parsing and song-library loading from the runtime; voice reload also refreshes manual bindings; missing-phrase bootstrap snapshots settings and uses atomic writes | Personalized alias merge preserves file bytes; live editor category/manual binding tests; actual song lifecycle tests |
| Scene ownership | Separate temporary scene handoffs from coordination-rule management without changing the coordinator API | Existing replay scene ownership and delayed-handoff tests |

Latest tools suite: **290 tests passed**. The preceding League API suite passed
**84 tests**. Both used the application's Python 3.11 interpreter. These are regression checks, not proof that every runtime path has
been examined or that sustained hardware load is resolved.

## Latest runtime verification

- Removed two confirmed Hub processes running from this checkout and their keyboard children.
- Latest hidden restart: Hub PID 23052 and keyboard child PID 28116, both from this checkout. Runtime log: `hub-cleanup-final-structure-20260930*`.
- All 10 supported modules reported ready; Hub, editor, League overlay and viewer rewards returned HTTP 200.
- A second `hub.py --no-browser` launch exited before initialization. All four service ports belonged to the single Hub.
- Voice reported ready on CPU with int8; the microphone opened successfully.
- OBS scene remained `just screen`. Streaming remained stopped and the replay buffer remained active during this restart.
- All three OBS recording paths still matched `C:\StreamingMedia\Replays`; root environment path matched.
- Soundboard still contained only `default` with `@ -> hooray`. Settings were snapshotted before restart.
- New Hub performance samples contained only voice runtime fields; the live `/api/voice` response still included UI history.
- Full-suite and runtime logs are under `%LOCALAPPDATA%\StreamingHub\diagnostics`; latest logs are `cleanup-final-structure-tests.log` and `hub-cleanup-final-structure-20260930*`. Earlier logs remain available.
- Python compilation and `git diff --check` passed.

## Scope and follow-up

- The primary workflows now have documented owners and shared playback, profile,
  trigger, persistence and lifecycle infrastructure. Their regression suites pass.
- Coordinator rules retain their existing pause/resume semantics; temporary scene
  ownership is a separate component. Changing coordination policy would be a
  behavior change and was not needed for this structural pass.
- Recent read-only samples showed GPU utilization between 42% and 62% and Hub
  resident memory between roughly 2.0 and 2.5 GB. These samples include normal
  workload variation and do not establish a leak or prove overload is resolved.
- No broad RAM preload or XMP change was made. Hardware overload needs a separate
  measured workload comparison; structural cleanup is not a performance guarantee.

Disabled folders and historical assets require evidence of disuse before removal;
some contain private configuration or user-created media. External settings
history remains protected.

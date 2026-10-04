# Media resource work

Updated 2026-09-30. This goal remains active: reduce asset-loading spikes and
verify improvements under the actual streaming workload. A passing offline
suite or an idle OBS sample does not prove that the reported crashes are fixed.

## Requirements and current evidence

| Requirement | Evidence / state |
| --- | --- |
| Identify CPU, rendering, encoding and decoding costs separately | OBS 32.1.1; 1920x1080 at 60 fps; Simple output uses NVENC for stream and recording; replay buffer active, stream stopped. New diagnostics record encoder and decoder utilization separately, process/system CPU, and media-load markers. |
| Measure new-asset startup | `tools/profile_media_startup.py` compares hardware/software decoding using temporary hidden, muted inputs. Four measured starts completed; temporary inputs were removed; scene/output state unchanged. Visible composition and simultaneous gaming remain unmeasured. |
| Improve preparation and use RAM appropriately | Shared 512-entry metadata cache replaces separate layout/decoder probes. One paced preparation worker warms compressed-file beginnings through Windows' file cache; at most 8 MB per asset. Adaptive total budget is the minimum of 2 GiB, total RAM / 32 and available RAM / 16. Running Hub completed 1020.8 MiB of reads, probed 176 assets and reported no failures, with a 2045.3 MiB budget. Windows controls retention. |
| Keep live requests ahead of background work | Preparation shares the media startup gate, checks for waiting foreground requests, and releases the gate between small reads. A probe already running can take up to its three-second timeout. |
| Preserve behavior and personal data | Existing playback backends, source names, levels, filters and transforms remain in use. Soundboard `default` and `@ -> hooray` verified after restart. Record directory remains `C:\StreamingMedia\Replays`. |
| Verify live adoption | Current deployment is Hub PID 26920, launched hidden from this checkout after voice/League diagnostics updates. Prior PID 1616 and its keyboard worker exited through Ctrl+C. OBS PID 8636 remains on Untitled/live_duplicate, just screen, replay active and stream/record off. Readiness checks are recorded below. |
| Resolve the crashes and prove better resource behavior | **Incomplete.** Need correlated measurements during the affected workflow, comparative tests, and sustained verification. |

## Measured findings

- Before these changes, 600 five-second samples over roughly 51 minutes showed
  GPU utilization 22–42% (median 36%), OBS average render time 0.86–1.45 ms,
  and OBS CPU usage 1.06–6.97%. Short spikes can fall between those samples.
- A current sample with only the replay buffer encoding showed encoder utilization
  around 39% and decoder utilization 0%. Encoder load alone is not evidence that
  an asset's decoder caused the reported failure.
- Hidden three-second tests of `im cooked.mp4` and `I'm an albatroz.mp4` showed
  no new render-skipped frames. First observed playback progress was 0.17–0.20 s.
  Hardware decoding added about 206–250 MB of GPU memory. Software avoided that
  allocation, but the song's peak OBS process CPU was higher (260% versus 200%).
  psutil process CPU percentages use one logical CPU as 100%; this machine has
  16 logical CPUs. Test order and unrelated workload limit comparisons.
- No output resolution, bitrate, replay duration, recording location, XMP,
  or encoder settings have been changed in this pass.

## Ownership

- `lib/media_metadata.py`: bounded immutable metadata, file-edit invalidation,
  serialized cache misses for layout/editor/decoder policy.
- `lib/asset_preparation.py`: bounded registration queue and one worker; small,
  paced compressed-file reads and shared metadata preparation. The Hub owns its
  start and shutdown. `HUB_ASSET_PREPARE=0` disables optional preparation.
- `lib/shared_media/media_startup.py`: foreground decoder startup gate and
  background slots. Playback sources keep existing worker ownership and cleanup.
- `lib/performance_monitor.py`: separate OBS connection; five-second idle
  samples and half-second bursts around media starts. Bounded rotating logs;
  no transcript text or credentials.
- `lib/media_jobs.py`: shared weighted admission for finite FFmpeg conversions.
  Capacity is three weight units; cuts request two, audio extraction and previews
  one each. User jobs precede queued previews. This is admission control and
  bounded FFmpeg thread configuration, not a hard system CPU percentage limit.
  Cancellation terminates and reaps a running child and releases queued work.

## Voice latency and GPU work

- The actual Hub upload endpoint took 14.157 seconds to recognize a generated
  2.184-second "Save thirty seconds" WAV on large-v3 CPU/int8 with two threads.
  The shared owner returned to idle afterwards; no replay or music action was
  dispatched by the editor upload. This supports slow inference as a cause of
  prolonged voice ownership, without proving every reported delay has that cause.
- Three generated test commands, using cached models and single-worker inference:

  | Backend | Inference time per command | Observed additional total VRAM | Recognition |
  | --- | --- | --- | --- |
  | large-v3 CPU/int8, two threads | 14.2–14.9 s | none from CUDA | All three correct |
  | base.en CPU/int8, two threads | 0.81–0.89 s | none from CUDA | Misheard "I'm an albatross" |
  | base.en CUDA/int8_float16 | 0.13–0.56 s | about 313 MiB | Same mishearing |
  | large-v3 CUDA/int8_float16 | 0.70–0.77 s | about 2360 MiB | All three correct |
  | small.en CUDA/int8_float16 | 0.23–0.45 s | about 568 MiB | All three correct |

- Saved small.en/CUDA/int8_float16 after a settings snapshot. The English model
  is cached locally; microphone, phrases and playback settings are preserved.
  This reduces model work and VRAM relative to large-v3; it is not a GPU percentage
  cap. The three synthetic phrases are a limited accuracy check and were not
  measured during gaming. The first command also includes lazy initialization.
- Fixed a real startup bug: the Settings page saved Whisper/microphone values
  to hub_settings.json, but hub_config.py never read them. Saved settings now
  override the environment on the next start as the UI promises. Missing values
  retain environment/default behavior, and partial settings retain UI defaults.
- GPU comparison samples are total hardware counters at 100 ms polling intervals;
  NVIDIA's underlying utilization window can be longer. Sampled total peaks were
  31%, 67%, and 53% for base.en, large-v3, and small.en respectively, with OBS and
  other applications running. They do not establish instantaneous peaks,
  per-process attribution or the effect on game frame times.
- NVIDIA MPS execution partitioning is supported on Linux/QNX, not this Windows
  machine. Sleeping before/after transcription would not limit a running encoder
  kernel. See [NVIDIA MPS limitations](https://docs.nvidia.com/deploy/mps/when-to-use-mps.html).
- tools/profile_voice_inference.py accepts explicit audio and cached models,
  uses one worker, records transcripts/timings, and cleans up its GPU sampler.
  It does not record microphone audio or dispatch commands. Comparison JSON files
  are under LOCALAPPDATA/StreamingHub/diagnostics (20260930-190927 CPU,
  -192726 base GPU, -192801 large GPU, -192925 small GPU).
- Forty-seven targeted settings, voice ownership/lifecycle, Hub architecture and
  preparation tests passed. Twenty-six targeted preparation/startup/media tests
  passed before the voice settings change. Fresh config import confirms the saved
  GPU model selection. The restarted Hub has now loaded it; three uploads through
  the actual editor transcription endpoint took 0.31–0.53 seconds. Uploads did
  not record microphone audio or dispatch playback/replay commands. All three
  completed without errors and released voice ownership. The song name was
  transcribed as "I'm an albatross."; matching still needs natural-voice checks.

## Adaptive preparation

- This 64 GiB machine had about 42.8 GiB available during inspection, allowing
  a 2 GiB compressed-file read budget instead of 512 MiB. The inspected soundboard,
  music and sound effect file heads together exceed 512 MiB. Registration remains
  bounded and uses one paced worker, with foreground startup taking precedence.
- The budget is bytes read through Windows' cache, not pinned memory or a promise
  that all assets stay resident. It avoids keeping decoded videos or whole-song
  PCM in RAM. Low-memory hosts use a smaller budget; explicit budgets still work.
- Corrected audio UI help: moving the shared Music fader in OBS changes the
  loaded song's level, preserving asset-specific volume behavior.

## Conversion repairs

- Replay cuts, UI previews and browser audio extraction now use the same budget
  instead of independent unrestricted process launches.
- Browser audio extraction has bounded decoder/filter/encoder threads and
  receives the playback cancellation callback. Cache publication uses a unique
  temporary file and serialized cache rechecks, preventing duplicate conversions
  of the same asset and competing writers. Original media remains untouched.
- Replay cuts also bound filter threads; quality, cutoff semantics, original-file
  retention and all audio tracks remain covered by the existing real-media test.
- Finite jobs inherit the Hub stop event. Previews are lower priority than live
  requests, and diagnostics expose queued/running job weights and process IDs.
- Conversion start/finish markers request faster diagnostic sampling too; browser
  audio extraction does not need a native media-source startup to be observed.
- Real subprocess tests verify running-child termination, queued-job cancellation,
  budget release and user-job priority. Real audio extraction verifies cache
  reuse, PCM output and byte-for-byte preservation of the source.

## Live conversion verification

- The supported Hub converted an uncached existing replay preview through its
  actual HTTP endpoint in approximately 1.03 seconds. The completed preview
  returned HTTP 206 with the requested byte range. Original recording SHA-256
  remained unchanged.
- Performance logs captured a `replay-preview` job using one weight unit and its
  actual FFmpeg PID. The budget returned to zero used/queued units afterwards.
- After the user intentionally closed and reopened OBS, diagnostics initially
  selected an older exiting process. Process selection now follows the listener
  on OBS's configured control port; live samples correctly select PID 26392.
  A regression test verifies this reopened-instance behavior.
- Latest verification: one Hub and keyboard child, ten ready modules, four HTTP
  services returning 200, voice ready on CPU/int8, soundboard profile/binding
  intact, and all recording paths matching the root environment. Current OBS
  scene was `Test`, streaming/recording stopped, replay buffer active. The user
  changed OBS state during this pass; the preview test did not change scenes or
  outputs.
- Browser audio extraction now also has a decoder/filter/encoder thread limit
  of one. FFmpeg treats these as separate pipeline controls; the shared weight
  budget is not a guarantee that every process contains only that many threads.
  See [FFmpeg threading options](https://ffmpeg.org/ffmpeg.html).

## Next work

### Browser initialization and cleanup findings

- The reopened OBS instance's log reported `CEF failed to initialize. Exit
  code: 21`. Chromium 127 assigns that code to a profile already in use. An old
  OBS process from the user's intentional close remained with one thread, no
  listening control port and twelve browser children using that profile. This
  strongly suggests a profile lock, rather than a harness visibility problem.
  See [Chromium result codes](https://github.com/chromium/chromium/blob/127.0.6533.120/chrome/common/chrome_result_codes.h).
- Removed only the confirmed closed instance and its twelve browser children.
  Current OBS remained running, with its scene and output state preserved.
  The subsequent OBS restart restored the browser engine. Before restarting,
  saved the active buffer to
  `C:\StreamingMedia\Replays\Replay 2026-09-30 19-51-29.mp4`.
  Replay capture resumed afterwards. The normal startup dialog
  was cleared before verification; no crash report upload was requested.
- Native/browser comparison files `backend-comparison-20260930-184102.json`
  and `backend-comparison-20260930-184332.json` contain partial native evidence.
  They do not establish browser performance. The browser smoke source was active
  and showing, but made no HTTP requests. All temporary sources were removed.
  The tool now supports selecting individual backends and records failure details.
- Six naturally triggered `Halo Respawn sound effect` starts had no new
  render-skipped frames in the following five seconds. System CPU peaks were
  31.8–55.3%, GPU peaks 48–58%, and average render-time peaks 2.27–2.90 ms.
  Saved in `natural-media-starts-20260930.json`. These observations cover that
  audio effect, not the user's reported video-load crash.
- Removed the unreferenced replay overlap/concatenation helpers. The live archive
  workflow keeps individual cuts and original recordings. Removed the unused
  whole-song PCM preload, PCM cache, old playback loop and optional pydub import;
  the live paced decoder and compact analysis cache remain covered by tests.
  Corrected Replay's stale instructions describing a startup recording wipe.
- Fifty targeted regressions passed after this removal, including exact cached
  visualizer signals, cancellation, actual multi-audio replay cuts and library
  retention. The supported Hub was restarted hidden, with one keyboard child,
  ten ready modules and empty stderr. Voice is ready, all recording paths and
  the personalized soundboard profile/binding remain correct. The current OBS
  scene was the user's `just screen`, with replay active and stream/record off.

### Replay admission and signal ownership

- Replay now uses the same media startup gate as music and native effects.
  Queued cancellation makes no file, scene or mute changes; failed startup stops
  the decoder and releases its slot. The slot is released after startup, rather
  than being held throughout the clip. Existing per-asset levels and visible
  scene restart behavior remain in use.
- Removed Replay's import-time SIGINT/SIGTERM overrides. They replaced the Hub's
  signal handling and could terminate it before its cleanup finally block ran.
  The Hub owns shutdown; Replay retains its normal-exit unmute fallback.
- Fifty-one targeted Replay, Hub startup, playback ownership and module lifecycle
  tests passed. A real, muted, off-canvas Replay helper test started in 0.359 s,
  advanced its playback cursor, and added no render/output skipped frames. Its
  source was removed and the original recording SHA-256 was unchanged.
- Logs: `replay-shared-startup-live-20260930.json`,
  `voice-gpu-live-upload-20260930.json`, and `hub-gpu-preparation-20260930*`.

### Completed reusable backend comparison

OBS's recovered browser engine loaded the test page and played both existing
MP4 assets. Each backend reused one physical input over two swaps per asset;
temporary inputs were muted, placed off canvas and removed afterwards. Replay
capture stayed active; scene and output state were identical before and after.

| Backend | First observed progress | Median / peak OBS tree CPU | Total GPU peak | Additional render / output skipped frames |
| --- | --- | --- | --- | --- |
| Native hardware | 0.203–0.391 s | 27.3% / 116.4% | 37% | 2 / 2 |
| Native software | 0.172 s | 41.6% / 117.0% | 38% | 0 / 0 |
| Reusable browser | 0.094–0.328 s | 54.6% / 157.9% | 37% | 0 / 0 |

CPU percentages sum OBS and its child processes, with one logical CPU equal to
100%; this machine has 16 logical CPUs. GPU readings cover the whole device.
Browser progress uses a `playing` event acknowledgment, whereas native progress
requires an advancing media cursor, so the timings are not identical signals.
The short sequential test does not isolate unrelated background work, visible
composition, filters, alpha, audio routing or gaming contention. It gives no
evidence for broadly migrating native playback to browser: browser CPU was
higher and GPU peaks were comparable. Keep the existing native decoder policy.
The two skipped frames during the hardware interval need gaming-context evidence
before attributing them to decoding or changing its policy.

Full results: `backend-comparison-20260930-200525.json` under the external
diagnostics folder. OBS's new log has no CEF initialization failure.

### Incremental filter restoration and safe asset state

- Previously any saved filter difference deleted and recreated the entire
  chain. Restoration now retains matching name/type instances, updates only
  changed settings or enable states, and restores filter order. Only removed or
  type-changed filters are deleted, and only new/type-changed filters are created.
- Complete saved settings use the websocket's replacement mode so omitted keys
  reset to defaults, preserving the result of recreating a filter. Ordinary
  incremental UI/filter edits still merge settings as before.
- A real OBS comparison used temporary color inputs and compared the incremental
  result against full recreation. Settings snapshots and screenshot pixel hashes
  matched for setting changes, resetting omitted opacity, disabling a filter,
  reordering and changing one type. The first three cases recreated zero filters;
  the type change recreated one. Temporary inputs were removed, and scene/output
  state was unchanged. This proves output equivalence for the built-in tested
  filters, not reduced game-frame times or every third-party filter implementation.
- Per-asset source state now uses the shared atomic JSON writer. A failed Windows
  replacement retains the existing personal file and removes its temporary file;
  a targeted regression verifies preservation of filters/placement data.
- Quietly handles browser/OBS disconnects during viewer overlay responses. The
  observed WinError 10053 was a closed response socket, not a media decoder failure.
- Fifty-six targeted loading, stream behavior, playback ownership, runtime profile
  and viewer reward tests passed. Live evidence is in
  `filter-reconciliation-live-20260930.json` under external diagnostics.
- Final deployment: PID 1616, one keyboard child PID 19432, ten ready modules,
  four HTTP services returning 200 and empty stderr. Voice is ready/idle on the
  saved GPU model, and soundboard still has only default with `@ -> hooray`.
  OBS remains on just screen with replay capture active, stream/record off and
  recording directory matching the root environment. Compilation and diff
  whitespace checks passed. Logs: `hub-filter-resources-ready-20260930*`.

### Encoding and crash evidence

- All 65 configured music assets have valid compact analysis caches. Existing
  cached playback avoids the secondary FFmpeg audio decoder and FFTs; no duplicate
  preparation work was needed.
- Measured four short, paced FFmpeg NVENC configurations with one additional
  encoder while OBS replay capture continued. Used a read-only 1080p60 replay,
  bounded decoder threads, below-normal process priority, sequential runs and an
  abort guard for gameplay/live stream/record start or sampled GPU reaching 80%.
  This guard is a stop condition, not a hard utilization cap.

| FFmpeg test configuration, p5/CQP23 | Total GPU median / peak | Total encoder median | Additional render / output skips |
| --- | --- | --- | --- |
| Quarter-resolution multipass, lookahead 8, spatial/temporal AQ | 21% / 29% | 52% | 0 / 0 |
| Quarter-resolution multipass, no lookahead, AQ | 21% / 22% | 55% | 0 / 0 |
| Single pass, no lookahead, AQ | 26% / 27% | 55% | 0 / 0 |
| Single pass, no lookahead or AQ | 22% / 26% | 48% | 0 / 0 |

These are total device counters from short sequential tests, with changing
background work and clocks. FFmpeg's host-frame pipeline differs from OBS's
DirectX encoder integration, and this did not compare image quality. It establishes
no clear benefit from changing the user's encoder configuration, which remains
unchanged. The source size/mtime and OBS scene/output state were unchanged;
all test children exited. Results: `nvenc-pipeline-comparison-20260930.json`.
NVIDIA documents that lookahead, AQ and some multipass modes use CUDA, while the
core encoder is separate; this alone does not prove they caused these crashes.
[NVIDIA encoder features](https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/nvenc-video-encoder-api-prog-guide/index.html#encoder-features-using-cuda).

Windows history contains a September 13 NVIDIA display-driver recovery and
September 24 unexpected shutdown records with zero bugcheck codes. Some shutdown
records occurred during sleep transitions. There is no corresponding WHEA or
bugcheck evidence in the inspected events to identify a hardware cause. Event 41
by itself cannot identify why the PC stopped; neither these logs nor idle tests
prove that Hub resource changes have fixed the reported gaming failures.
[Microsoft Event 41 guidance](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/event-id-41-restart).

### Correlated voice and League diagnostics

- Shared microphone/upload inference now emits running/released markers around
  consumption of Whisper's lazy segment iterator. Model loading is marked too.
  This wakes the existing monitor immediately and requests its bounded five-second
  sampling burst; it does not add another monitor, model or GPU process.
- League game/client processes are discovered every five seconds and sampled
  using retained Process objects so CPU counters measure elapsed intervals.
  First CPU readings are null, not a misleading zero. Exited processes are dropped.
  Only a fixed executable-name allowlist, PID, CPU, RSS and thread count are logged;
  process command lines, paths and authentication tokens are never queried.
- Both inference entry points now share one helper, retaining their language,
  beam and VAD settings. Failure still releases activity and upload ownership.
  Fifty-eight targeted diagnostic, voice lifecycle/service/settings and Hub
  architecture tests passed, including lazy-iterator failure and process exits.
- One real generated-audio upload completed in 0.887 s after the restart, including
  first-inference initialization. Eight live diagnostic rows included processing
  and idle states, both activity markers, and total GPU readings of 19–56%.
  Burst intervals were about 0.16–0.64 s, with collection taking 94–141 ms. No
  render/output skipped frames were added. These are hardware sampling windows,
  not instantaneous or per-process GPU attribution.
- LeagueClient CPU was measured concurrently (one row showed 156%, where 100%
  means one logical CPU); no League game executable was present. It cannot be
  treated as gameplay verification. Results:
  `voice-correlated-diagnostics-live-20260930.json` under external diagnostics.
- Deployment PID 26920 has ten ready modules, one keyboard worker, four HTTP
  services returning 200 and empty stderr. Voice is ready/idle on small.en CUDA
  int8_float16. Replay remains active at the preserved directory, with stream and
  recording off. Soundboard default and `@ -> hooray` remain intact. Compilation
  and diff checks passed. Runtime logs: `hub-voice-diagnostics-20260930*`.

### Combined workload and preview CPU attribution

- Ran the actual replay cutter, preview generator and browser audio extraction
  functions concurrently in an isolated worker sharing their conversion budget.
  In parallel, a temporary muted OBS source exercised native decoder startup and
  the running Hub transcribed generated audio. No League game was running; the
  source was off canvas, so this does not establish visible gameplay stability.
- All five paths completed: native startup 0.343 s, voice 0.562 s, audio extraction
  3.203 s, replay cut 4.859 s and a 47-second preview 20.375 s. Budget use never
  exceeded three units; at most one request waited. Final budget and child-process
  lists were empty. Sampled total GPU peaked at 49%, with no additional OBS render
  or output skips. Replay stayed active, scene/output state matched, and the
  original recording's SHA-256 was unchanged. Temporary test assets were removed.
- Short total CPU samples in that combined run reached 94.9% after excluding its
  initial 15 ms sample. A separate preview run therefore sampled FFmpeg directly:
  median 143.8%, peak 190.8%, where 100% means one logical CPU. On this 16-thread
  system that corresponds to approximately 9.0% and 11.9% of total CPU capacity.
  Total system CPU in that separate run had median 34.2% and peak 66.8%; League
  client and renderer processes also consumed CPU. This does not attribute the
  earlier combined-run spikes, but provides no evidence that preview alone
  saturated the CPU. Thread count is not a measure of simultaneous CPU usage.
- Results are in external diagnostics: `combined-resource-workload-20260930.json`
  and `preview-attributed-cpu-20260930.json`. Existing conversion limits remain.
- Rechecked deployment PID 26920 and its single keyboard worker PID 16196:
  no Python source changed after launch, ten modules are ready, all four HTTP
  services return 200, voice is idle without an owner, and stderr remains empty.

### Replay editor conversion ownership

- Found the editor's full-resolution cut exporter still using direct subprocess
  calls, outside the finite conversion budget. The earlier combined test exercised
  Instant Replay's command cutter, not this separate editor path.
- Editor duration probes now use the shared cancellable runner with weight one;
  exports use weight two and one filter thread. The existing two decoder/encoder
  threads, veryfast/CRF18 quality, all audio tracks, original-file retention and
  library metadata remain unchanged. Hub shutdown cancels queued/running work
  through the existing application stop event rather than leaving a long export
  running after module cleanup. Cancellation reports that the original is intact.
- Twenty-five targeted replay trim, conversion budget, cutoff and library tests
  passed. Real disposable multi-track cuts preserve resolution, duration, labels
  and original bytes. New integration checks prove an editor request waits when
  all three budget units are occupied, then exports successfully; shutdown while
  queued publishes neither a partial recording nor a completed cut.
- Compilation and whitespace checks passed. This closes a concrete overlapping
  conversion path; the budget is admission control, not a hard CPU/GPU percentage
  cap or proof of stability during gameplay.
- Deployed after a settings snapshot and normal Ctrl+C shutdown of Hub 26920 and
  keyboard 16196. Hidden Hub 9200 now has one keyboard worker 11728, all ten modules
  ready and all four HTTP services returning 200. Voice is ready/idle on small.en
  CUDA int8_float16, with no owner or startup error; stderr is empty. OBS remains
  on just screen with replay capture active. Its recording directory and root
  environment still match C:\\StreamingMedia\\Replays. Soundboard retains only
  default and `@ -> hooray`. Logs: `hub-editor-budget-20260930*`.

### Idle browser canvas work

- Read-only OBS inspection found native media inputs in MEDIA_STATE_NONE while
  idle. No League game executable was present. This did not show a lingering
  native decoder that warranted changing source lifetime or deleting sources.
- Real Chromium instrumentation did find repeated full-canvas clearing after a
  Soundboard browser effect ended and while League production was disabled.
  The new regression checks failed before the fix: Soundboard made two extra
  clears in 750 ms, and League made two extra clears in 1100 ms.
- Soundboard stop is now idempotent once its audio, current playback and frame
  have been released. League only clears its canvas when it has drawn a frame.
  Polling, audio routing, effect timing, source lifetime and FPS remain unchanged.
  Both Chromium suites passed after the fix, including audio acknowledgement,
  pause/resume, completion, transport loss, all seven ambient themes, 58 border
  events, transparent gameplay centers and live production controls.
- Refreshed the two idle OBS browser inputs through their normal refresh button;
  served JavaScript matched the edited files. Hub 9200 was not restarted because
  these files are served from disk and loaded by OBS. Settings and filter snapshots
  matched before/after; scene and output state matched, replay remained active,
  and no render/output skips were added. The change removes verified canvas work;
  no GPU utilization improvement or gameplay crash prevention is claimed.
- Deployment evidence: `idle-canvas-deployment-20260930.json`. Browser test
  artifacts: `idle-clear-muffin-preview.png` and `idle-clear-league`, all under
  external diagnostics.

### Specific Song and TikTok startup comparison

- User identified both modules and clarified that manual and voice triggers can
  cause spikes. The shared playback stage therefore remains a candidate; voice
  may still add load. Neither module's shared OBS source currently has filters.
- Inventoried all 64 song videos and 35 TikTok videos with no probe errors. The
  highest frame workloads are landscape/portrait 1080p60 H.264, not 4K. The current
  decoder policy selects hardware for 36 song videos and 22 TikTok videos.
- All 65 song audio/video assets have valid prepared spectral caches, totaling
  about 27.8 MiB. The longest measured cache load was 20.941 ms. Cached playback
  avoids a second audio decoder; no full-song PCM preload was added.
- Tested Kora Skrillex, el gato on my mind, control ward edit and bull shit champion
  on disposable hidden native inputs, with hardware and software decoding. Startup
  progress took 0.171–0.218 s. Hardware runs used less median OBS CPU, while adding
  192–269 MiB of total device memory relative to their baselines; software added
  10–75 MiB. Total GPU samples peaked at 37–40%, with no added skipped frames.
- Extended the reused-input comparison with 60 FPS browser output to match the
  heavier videos. Two repeated swaps between Kora Skrillex and control ward edit
  showed native OBS-process-tree CPU medians of 63.6–80.7% versus browser medians
  of 99.8–192.2%, where 100% means one logical CPU. Total GPU peaks were similar
  (native 37–40%, browser 38–41%). Browser recorded lower total VRAM peaks, but
  did not establish an overall resource improvement. Native playback is retained.
  The native phase accumulated seven render and seven output skipped frames;
  the browser phase accumulated none. These are total OBS counters with concurrent
  desktop activity, not per-input attribution. This tradeoff remains relevant to
  representative gameplay verification and is not dismissed by the CPU result.
- These short sequential tests were muted and off canvas, with replay active and
  no game executable present. Background workload changed; source dimensions,
  native media-clock progress and browser playing acknowledgements also differ.
  They do not reproduce visible composition, actual voice triggering or gameplay
  crashes. All temporary inputs were removed, and scene/output state matched
  within each test. No media quality or personal-source settings were changed.
- OBS 32.1.1's decoder initializes its hardware context when opening a codec and
  uses automatic codec threading. Its custom FFmpeg options are parsed for input
  opening rather than passed to avcodec_open2; adding `threads=2` there would not
  establish the promised decoder limit. No ineffective option was added.
  [OBS decoder source](https://raw.githubusercontent.com/obsproject/obs-studio/32.1.1/shared/media-playback/media-playback/decode.c),
  [OBS input-opening source](https://raw.githubusercontent.com/obsproject/obs-studio/32.1.1/shared/media-playback/media-playback/media.c).
- Evidence: `decoder-profile-20260930-223008.json`,
  `backend-comparison-20260930-223426.json`, `song-analysis-startup-20260930.json`
  and `song-tiktok-media-inventory-20260930.json` in external diagnostics.
- User subsequently confirmed they have not tested the updated Hub while gaming.
  At that point, overload after the deployed changes remained unverified. The
  later actual-trigger observations below provide initial gameplay evidence;
  manual and voice paths still need to be distinguished where possible.

### Live gameplay and stream baseline

- League game PID 17868 became active while Hub 9200 and keyboard 11728 remained
  healthy. Observed the existing flushed performance log without introducing
  media, voice inference, scene changes or another GPU sampling process.
- The first 90-second gameplay window contained 38 rows including preceding
  context: total GPU median/peak 54%/58%, VRAM 5767–6019 MiB of 11264 MiB,
  and system CPU median/peak 42.05%/83.5%. OBS added four render and output skips
  without a Specific Song or TikTok load marker. Hub CPU median/peak was
  7.3%/57.3% of one logical CPU on a 16-thread system; total system CPU cannot be
  attributed to Hub from that counter. Average OBS frame render time in the rows
  ranged up to 3.804 ms.
- A planned short muted/off-canvas startup check stopped at preflight because OBS
  streaming had become active. It created no source and loaded no asset. Continued
  read-only observation through a second 90-second live game/stream window:
  22 rows, GPU median/peak 52%/55%, system CPU median/peak 42%/51.9%, and no added
  render/output skips. Both windows had zero ss__player or tt__player load markers,
  so the reported trigger-time spike remains untested under this workload.
- Four additional two-second process CPU-time samples used executable names and
  CPU totals only. Game, League/Riot clients, Chrome, OBS and desktop composition
  contributed to measured CPU use. No command lines or authentication data were
  queried, and no applications were closed or reprioritized. These short samples
  do not identify the earlier 83.5% sample's cause.
- The animated Udyr mask was actively showing in Program, so its 1080p60 decoder
  is part of the personalized HUD rather than an unused source to remove. Source
  state alone can be stale when a decoder is closed; inactive PLAYING flags are
  not sufficient evidence of ongoing decoding.
- Evidence in external diagnostics:
  `in-game-media-observation-20261001-024430.json`,
  `stream-game-media-observation-20261001-025541.json`,
  `game-stream-cpu-attribution-20261001.json`.
  Subsequent actual triggers are evaluated below; these baseline windows alone
  did not establish trigger-time behavior.

### Actual gameplay triggers after deployment

- Read the existing rolling logs from 02:44–03:06 UTC on October 1, without
  adding playback or restarting the live Hub. Deduplicated retained activity
  markers by timestamp/source/phase rather than counting each repeated marker
  as another trigger. The League game process was present throughout six target
  startup windows: two TikTok and four Specific Song loads.
- TikTok startup gates released after 0.124 and 0.258 seconds; Specific Song
  released after 0.110–0.138 seconds. All six windows added zero OBS render and
  output skipped frames. Sampled total GPU peaks ranged from 55% to 77%, and
  peak device memory across these windows was 6161 MiB of 11264 MiB. The highest
  system CPU sample in these target windows was 67.2%. Process CPU counters use
  one logical CPU as 100%, so they are not percentages of the entire machine.
- Five of those loads immediately followed voice inference releases and match
  completed Specific Song/TikTok voice sessions in the Hub history. Their
  inference durations were 0.442–0.845 seconds. The sixth song load had no nearby
  inference marker; it could be random-mode advancement or manual input, so it
  is not labeled a verified manual trigger. Current voice state was ready/idle,
  with no owner, capture or transcription left active.
- After the game process exited, a voice-triggered Instant Replay startup took
  0.493 seconds and its window added one render/output skip, with sampled GPU
  peaking at 52%. A subsequent replay advance took 0.469 seconds and added no
  skips. These counters describe the whole OBS pipeline and do not establish
  that replay caused the single skipped frame.
- This is initial evidence from normal use, not proof that every asset or future
  crash is fixed. Half-second samples can miss shorter GPU spikes. Confirmed
  manual hotkeys, rapid replacement, and sustained visible playback remain
  relevant verification. No personal settings, quality or output configuration
  were changed for this observation.
- Evidence: external diagnostics `actual-media-trigger-correlation-20261001.json`;
  the artifact includes window boundaries, counters and voice session metadata,
  without transcript text.

### Ownership and preservation verification

- The user reported that the latest observed Specific Song/TikTok playback felt
  smooth. This supports the measured gameplay results above; it does not identify
  every tested asset or distinguish manual hotkeys from random advancement.
- A read-only survey of all 60 native OBS media inputs found two advancing
  clocks: the visible personalized Udyr animation and the visible song player.
  No inactive source had an advancing clock in the survey. Soundboard, TikTok
  and Instant Replay were inactive, stopped/ended, and configured to close when
  inactive. No sources were removed or stopped for the survey.
- Deduplicated startup markers showed 23 native loads, a maximum of one native
  startup at a time, no overlapping startup intervals, and no startup still
  holding ownership at the end of the inspected log. These markers cover startup,
  not entire playback lifetimes; intentional layering remains supported.
- Revalidated the supported checkout's Hub PID 9200 and its sole keyboard child
  PID 11728, all ten registered modules, and HTTP 200 on ports 7420, 8765, 7431
  and 7442. Voice was ready/idle with no owner. Streaming and replay remained
  active; recording was stopped. No restart was needed for this read-only pass.
- OBS SimpleOutput/FilePath, AdvOut/RecFilePath and AdvOut/FFFilePath all still
  matched root REPLAY_DIR at C:\StreamingMedia\Replays. Soundboard still had only
  the default profile, with @ mapped to hooray. Personal settings were not changed.
- Final tools regression run: **320 tests passed** in 11.511 seconds with the
  supported runner's `-X utf8` setting. The first run used Windows' default
  redirected console encoding and encountered Unicode logging failures; it is
  not reported as a passing run. League API regression run: **84 tests passed**
  in 3.807 seconds with package-aware discovery.
- External evidence: `live-decoder-ownership-20261001.json`,
  `resource-final-runtime-20261001.json`,
  `resource-final-regressions-utf8-20261001.log`,
  `resource-final-league-regressions-20261001.log`.

### Remaining verification

1. Correlate a normal trigger/replacement sequence with half-second CPU/GPU/OBS
   samples. Check decoder opens, filter changes and duplicate file updates across
   Soundboard, Specific Song, layered effects and Replay.
2. Extend the completed native/browser comparison only where a particular effect
   suggests a benefit, including visible composition, audio routing, alpha,
   filters, placement, cancellation and layering. The current comparison supports
   retaining native playback; browser was not cheaper in CPU.
3. Extend the completed isolated combined-request test to requests made through
   the live Hub during normal use. Replay archival moves individual clips within
   the recording volume; the retired FFmpeg merge path is absent.
4. Extend the completed NVENC comparison only if representative load identifies
   an encoder bottleneck. Current evidence supports preserving output settings.
5. Verify the affected workflows under representative game/stream/replay load,
   retain comparison logs, and confirm personal settings and startup readiness.

## Verification files

297 tools tests passed using the Hub's Python 3.11; compilation and
`git diff --check` passed. Tests include concurrent layout/decoder requests using
one probe, file-edit invalidation, bounded preparation reads, shutdown while
waiting for foreground loading, and Hub ownership of the preparation thread.

Local logs are in `%LOCALAPPDATA%\StreamingHub\diagnostics`:
`decoder-profile-20260930-180358.json`, `resource-preparation-tests.log`,
`hub-resource-preparation-20260930*`, `hub-media-budget-verified-20260930*`,
`media-job-budget-tests.log`, and
`performance.jsonl`. Latest targeted verification: `retired-paths-tests.log`
and `hub-retired-paths-20260930*`.

OBS explains that browsers can add substantial resource costs and recommends
native media sources for audio/video files. Its media-source implementation also
reopens decoders when file/hardware/speed options change. These sources inform the
investigation; they do not replace measurements on this machine:
[OBS resource guidance](https://obsproject.com/kb/encoding-performance-troubleshooting),
[OBS media source implementation](https://github.com/obsproject/obs-studio/blob/32.1.1/plugins/obs-ffmpeg/obs-ffmpeg-source.c),
[OBS decoder implementation](https://github.com/obsproject/obs-studio/blob/32.1.1/shared/media-playback/media-playback/decode.c).

## CPU investigation — October 2, 2026

The user reported a severe gaming FPS drop while OBS and coding agents were
running, with Task Manager showing Python CPU saturation. No incident timestamp
or Python PID was available. This pass distinguishes measured inefficiencies from
the still-unidentified original incident; it does not claim a system CPU cap.

### Evidence and coverage

- The initial review covered 9,516 retained performance samples. The highest
  recorded Hub CPU use was about 26% of this 16-logical-CPU machine. Several
  samples reached 100% system CPU while the Hub used 0–13%. Five-second idle
  sampling can miss short events, and old diagnostics did not track other Python
  processes; these logs cannot rule out a shorter Hub spike.
- Live thread stacks showed the Hub's feature loops waiting on queues/events,
  with no observed busy loop. Footage Desk was running OCR on its existing
  background analysis worker, using about two logical CPUs (12.5% of the machine).
- A concurrent OBS audit saved process evidence of two offline suites and
  Footage Desk each using approximately 12% of total CPU while the Hub used
  0.74%. Together with gaming and other applications, concurrent maintenance
  work is a credible contributor, not proof of the original incident's cause.
- Reviewed microphone/inference ownership, keyboard isolation, playback workers,
  decoder startup admission, paced asset preparation, metadata caching, finite
  media conversion admission, song analysis backpressure, Spotify capture, and
  the shared polling/diagnostics loops. Existing cancellation, source ownership,
  decoder limits and replay quality remain in place.

### Changes and measured tradeoffs

| Change | Verification | Limit / tradeoff |
| --- | --- | --- |
| Footage Desk OCR uses one inference thread per model, avoiding separate spinning worker pools | Same complete observations for six saved frames: gameplay, endgame, desktop, replay banner, postgame and loading. CPU time fell from 30.516 s to 16.516 s (45.9%); wall time was 15.288 s versus 16.456 s. Existing real-reference regressions also passed. | This is one representative comparison with other work running, not a benchmark of every recording. Existing analysis keeps running with its loaded code; the fix applies on the next Footage Desk launch. |
| Spotify computes one FFT per audio window and reuses an eight-entry immutable plan cache | Exact matches for all bands and features in 15 sequential snapshots, covering different rates/sizes, mono, stereo, opposed stereo, noise and silence. A 2,000-window test fell from 2.1875 s to 1.046875 s CPU time (52.1%); wall time fell from 2.254 s to 1.068 s. | These are analysis costs, not total Hub or system CPU savings. Audio capture, publish cadence, thresholds and visual signals stay the same. |
| Offline suites queue per checkout before importing test dependencies, run below-normal on Windows and default numerical pools to two threads | Real two-process regression verifies queuing, crash release and normal release; live full-suite process was BelowNormal and used one CPU during OCR after the fix. | Deliberately supplied numerical thread environment values are respected. Other scripts and tests launched outside the runner are not governed by this slot. |
| Existing diagnostics add Python/FFmpeg/FFprobe PID, parent, creation time, threads and CPU counters, including explicit whole-machine percentages | Live logs distinguish the Hub, its keyboard child, Footage Desk and test workers. Regressions cover priming, reused PIDs, process exit/access denial and privacy. | No command lines, environments, transcripts or credentials are recorded. Short-lived jobs may fall between five-second process discovery passes. |
| Activity markers cannot schedule diagnostics faster than once per half second | Simulated repeated markers verify minimum spacing and idle wakeup/shutdown responsiveness. | Sampling still does not capture every shorter CPU/GPU event. |

The numerical analysis now lives in Spotify's `audio_analysis.py`; its public
service imports remain compatible. Process attribution lives in
`lib/process_metrics.py` and uses the existing monitor thread. Test CPU policy is
owned by `tools/offline_test_resources.py`, separate from live application policy.
ONNX Runtime documents that spinning workers can consume CPU while awaiting
work: [thread management](https://onnxruntime.ai/docs/performance/tune-performance/threading.html).

### Validation and preservation

The focused run passed 30 tests. The complete supported offline run passed
**575 tests in 69.070 seconds**, and the architecture checker examined
**308 modules with zero violations**.
The final architecture recheck covered 310 modules with zero violations after
another agent added runtime components; the CPU changes remained intact.
Full-suite log: `output/cpu-audit-offline-tests-20261002.log`. Local before/after comparison
artifacts are in `%LOCALAPPDATA%/StreamingHub/diagnostics`:
`ocr-cpu-1-20261002.json`, `ocr-cpu-2-20261002.json`,
`spotify-signals-before-cpu-audit.json` and `spotify-cpu-after-20261002.json`.

Personal settings were snapshotted before runtime deployment. No profiles,
hotkeys, volume settings, OBS output settings or replay paths were edited by
this CPU pass. Concurrent agents continue to own their unrelated changes.
The supported Hub was restarted hidden after a settings snapshot: old Hub
18380 and keyboard 12072 exited through Ctrl+C; new Hub 32064 has one keyboard
child (12084), twelve modules reporting startup readiness, ready/idle voice,
and HTTP 200 on ports 7420, 8765, 7431, 7442 and 7447. Footage Desk PID 18536
and its active analysis were preserved. OBS remained on `Lobbies`, streaming
and recording stopped, replay active; live recording directory and all three
profile paths matched `C:\StreamingMedia\Replays`. Soundboard retained only
`default` with `@ -> hooray`. Startup stderr was empty; five microphone overflow
notices appeared during startup, with no additional notices in the subsequent
inspection. Post-start Hub samples used about 0.7–2.4% of total CPU, without a
game running; these are readiness observations, not gaming performance proof.
Runtime evidence: external diagnostics `cpu-audit-runtime-20261002.json` and
`output/cpu-audit-hub-20261002.log`.
The original 100% incident still requires PID-correlated evidence during normal
gaming; the added counters make that distinction possible without another
monitor or synthetic live playback.

### Follow-up using the OBS efficiency findings

The follow-up applied bounded Spotify idle notifications (50 requests to 2 over
three seconds in Chromium), skipped off-scene presentation while retaining
musical history, and activated Twitch's intended custom 30 FPS browser limit.
Only `fps_custom` changed in the live OBS input; source levels, filters, tracks,
placements, visibility, dimensions and 60 FPS output were verified identical.
The original GPU-engine/CPU incident remains unproven; these are measured waste
reductions rather than a system load guarantee. A separate saved history contains
a genuine 43.3% whole-machine Hub peak, from a different retained sample set than
the initial audit's approximately 26% peak.

The full offline suite passed 629 tests; architecture validation covered 325
modules with zero violations. Browser regressions covered notification latency,
off-scene history, reconnects, all current Spotify forms, and raid clocks at
30 FPS. Other agents restarted the Hub after the Python changes; live UI/module,
voice, keyboard-child and recording-path checks passed without interrupting
Footage Desk. Full findings and deployment evidence are in
`output/OBS-EFFICIENCY-OPTIMIZATIONS-2026-10-02.txt`,
`output/obs-efficiency-application-20261002.json` and
`output/obs-efficiency-runtime-20261002.json`.
OBS documents its independent browser frame limit in
[Browser Source](https://obsproject.com/kb/browser-source); its
[implementation](https://github.com/obsproject/obs-browser/blob/master/obs-browser-source.cpp)
publishes the source-visibility event used to skip invisible painting.

### Repeat resource audit later on October 2, 2026

The current-state pass found and fixed two additional resource costs. Editor and
Twitch media responses now use `lib/http_files.py` for bounded streaming/ranges;
replay previews and browser-effect audio share those mechanics. A 4 KiB request
against a disposable 32 MiB file previously read/sent the entire file and peaked
at 32.05 MiB of Python allocation. It now sends 4 KiB with a measured 0.064 MiB
peak; a full-file transfer peaks at 0.509 MiB while preserving the original bytes.

`lib/media_metadata.py` retains one admitted probe and a 512-entry cache, while
letting cached reads bypass unrelated probes. The contention fixture changed
from a cached read blocked for at least 250 ms to 0.232 ms while the unrelated
probe remained blocked. Cache invalidation, recent-use eviction, duplicate-miss
coalescing and failed-probe retries remain covered by regressions.

The full suite passed 687 tests; the final architecture check covered 338 modules
with no violations. Live HTTP range checks, one-Hub/one-keyboard-child checks,
voice readiness and replay-path preservation passed after another agent's Hub
restart. Footage Desk continued running. The observed two-hour baseline showed
stable Hub memory and low CPU, rather than an ongoing runaway; this does not
predict every gaming workload. See
`output/RESOURCE-AUDIT-REPEAT-2026-10-02.txt` and its benchmark, test-log and runtime
evidence files for scope, measurements and limitations.

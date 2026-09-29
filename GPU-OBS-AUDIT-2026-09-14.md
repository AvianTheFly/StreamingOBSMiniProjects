# OBS / GPU crash audit — September 14, 2026

**Finding:** Windows and OBS independently confirm an NVIDIA GPU hang. A separate OBS Chromium/browser crash is also documented. I fixed Hub paths that could accumulate background work, applied a browser mitigation, reset GPU tuning to stock, and updated the active NVIDIA driver from 560.94 to 616.92. These are concrete repairs and isolation steps; the intermittent whole-PC crash is **not yet proven resolved**.

All times below are local Eastern time. Diagnostic JSON timestamps use UTC.

| Evidence | What it establishes |
|---|---|
| Sept 13, 21:54:57: OBS reports `Device Removed Reason: 887A0006`, followed by `Device Remove/Reset! Rebuilding all assets...` | The graphics device hung. `887A0006` is `DXGI_ERROR_DEVICE_HUNG`. |
| Sept 13, 21:54:58: Windows Display event 4101 says the NVIDIA driver stopped responding and recovered. Windows Error Reporting records `LiveKernelEvent 141` at 21:55:02. | Independent OS confirmation of a GPU timeout, matching the OBS log. |
| Sept 14, 02:02:15: NVIDIA event 153; all three OBS browser overlays terminate at essentially the same time. | A second correlated driver/browser failure. This does not identify which workload initiated it. |
| Sept 14, 02:17:55–58: LoboBot and League API Alerts report `STATUS_BREAKPOINT`; OBS's crash report identifies `CrBrowserMain` in `libcef.dll`. | A browser-component failure immediately after launching OBS. No busy stream is required. WER also records heap-corruption termination in this episode. |
| Multiple Kernel-Power event 41 records, including Sept 9–10 | Unclean system shutdowns occurred. These records alone cannot distinguish a forced reset, power loss, or a specific hardware failure. |

Microsoft documents the timeout/recovery mechanism and why GPU hangs can affect applications and the desktop: [WDDM timeout detection and recovery](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/timeout-detection-and-recovery).

**Why it can happen with few assets playing**

Your current OBS collection has 60 native media inputs, but that count is not the number decoding simultaneously. A live inspection after restart found only `UdyrImageMaskANIMATION` playing. The conservative dormant-source audit found no additional eligible hidden-media repairs. Existing source parking, serialized media startup, decoder selection, and filter-reuse protections are present and their regressions pass. I did not apply a blanket media/profile replacement.

There is nevertheless a persistent workload: the visible Udyr animation is H.264, 1920×1080, 60 FPS, looping, with AAC audio. The scene also contains nested scenes, desktop captures, custom 3D filters and browser overlays. The Udyr source repeatedly reports audio-buffer exhaustion before the 02:02 failure, including a roughly 38-second audio delay. This is evidence of a serious stall; it does not establish that the animation caused it.

The Hub loads Whisper `large-v3` on CUDA in float16. Around its startup, total GPU memory rose from roughly 3.3 GB to 6.4 GB with OBS running. That is an observational delta, not an isolated memory benchmark. Whisper stays resident even while no voice command is active. Its transcription work is invisible as an OBS asset. I preserved the chosen model and precision rather than silently reducing recognition quality.

A Windows GPU-engine sample attributed approximately 15.8% 3D activity to OBS, 13.8% to Desktop Window Manager, 8.1% to ChatGPT, 6.2% to Parsec, and 4.4% to Chrome. Chrome, Parsec and OBS also had video-decoder activity. These are one-time per-engine readings, not a measurement of the crash or independent percentages to add across engine types. They show that the desktop workload matters alongside OBS.

Several earlier completed streaming sessions reported only around 0.1% rendering and encoding lag. Their averages cannot rule out brief spikes, but they argue against assuming the machine is simply too slow all the time.

**GPU tuning and driver follow-up**

The RTX 2080 Ti initially had driver 560.94 (August 20, 2024), a live **351 W** power limit versus the card's **300 W** default, and an Afterburner startup profile at 117% power. Its saved clock offsets were modest: +6 MHz core and +36 MHz memory; the voltage boost setting was 100. These settings do not prove the cause of the hangs. Your GPU is water-cooled, and the measurements obtained here do not support a thermal diagnosis.

With administrative access, I backed up the Afterburner configuration, retained your original profiles 1 and 2 unchanged, and applied a stock profile through Afterburner's profile-loading command. Startup and the added stock profile now have zero core/memory offsets, zero voltage boost, zero voltage/frequency curve offsets and no locked curve point. The live power limit is verified at **300 W**. The initial unprivileged reset attempt failed; the later elevated reset succeeded.

I downloaded the signed NVIDIA **616.92 WHQL** Windows 10/11 package, verified its NVIDIA signature and RTX 2080 Ti support, and exported the previous driver package for rollback before installing the display driver. Sources: [NVIDIA driver 616.92](https://www.nvidia.com/en-us/drivers/details/278453/) and [NVIDIA installation command documentation](https://docs.nvidia.com/datacenter/tesla/driver-installation-guide/windows.html).

**Installation caveat:** NVIDIA setup returned `0x80070005` (access denied) at overall completion. Windows' device-install log independently records `SUCCESS` at 14:56:36, including a verified device restart. Both NVIDIA's live query and Windows identify the new driver (616.92 / 32.0.16.1692, `oem24.inf`), and Device Manager's error code is zero. The precise installer completion failure is unresolved; this is not represented as a completely clean installer run. Restart Windows before the next full stream to finish any pending installation work. No forced reboot was performed.

**Changes applied**

- `voice/listener.py`: only one recording/transcription operation may be in flight; another recording is rejected while inference and its callback are running. Busy state clears on success, failure and failed thread creation. Audio input has a bounded queue, and stale recordings are discarded after ten seconds. Normal module recording windows remain two seconds. This removes the old path that could spawn arbitrarily many waiting transcription threads or accumulate an abnormally long recording. It is a code-confirmed risk, not proof that it triggered the recorded GPU hang.
- `lib/keyboard_worker.py` and `lib/global_hotkeys.py`: the keyboard child watches a parent-owned pipe and exits on EOF, even when the Hub is forcibly terminated and no further key is pressed. A failed stdout writer also exits the child instead of leaving its global hook installed. Three orphan listeners existed at the start of the audit; the final process check contains one Hub and one child.
- `lib/performance_monitor.py`, started by `hub.py`: bounded, rotating local samples of GPU load, VRAM, temperature, power, clocks, Hub memory/thread count, voice state and OBS rendering counters. Diagnostics use a separate OBS connection with request timeouts. Four files total, approximately 20 MB maximum, sampled every five seconds plus collection time. No audio, transcripts, credentials or browser URLs are saved. Set `HUB_PERFORMANCE_LOG=0` to disable. This cadence may miss very short spikes.
- OBS `global.ini`: changed `BrowserHWAccel=true` to `false`, after backing up the exact original with OBS closed. This is a reversible mitigation for the observed browser/GPU interaction, not a proven driver repair. OBS continues to use its normal GPU renderer; browser rendering now has a different CPU/GPU tradeoff.
- Installed the already-declared `psutil` dependency into the Hub's Python 3.11 environment so diagnostics can record process memory and thread count.

**Verification and preservation**

41 offline regressions pass, covering the new voice/parent-exit/diagnostic behavior and existing media startup, cancellation, decoder policy, filter reuse, source dormancy and key sequences. Python compilation and diff whitespace checks pass. The initial test invocation hit the repository's Windows console encoding issue; the UTF-8 invocation passes.

The correct checkout's Hub and OBS were restarted. All nine selected modules report startup ready; Whisper and the microphone report ready. Hub UI (7420), editor (8765) and League overlay (7431) return HTTP 200. Exactly one keyboard child belongs to the running Hub. OBS confirms browser hardware acceleration is false and its current scene is `Test`.

The initial 21 ready diagnostic samples held 60 FPS, with approximately 1.60–3.13 ms average frame-render time and about 1.61–1.64 GiB OBS process memory. Rendering skips increased by one frame over that interval. No stream, recording or replay buffer was active during this verification. This is startup/idle validation, **not a full game-and-stream endurance test**. No crash has been deliberately provoked.

All 29 tracked personalized settings files were byte-for-byte unchanged across the restart. Soundboard still has only `default`, including `@ -> hooray`. Asset filters, transforms, phrases, layout rules and volumes were preserved. Existing unrelated working-tree edits were retained. Settings history remains outside the repository under `LOCALAPPDATA/StreamingHub/settings-history`.

**Post-driver verification, 14:59–15:01**

Restarted the supported Hub and OBS after the driver replacement. All nine modules, Whisper and microphone became ready; the three interfaces returned HTTP 200. One Hub process (9364) owns one keyboard child (2864). The active OBS scene is now `Lobbies`; it differs from the earlier `Test` scene, so rendering times should not be treated as an isolated before/after driver benchmark.

A 45-second local NVENC H.264 1920×1080 replay-buffer test produced 2,692 encoded output frames by the end sample, with zero encoding skips and zero additional rendering skips over 2,700 rendered frames. OBS held 60 FPS; the final average frame-render time was 1.10 ms. The immediate status query raced asynchronous buffer startup and returned false, but the OBS log confirms buffer start and subsequent output counters confirm encoding. The test buffer was stopped without saving or broadcasting. Whisper remained ready, GPU memory was approximately 5.9 GiB and the power limit remained 300 W. No new System warning/error events were returned during the checked installation/validation interval. This short test does not establish full-session crash stability.

A later comparison against the initial 29-file snapshot found a change in `instant_replay/asset_volumes.json`; its current contents were preserved and snapshotted, not replaced with older volume settings. The byte-identical statement above applies to the initial restart only. Further testing was stopped at your request.

The initial concurrent startup briefly logged OBS-not-ready responses, including replay auto-start; modules subsequently recovered. The replay buffer is stopped following the test.

**Next actions needed to close the investigation**

1. Restart Windows after saving your work, then validate the normal game and stream at stock tuning. The original driver package is preserved under the audit folder's `driver-rollback` directory.
2. Keep the stock baseline during this validation. Do not reapply the previous tuning profiles while testing whether these changes resolve the hangs.
3. If another hang occurs, retain the exact time and whether Windows recovers, reboots, or requires a power-button reset. The rolling diagnostics and Windows/OBS records can then distinguish VRAM pressure, voice inference, renderer stalls and a device reset. If hangs persist at stock tuning with a supported driver, GPU/VRAM, PSU/power delivery and third-party OBS plugins need controlled isolation. Existing evidence cannot choose among them.

No TDR-delay registry workaround was applied. It would change how long Windows waits for a stuck GPU without identifying why it became stuck.

Evidence and exact pre-change backups are local at `C:/Users/Michael/AppData/Local/StreamingHub/diagnostics/audit-20260914/`. The ongoing recorder writes `C:/Users/Michael/AppData/Local/StreamingHub/diagnostics/performance.jsonl`. To reverse only the browser mitigation, close OBS and change `BrowserHWAccel` back to `true`; do not restore an entire old settings collection over newer user adjustments.


**After Windows restart**

Windows booted September 14 at 15:15:38 local. The live GPU query still reports NVIDIA 616.92 and a 300 W power limit, at 28 °C. No System critical/error events were returned since this boot in the lightweight check. OBS and the Hub were not running yet; the latest performance samples were from before the restart. No further load tests were run. The reboot is complete, but the earlier installer completion error remains part of the historical record.

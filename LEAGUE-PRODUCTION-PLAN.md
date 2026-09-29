# Temporary League production continuation plan

No desktop input. The match has ended. The final Hub reload is awaiting a
manual restart because automatic approval review blocked the forced process restart. Preserve Mom Frog and Hooray byte-for-byte, all personalized
profiles/media/filters/layouts, and latest volumes. Snapshot settings before edits.

- [x] Review current League detector, media scheduler and OBS integration.
- [x] Add a modular, independently configurable production border layer.
- [x] Implement typed dragon ambience and friendly-kill destruction; unknown type stays neutral.
- [x] Add a focused set of other objective/combat effects without duplicate audio.
- [x] Fix meaningful detection/lifecycle problems found in the review.
- [x] Verify baselines, duplicates, ownership, reconnects, timers and rendering.
- [x] Existing OBS source and Hub controls connected; Twitch raids/rewards healthy.
- [ ] Verify final activation after the user manually restarts the correct Hub.
- [x] Implementation and permanent review committed/pushed as 437de97 on origin/main.
- [ ] After restart verification, delete this temporary plan and commit/push its removal.

Important discovery: league_api alerts.json overlay_enabled=false, presentation=memes.
Keep the old meme/video setting off. Its saved banks and volume settings are user data.
Riot's live API has DragonKill but no documented dragon-spawn notification. mapTerrain
is still Default in the observed match after two kills, so never invent an early element.
Classic elemental timer is 300 seconds; Swiftplay has different rules and must not
use Classic predictions. Known repeating elements can be inferred after the third kill.

Current verification: 74 Python tests pass; actual Chrome checks pass for seven
ambient themes, clear/transport cleanup, opacity, center transparency and controls.
OBS reports streaming, so do not send fake effects to the program. Off-air OBS
browser screenshots stayed empty because inactive sources suspend rendering;
headless Chromium rendering is confirmed, and the live source heartbeat is healthy.
The currently running Hub was restarted by other work mid-implementation; restart
again after the match to load all final Python fixes. Preserve unrelated recording
storage changes in AGENTS.md, RECORDING-STORAGE.md and Instant Replay JSON.

Final reload details:
- The attempted guarded Stop-Process + hidden launch was rejected before execution
  with "blocked by policy". Do not retry forced termination through another tool.
- The Hub has no graceful restart HTTP endpoint. The user was asked to end only
  Python PID 14108 (hub.py) and PID 14892 (its keyboard child), then Run Hub.bat.
  Recheck PIDs before offering instructions or verifying; they may have changed.
- Current Hub is healthy, port 7420, with all 10 modules listed. League border OBS
  heartbeat is healthy. Twitch 7442 connected/overlay_ready; 7443 all five
  subscriptions accepted (202), connected/overlay_ready. No duplicate listeners.
- Hub headless read-only UI check opened production controls and found no JS errors.
- OBS League source settings/filters/transform/audio fingerprint is saved under
  LOCALAPPDATA/StreamingHub/diagnostics/league-production/obs-before-restart.json.
- All original League API JSON, soundboard hotkeys/profiles/phrases/volumes, and
  sound effects JSON hashes match the pre-change snapshot. Only soundboard
  single_source_state.json changed independently for another asset; Mom Frog,
  Hooray and muffin overrides match Git exactly. Do not restore or stage it.
- Final verification: port owner is supported hub.py; one keyboard child; startup
  log modules ready; 7431 /production/settings enabled and overlay_ready; Twitch
  health; OBS transform/filters/faders/routing unchanged. Keep streaming running.

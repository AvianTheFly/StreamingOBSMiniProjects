# Temporary League production continuation plan

No desktop input. User is in a League match: restart the supported v2 Hub only
after the match ends. Preserve Mom Frog and Hooray byte-for-byte, all personalized
profiles/media/filters/layouts, and latest volumes. Snapshot settings before edits.

- [x] Review current League detector, media scheduler and OBS integration.
- [x] Add a modular, independently configurable production border layer.
- [x] Implement typed dragon ambience and friendly-kill destruction; unknown type stays neutral.
- [x] Add a focused set of other objective/combat effects without duplicate audio.
- [x] Fix meaningful detection/lifecycle problems found in the review.
- [x] Verify baselines, duplicates, ownership, reconnects, timers and rendering.
- [ ] Activate in OBS, restart correct Hub after match, verify single listener and Twitch health.
- [ ] Commit/push, write useful permanent review/architecture notes and delete this plan.

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

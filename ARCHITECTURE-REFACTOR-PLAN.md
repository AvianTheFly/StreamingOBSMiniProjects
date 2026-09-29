# Temporary architecture refactor continuation

- [x] Commit/push existing setup before edits: `4821e9c`.
- [x] Snapshot settings; preserve all personalized files and media paths.
- [x] Extract Hub feature services and HTTP adapters without changing endpoints.
- [x] Make UI startup/shutdown own its workers, socket and event subscriptions.
- [x] Document system interactions and extension boundaries.
- [x] Run route/lifecycle and relevant regression tests (105 checks).
- [ ] Commit/push, restart correct Hub hidden, verify modules/OBS/Twitch.
- [ ] Remove this temporary file after completion.

No desktop input or synthetic on-air events. Preserve any unrelated changes;
`lib/browser_effects/web/mash-dance.png` appeared during this work and is not part
of this refactor. Runtime is still the previous Hub until final activation.

# Playful border redesign — 2026-10-04

Scope: every built-in League border except the approved Hextech Drake, plus all
30 unique sounds assigned to `! 2 # Z T t h H` in the default profile. Hooray is
outside these bindings and unchanged. Original audio/media and all personalized
settings remain intact. This work does not open OBS.

League now uses event-specific little stories instead of ceremonial metal
relics: juggling sword stars, a mischievous crowned Baron serpent, trampoline
grubs, a tower demolition toy set, a potion-grown heart garden, an elemental
dragon cast, a bean minion procession and a ghost rest stop. Native geometry,
translucent scenery, hanging props and fading light tails remain at the edges.
All 57 replacement stories are explicitly authored in
`mini projects/league_api/production/art/playful-events.js`.

Selected sounds have playful stage environments and finite second acts/encores.
Pedro and Sad Violin retain their approved casts with more supporting details.
Cena, racing and Muffin retain their approved primary choreography. The short
random queue retains its recognizable three-pose characters with new charms.
Prowler, isolation, rescue and confusion each have separate scenery and motion.

Preview in the Hub at `http://127.0.0.1:7420/#effects` whenever the Hub is running.
The browser uses the installed native artwork and original sound files; nothing
in this preview triggers OBS. Previews, timings, colors and live playback all
refer to the same canonical compiled artwork.

Evidence: `output/playful-borders/verification.json` records all 88 reviewed
entries, actual audio metadata, three moving frames per entry, clear central
alpha, distinct frame compositions, unchanged settings hashes and a deterministic
pixel comparison proving Hextech is preserved. Eight contact sheets show the
entire requested scope. The full Python offline suite passed 1001 tests; the
real Chromium playback regression passed audio readiness, pause/resume, end,
idle/offline cleanup and transparency with OBS connections disabled.

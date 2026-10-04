# The Afterparty

The original woodland nightclub for outros, breaks and hanging out, with a
conservative artwork cleanup. The room, furnishings, palette and jade/brass booth
retain their original layout. `art/clubhouse-clean.webp` and `art/booth-clean.webp`
are sibling detail-cleanup versions made with the built-in image_gen tool; original
plates remain saved. Prompts and source paths are in `art/prompts.json`.

Two color-changing classic Club Penguin friends flank your camera at twice their
previous width. Front-facing sit/stand/wave frames receive a small vertical
perspective correction so they stand more upright toward the camera. Each complete
character is composited before one 68% opacity pass, so translucency is uniform.
The opacity slider runs from 35% to fully solid. Eye shading stays inside the
composition; scattered dark flipper pixels are omitted at this enlarged scale.

They run this sequence in 3.8 seconds:

sit, stand, sit, stand, wave, sit, stand, sit, stand, wave; repeat.

Each sit/stand lasts 0.3 seconds and each wave 0.7 seconds. Wave slots alternate
flippers. Short pose blends ease into the next action, including the last wave
into the first sit. Colors repeat on the same 3.8-second period. The original atlas PNG
is unchanged. `sprite-paths.js` builds scalable contours once for enlarged edges.
The animal spirits are removed from this lobby. Approved gritty art in other
features remains preserved. The previously rejected four new designs remain
deleted. Disco balls, changing speakers, moving lights, the animated screen and
editable signs stay in the original room.

## Screens and media

The default main display continuously zooms through nested seeded galaxies,
revealing new spiral structures, planets and star clusters without resetting its
timeline. Texture memory stays bounded to eight cached systems. Text and media
are projected onto the physical panel corners, including both angled wall signs.

Choose built-in programs in the studio, or add PNG/JPEG/WebP/GIF/MP4/WebM media up
to 80 MB. Pick a target (main, left, right or booth), preview it, then **Apply
screens to OBS**. Active automatic displays pick up saved changes within five
seconds; hidden sources load them when opened. Videos play silently, repeat,
pause with the preview, and release on document teardown. Images and videos keep
their aspect ratio. Wall-sign text is editable under the display disclosure.

The shared library is `C:/StreamingMedia/SpiritLobby/ScreenMedia/catalog.json`.
Imports receive unique names and leave originals untouched. Removing a library
entry keeps its imported copy and resets affected displays to their built-in
choice. Unknown fields and malformed personal entries survive edits; malformed
catalogs raise an error rather than being reset. Display edits snapshot project
settings plus the catalog into external settings history under `_spirit_lobby`.
Explicit choices/text in an OBS URL override saved defaults; the originally
installed URLs follow saved defaults automatically.

The project web directory remains at its original F: path through a junction to
`C:/StreamingMedia/SpiritLobby/2026-10-03/web`. Original unused plate copies were
preserved in `C:/StreamingMedia/SpiritLobby/2026-10-03/original-plates`.

## Preview and OBS

Open http://127.0.0.1:7420/spirit-lobby/studio.html with this checkout's Hub running.
The studio edits the sign, colors, projector, light level, speed and quality.
Default rendering is native 1920 x 1080 at 30 fps. Low uses 1440 x 810 at 24 fps.
The dotted guide is only a browser preview of the camera position.

OBS scene **Spirit Afterparty** keeps **FaceCamWithProps** between **Hub Spirit
Afterparty** (scenery) and **Hub Spirit Afterparty Foreground** (console/lights).
Camera settings, its filters, other scenes and audio controls are preserved.
If the camera shows Parsec's home screen, resume the usual camera feed in Parsec.
Copy both matching URLs from the studio when changing colors, opacity, motion
or quality. Those links follow the shared screen library. Apply screens saves
messages and media for both layers; unsaved preview controls do not write to OBS.
Each source shuts down when hidden and refreshes when activated.
Each document owns one bounded loop and catalog refresh, and releases media
and pending work on hide/page teardown.

## Party actions

The room now runs its own party by default. **The party runs itself** selects
Easygoing, Lively, Extra lively or Manual only. The original moving lights,
penguins and galaxy keep the room animated throughout. Automatic surprises have
an organic pace: novelty-weighted choices, varying gaps, occasional companion
entrances, overlaps and quieter stretches. Larger moments get more space, and
manual button bursts soften new automatic arrivals. There is no required number
of simultaneous effects. The existing engine admission budget only protects
rendering under excessive manual button presses.

Ten additional surprises bring the collection to eighteen: warm floating
lanterns, disco jellyfish, paper planes, a drink-carrying roller robot, a toy
portal, party balloons, neon pinball, firefly constellations, a winking moon and
ceiling fireworks. The earlier duck parade, UFO, records, bubbles, shooting
stars, flowers, confetti and penguin waves remain available. The base penguins
already wave continuously; the extra hello-star wave is a manual accent.

The rhythm control changes the preview and copied URLs. Existing installed
sources pick up Lively automatically after refresh because it is the default.
Copy the matching scenery/foreground URLs to OBS when choosing another rhythm.
Each visible lobby joins a shared wall-clock party. Different open previews do
not broadcast or multiply automatic surprises. Both OBS layers calculate the
same cue identities, variation seeds and ages locally; they synchronize their
ambient ages on each frame. Paused/hidden documents perform no scheduling work,
and resume into the current party instead of playing a backlog. Manual effects
keep their own clock and finish without automatic interruption. Cadence and
effect duration both honor the Motion control.

The studio's **Wake up the room** buttons add independent, finite animations.
Repeat a button or mix several: existing accents finish naturally. **Also play
in OBS** sends each press to the currently visible lobby sources using the Hub's
existing event transport. Turn it off for private previewing. **Clear preview
accents** only clears the studio preview. Actions are not stored or replayed when
an inactive lobby opens later; delivery older than four seconds is ignored.

| Key | Action |
| --- | --- |
| W | Hello stars and penguin waves; extra waves queue and alternate flippers |
| Space | A fresh rainbow confetti burst |
| B | Iridescent bubbles that pop into stars |
| U | A tiny UFO lifts a party duck, returns it and leaves |
| V | Spinning records orbit from the booth |
| S | Rainbow shooting stars burst over the room |
| N | Neon vines grow curling flowers around the edges |
| D | Bouncing ducks parade across the floor in party hats |
| L | Warm floating paper lanterns |
| J | Disco jellyfish |
| P | Paper-plane flights |
| R | A roller robot carrying a drink |
| O | A portal spilling tiny party toys |
| A | Swaying party balloons |
| I | Glowing floor pinball |
| F | Twirling firefly constellations |
| M | A winking moon blowing stars |
| X | Miniature ceiling fireworks |

These keys work outside text fields in the studio and in OBS's Interact window.
Foreground accents avoid the camera opening. Each press receives its own seeded
variation and start time; server echoes are deduplicated. Admission is bounded
to 24 accents and 1,600 drawing units; if full, the next press is declined without
removing any existing animation. Waves on the same characters take turns while
their decorative stars overlap. One frame loop draws all accents and releases
them on expiry/teardown; no audio, hooks, timers or workers are added for them.

`spirit_lobby/action-catalog.json` owns button labels, keys, stages and lifetimes.
`celebration.js` owns admission, timing and cleanup; the three `party-*` artists
draw the different effects. `action-link.js` reuses `/api/events` and sends cues
to the stateless public `/api/spirit-lobby/action` adapter. The route requires a
normal Hub restart; static artwork edits load with a source refresh.

## Maintenance

With streaming and recording stopped:

```powershell
py -3.11 tools/install_spirit_lobby_obs.py --camera-stage
py -3.11 tools/check_architecture.py
py -3.11 -X utf8 tools/run_offline_tests.py tools.test_spirit_lobby
node tools/test_spirit_lobby.cjs
py -3.11 -X utf8 tools/run_offline_tests.py tools.test_spirit_actions tools.test_spirit_screen_library
node tools/test_spirit_party.cjs
node tools/test_spirit_autoparty.cjs
py -3.11 tools/verify_spirit_party_obs.py --automatic
```

Static edits use the existing Hub server immediately. HTTP adapter changes need
a normal restart of this checkout's Hub; they add no new service.
The installer snapshots settings externally, uses shared OBS transport, adds only
missing resources and preserves personalized reruns. It never selects program.
Finite browser QA checks all ten emotes and wraparound, two characters, removed
artwork requests, solid character interiors, original room/booth loading, full-HD rendering, foreground camera alpha and opaque console,
controls, pause/resume, mobile width, real image/video imports, automatic saved
selections, preserved removals and bounded galaxy cache. Native OBS QA uses temporary Studio preview
and restores only its own preview while checking scene/source/filter/fader preservation.
Review frames and videos stay at `C:/StreamingMedia/SpiritLobby/2026-10-03/review`.

Classic sprite provenance and original source commit are in `art/penguin-frames.json`:
https://github.com/Gabiworld/assets-yukon/tree/af587035c16206fe5f6048f994c589ccbbbcad3d/media/penguin

## Verification record

The October 3 screen-library change passed focused library/installer checks and
browser/HTTP QA (real disposable image/video imports, all four display choices,
shared selection following, uniform translucency, alternating waves, loop-seam
comparison, galaxy evolution and bounded cache). The full offline run executed
905 tests and had two failures outside this change: transition WAV MIME spelling
(`audio/wav` versus `audio/x-wav`) and League border duration (`2` versus `.8`).
The workflow checker also reports ongoing changes in other feature owners; lobby
proofs are reviewed separately. Logs and captures are in the C: review folder.

The party-action change passed 15 focused offline tests, the architecture check
(397 modules, zero violations), the existing complete lobby browser regression,
and dedicated overlap/HTTP/SSE browser QA. Independent start times and expiry,
unique variations, echo deduplication, queued alternating waves, admission without
cancellation, all eight artists, two-layer delivery, stale-cue rejection,
resource cleanup, mobile controls and clear foreground camera alpha were checked.
Native off-air OBS screenshots show simultaneous effects, including two confetti
bursts, while preserving program scene, source settings, filters and faders.
The finite preview MP4 was fully decoded for verification. All three lobby
workflow proofs are reviewed; the global workflow check still flags concurrent
changes in other owners. Captures: `party-qa.json`, `obs-party-qa.json`,
`party-combination.png`, `obs-party-native.png`, `spirit-party-preview.mp4`.

The autonomous-party change passed 15 focused offline tests, the architecture
check, the full lobby browser regression, the manual overlap/HTTP/SSE regression,
and dedicated autonomous/visual QA. Thirty simulated minutes per rhythm selected
all seventeen automatic accents with varying counts and nonrepeating phrases;
the base penguins supply the eighteenth continuous/manual wave action. Layer
identities, seeds and ages match despite different scene clocks. Motion extremes
change cadence, manual bursts retain their start times, caches stay bounded,
pause/manual-only/cleanup behave correctly, and all ten new artists render.
The real no-button preview ran for 36 seconds and discovered eight different
surprises. Reports are `autoparty-qa.json` and `spirit-autoparty-preview.mp4`.

The first native automatic OBS frame rendered UFO, shooting stars and balloons
with no action cues. Its foreground keeps the camera transparent and the booth
opaque. Extended native verification was interrupted by an OBS WebSocket plugin
crash in its scene-query handler during the Studio-mode change. OBS subsequently
restarted on Lobbies with Studio mode off and no owned preview active; full native
verification did not complete. The maintenance tool now requires Studio mode to
already be enabled, preserves recovery intent on an unavailable connection, and
does not automatically toggle it. Browser verification remains independent of
OBS. The four lobby workflow proofs are reviewed; global workflow warnings belong
to concurrent changes in other owners.

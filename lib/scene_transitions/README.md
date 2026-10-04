# Spirit scene transitions

OBS uses **Hub Spirit Transitions** in the `live_duplicate` collection. The Hub's
**Tools > Spirit Transitions** opens the read-only preview at
`http://127.0.0.1:7420/transitions/`. Each performance has a separate WebM; the combined
showcase is only a review artifact. Media generations are versioned; OBS transition
Properties shows the currently loaded directory. Each per-animal revision exports
to its own versioned directory; the cumulative bear-tear delivery is
`C:/StreamingMedia/Transitions/udyr-spirits-v18-bear-tears/production`.
The earlier phoenix delivery remains archived in `udyr-spirits-v17-phoenix-flight`.
Lossless masters, sample frames, QA recordings and the review showcase remain
in the parent version folder. Production clips use a high-quality VP9 encode with
unchanged Opus audio; `quality-validation.json` records SSIM against each master.

## Animation modules

| Spirit | Entrance | Coverage and reveal |
| --- | --- | --- |
| Bear / Stormclaw | Accepted four-legged approach and yaw, camera-facing ready pose, left/right/left viewer-facing swipes | Each swipe immediately opens a lasting storm tear behind the bear; accumulated cuts expand to full coverage, then release diagonally |
| Turtle / Verdant Aegis | Heavy four-legged walk; neck/shoulder brace before three incoming rocks | Reactive hex wards destroy the first two rocks; the third block expands into full coverage, then hex tiles release |
| Ram / Sundering Gold | Running approach, airborne bound, compression and accelerating horn-first charge | Twin horn pressure fronts form obsidian glass, then scatter it |
| Phoenix / Cinder Ascension | Frostfire feather/egg rebirth; four flight views, layered articulated wings, moving talons and lagging tail | The wing-contact power stroke releases a gritty ice/ember ash storm, then its burning edge erodes upward |

Original artwork under `F:/EVERYTHING STREAM RELATED/Assets/VisualAndAudio/sprites`
is preserved. New transparent artwork is in `web/assets`. Prompts/provenance are
in [ASSET-PROMPTS.md](ASSET-PROMPTS.md) and [BEAR-RIG-PROMPTS.md](BEAR-RIG-PROMPTS.md).
The retained gritty art, selected assets and prompts are in [V5-ART-PROMPTS.md](V5-ART-PROMPTS.md).
The rejected stylized v4 studies remain documented in [RIG-ART-PROMPTS.md](RIG-ART-PROMPTS.md).
Version 8 follows the user's correction: restore the gritty painted artwork for
bear, ram and phoenix; redesign only the turtle to match that set. The exact v5
bear and phoenix atlases and original ram-charge sheet are restored from verified
archives. No new bear, ram or phoenix character images were generated.
[V8-ART-PROMPTS.md](V8-ART-PROMPTS.md) records the new gritty turtle atlas and built-in
image-generation prompt. The turtle keeps its ancient shell, robe, staff and jade
identity with natural eyes, weathered scales and subdued lighting.

Version 9 redesigns only the bear. Its original complete four-legged gallop poses
lead into a new low three-quarter chassis with painted hind legs and two continuous
foreleg meshes. One forepaw remains planted throughout each strike. Each raised
paw winds up, strikes in 140 ms, then returns to its planted position; scratch
geometry follows the same contact path. Both performances mirror this anatomy.
[V9-BEAR-ART-PROMPTS.md](V9-BEAR-ART-PROMPTS.md) records the new atlas and exact prompts.
The six accepted turtle, ram and phoenix production clips are copied unchanged
from v8. The full preceding web source and implementation are preserved under
the v9 folder's `before-v9` and `previous-implementation` directories.

The phoenix wing uses an integrated curved centreline rather than one rigid
rotation. Ram impact and phoenix fire read the same painted contact geometry used for
rendering. Cover materials, safe per-animal cut settings, audio, atomic asset
loading, random selection and separate clips remain intact.

Rejected v7 sculpture code is retained as a historical study. Its unused textures
and Three.js builds are archived at `C:/StreamingMedia/Transitions/udyr-spirits-v8/archived-v7`
to keep the nearly full project drive available. The complete preceding web source
is at `C:/StreamingMedia/Transitions/udyr-spirits-v8/before-v8`, and complete v7
implementation/media remain in the v7 folder. Historical dimensional rendering
requires restoring its archived textures/vendor files before use.
Unused v4/v5 sheets remain at `C:/StreamingMedia/Transitions/udyr-spirits-v7/archived-rig-studies`;
the gritty ram/phoenix sheets remain active without altering those backups. The
unused upright v5 bear atlas is retained under the v10 `unused-v5` folder and its
complete `before-v10` backup. All previous exports remain preserved.
Original v3 source is backed up under `C:/StreamingMedia/Transitions/udyr-spirits-v3/source-backup`; v4 is
preserved under `C:/StreamingMedia/Transitions/udyr-spirits-v4/source-backup/web`. The complete v5 web
source is preserved on C: at `C:/StreamingMedia/Transitions/udyr-spirits-v5/source-backup`.

- `web/bear.js`, `turtle.js`, `ram.js`, `phoenix.js`: independent choreography.
- `web/catalog.js`, `timing.json`: palettes, seeds and per-animation timing.
- `web/motion.js`: recoil and camera impact cues.
- `web/performance.js`: deterministic Hermite motion tracks and coordinate transforms.
- `web/rigs/egg.js`: phoenix egg artwork, shell fracture geometry and fragment motion.
- `web/characters.js`: thin painted-actor dispatch, normalized contacts and owned asset release.
- `web/rig.js`, `mesh.js`: authored atlas extraction, continuous skin/limb mesh and contact shadow.
- `web/rigs/{bear,turtle,ram,phoenix}.js`: separate gritty anatomy, acting and painted contact contracts.
- `web/rigs/bear/{art,calibration,motion,skin,turn,presentation}.js`: asset selection, anatomy/bone geometry, contact paths, landmark-based paint, registered yaw views and presentation respectively. Bear public facades remain thin.
- `web/rigs/phoenix-motion.js`: retained smooth wing timing contract.
- `web/rigs/atlases.js`: authored separation regions; turtle selects its separate v8 atlas.
- `web/dimensional/`: inactive historical v7 sculpture study.
- `web/atmosphere.js`: deterministic water, dust and fracture accents.
- `web/renderer.js`: isolated layers, coverage masks and transparent boundaries.
  Asset loads publish one complete generation; quick selections reject stale
  loads. Coverage returns whether a mask exists, so empty masks skip material work.
  Stale/failed generations release painted resources; page exit releases the
  preview. There are no animation timers in the painted anatomy modules.
- `web/fx.js`, `coverage.js`, `flame.js`: particles, fractures, hexes and fire.
- `web/preview.js`, `index.html`: read-only controls and timeline.
- `sound_design.py`: deterministic stereo sound beds and synchronized impacts.
- `native/spirit_transition.c`: OBS compositing, playback, cut and audio.
- `native/playback.h`: independently tested shuffled-bag policy.
- `native/clock.h`: atomic playback epochs and monotonic position shared by video/audio.
- `hub_ui/routes/transitions.py`: contained static asset delivery.
- `installation.py`: pure collection patch and active-file selection policy shared by the two finite maintenance adapters; OBS's configured filename disambiguates collections sharing a name and must match that name. Preserves unrelated personal data, levels and valid individual cut choices.

Version 10 calibrates the bear's dimensions, joints, depth ordering and planted
stance, adds intermediate turn views and synchronizes paw/effect contacts with
impact beats. [V10-BEAR-REVIEW.md](V10-BEAR-REVIEW.md) records findings, calibration,
visual review and the exact new atlas prompt. Other animals remain unchanged.

Version 11 retains that accepted approach and uses the original complete frontal
ready/swipe artwork for attacks toward the viewer. [V11-BEAR-FRONT.md](V11-BEAR-FRONT.md)
records the two new frontal owners, projection/contact checks and independent
versioned export commands. Its bear outputs are in
`C:/StreamingMedia/Transitions/udyr-spirits-v11`.

## Configure each animation's scene cut

In OBS, open **Hub Spirit Transitions > Properties**. Each animal has a separate
**scene cut (milliseconds)** setting. Changes apply to its next playback; an
in-progress animation keeps its original cut. Values are constrained to the
verified fully opaque interval with a 50 ms safety margin at each end.

Authoring defaults live in `web/timing.json` under `animations`. Each spirit has
`cut`, `coveredFrom`, and `coveredUntil`, in seconds. The export manifest carries
these values, and `tools/install_spirit_transitions.py` installs them as
`<spirit>_cut_ms`, `<spirit>_covered_from_ms`, and `<spirit>_covered_until_ms`.
The Hub preview and showcase use each spirit's authored cut. OBS Properties can
adjust the live cut within the verified interval without rebuilding the media.

Current clips are 1920x1080, 60 fps, 6.6 seconds. Every pixel is opaque from
3850 to 4250 ms. Default cuts are at 4050 ms of media playback, and the editable
range is 3900 to 4200 ms. The first and final frames are transparent.

The native compositor follows media playback position rather than OBS elapsed
transition time. This accounts for decoder startup lag. The next queued media
PTS is reduced by one frame as a margin. Asynchronous restarts reject a previous
clip's stale end position until the new playback clock resets. Playback position
cannot rewind when the media finishes, so the old scene/audio cannot flash back
during OBS's final tail. Late samples from a previous start are rejected by an
atomic playback epoch. Scene audio uses
the same cut decision as scene video.

After changing cover choreography, re-export and verify the encoded alpha plane
before setting its covered interval and reinstalling. Never invent an opaque
interval from appearance alone. A cut adjustment inside the existing verified
interval needs no re-encoding.

## Playback ownership

Eight private fixed-path media children are owned by the native OBS transition.
Each actual start stops an interrupted child and selects a fresh shuffled spirit.
Every bag contains all four spirits; adjacent repeats across bags are prevented.
Each spirit alternates its two performances from a randomized initial choice.
Two complete bags therefore show all eight performances. Base files are
`bear.webm`, `turtle.webm`, `ram.webm`, `phoenix.webm`; alternate files use `-alt`.
Completion only stops the child. There are no idle timers or end-of-video path
changes. The old `random_spirits.lua` remains for historical recovery, disabled.
Never enable it alongside the native selector.

OBS owns playback for 6.85 seconds including the tail. Software VP9 decoding
preserves alpha, and full-frame preloading is disabled. No browser source is
added to user scenes. The Hub can close while OBS playback continues. Selecting
another OBS transition disables spirit playback. Scene overrides and Studio Mode
quick-transition rules still apply.

Camera cues are mirrored in native C and the showcase builder; synchronize them
with `web/motion.js` and sound-design impact times. Sound peaks near -10.8 dBFS.
No existing master or per-asset faders are changed. Recording/replay storage
remains `C:/StreamingMedia/Replays`; historical v1/v2/v3 media is preserved.

## Rebuild and validate

From this checkout with Python 3.11 and the bundled Node dependencies:

```powershell
py -3.11 -m lib.scene_transitions.sound_design
$env:NODE_PATH = 'C:/Users/Michael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
node tools/verify_spirit_choreography.cjs
node tools/test_spirit_preview.cjs
node tools/test_bear_motion.cjs
node tools/review_bear_motion.cjs
node tools/review_bear_alignment.cjs
node tools/review_spirit_frames.cjs
node tools/render_spirit_transitions.cjs --preview-only
node tools/render_spirit_transitions.cjs
py -3.11 tools/optimize_spirit_media.py
py -3.11 tools/verify_spirit_media.py
py -3.11 tools/build_spirit_showcase.py
py -3.11 tools/check_architecture.py
py -3.11 -X utf8 tools/run_offline_tests.py tools.test_spirit_native tools.test_spirit_transitions
py -3.11 tools/verify_spirit_live.py --normal
py -3.11 tools/verify_spirit_live.py --studio
```

Append spirit IDs to render selected clips. `SPIRIT_OUTPUT` overrides the export
folder. Completed files replace exports only after lossless VP9/alpha encoding
succeeds. For a bear-only revision, preserve the other six clips and masters in
the new version folder, then render and optimize `bear bear-alt`. The optimizer
merges their quality results with the unchanged clips. Do not invoke the live QA
commands while the user wants OBS closed.

Bear motion validation checks logical support, planted paw positions, continuous
wind-up/strike/recovery, mirrored scratch attachment and the side-to-quarter turn.
Its dense contact sheets validate the painted layering separately.
Choreography validation checks every covered frame, progressive
reveals, uninterrupted approaches, velocity continuity, moving claw/paw contact attachment,
valid painted geometry, scrub-order reproducibility, egg/feather assets and wingbeat continuity. Dense motion contact sheets remain
necessary for visual review; numeric checks alone do not prove natural acting.
Encoded validation checks every pixel of all 25 opaque frames in each VP9 clip.
Motion contact sheets live in `review/`; individual `*-preview.mp4` files are
separate review videos. `Spirit Showcase.mp4` only combines those for comparison.
Native policy tests exercise 199,600 starts. Lua tests cover recovery code only.
Collection policy tests preserve personal source/filter/transform data, transition
volume, unknown fields, unrelated scripts, manually selected transitions and valid
individual cut choices; incomplete manifests are rejected without mutating input.
Regular-mode QA checks every interruption request starts a new native playback.
Studio Mode can coalesce requests during an active transition; its QA checks
complete presentations, coverage and stable tails. Native shuffle/epoch tests
exercise every actual start independently of OBS's request coalescing.

Live lifecycle QA tests all eight performances, rapid switching and idle tails against temporary colored
scenes. Timing QA records synthetic scenes and checks every decoded frame around
coverage/reveal for premature destination colors. Both require inactive streaming
and recording. Take timestamps use OBS's captured-frame recording clock after
encoder startup, so asynchronous recording startup cannot shift the measurements.
Live reports also record render/encoder skipped-frame deltas and reject runs
above 0.5% missed frames; inspect these separately from the authored motion.
A multi-stage observed `SceneSession` returns only while it still
owns the presentation; external scene choices are preserved. Inactive temporary
scenes are removed. Validation
JSON and synthetic media are saved beside the exports.

## Install and recover

When the user leaves OBS closed, keep it closed. After encoded validation, run
`py -3.11 tools/install_spirit_transitions_offline.py`. It checks OBS is absent,
matches each clip's SHA-256 and opaque interval to its validation report, reads the
saved active collection from `user.ini`, snapshots settings, and atomically updates
only the already installed transition and disabled legacy script. It preserves the
selected scene/transition and never connects to or launches OBS. The next OBS
launch creates native media children from the new directory. Live normal/Studio
QA remains pending until the user reopens OBS; an offline saved-file update cannot
confirm live rendering or performance.

For duplicate collection names, the closed adapter uses the configured filename
and verifies its internal name. The open adapter also verifies OBS's loaded media
directory after reloading. OBS can cache a different duplicate in its menu: use
the exact filename recorded by its latest `Switched to scene collection` log entry
through `install(collection_file=...)`. Never guess or update all personal copies.
For an existing media revision, pass `update_existing=True` to preserve a manually
selected transition such as Move. The adapter briefly selects the native source
only to inspect its loaded directory, performs no scene take, and restores the
selector only while it still matches the adapter's temporary choice.
Both adapters accept an explicit `media=` production directory. A revision can
install its validated assets without changing another revision's tool default.

See [native/README.md](native/README.md) for build dependencies, DLL location,
licensing and OBS integration. Install an updated DLL while OBS is closed, restart
OBS and confirm `hub_spirit_transition` is available.

Snapshot `SettingsBackups().snapshot()`, stop this checkout's Hub and keyboard
child, then run `py -3.11 tools/install_spirit_transitions.py`. The installer uses
`Hub Spirit Setup` to save the current collection, backs it up, changes only the
owned transition and Lua entry, then restores the original collection. Sources,
groups, filters, transforms, levels and unrelated scripts are preserved. Failure
restores the exact pre-install collection.
Hold the public `lib.single_instance.hub_instance` ownership while installing
with OBS open and during finite live QA so another Hub cannot start during a
collection reload. Do not use the open-OBS adapter when the user wants OBS off.

Restart this checkout's `hub.py --no-browser` in a hidden window. Verify the Hub
UI, selected modules and exactly one keyboard child. Settings recovery copies are
outside the repo under `%LOCALAPPDATA%/StreamingHub/settings-history/.../_spirit_install`.
Never delete settings history or restore an older master volume as a side effect.

Additional unused generated pose studies are archived without deletion under `C:/StreamingMedia/Transitions/udyr-spirits-v8/unused-previous-studies`. Active assets and the public bear preview image remain in the workspace.

Version 12 replaces only the turtle with the armored creature in the user's siege reference.
Its five rig owners keep painted joints, fixed bones, planted soles and depth order explicit.
Separate projectile/shield owners share exact impact coordinates for three rock blocks.
The third ward grows into the existing safe cut plateau; two new independent turtle
clips and audio are exported on C:. [V12-TURTLE-REVIEW.md](V12-TURTLE-REVIEW.md) records
calibration, responsibilities, exact built-in image prompt, provenance and checks.
Other animals' encoded files are preserved from the latest verified generation.
Use `SPIRIT_OUTPUT=C:/StreamingMedia/Transitions/udyr-spirits-v12` for finite render/
choreography validation and select only `turtle turtle-alt`.


Version 13 refines only the turtle's rig and performance. Entire near limbs paint
in front of the torso, far limbs behind, and all four roots bind to deformed torso
UV landmarks. The crawl ends at 2.96 s; the first rock launches at 0.06 s and the
first two blocks occur during approach. The settled turtle charges at 3.02 s;
its curved hex dome grows during the final projectile's flight, then surges into
the same verified 3.85–4.25 s opaque plateau. Cut remains configurable per animal.
`web/turtle/dome.js` owns curved lattice and luminous current optics separately
from shield timing and the exact solid alpha mask. See [V13-TURTLE-REVIEW.md](V13-TURTLE-REVIEW.md).

Version 15 updates only bear paint to the approved hardcore storm-bear concept.
Four separate registered atlases retain the accepted walking, turning and alternating
camera-facing swipes, with charcoal fur, silver-tipped mane and reflective steel claws.
`V15-BEAR-STORM.md` records sources, calibration, prompt directions and recovery.
Use `SPIRIT_OUTPUT=C:/StreamingMedia/Transitions/udyr-spirits-v15` with selected
`bear bear-alt` exports; `tools/test_bear_storm.cjs` checks the unchanged approach
choreography against the immutable pre-revision source and painted claw attachment.


Version 14 rebuilds turtle anatomy from one intact gritty siege-creature painting.
Its four registered limb regions share the source body's shoulders and hips;
upper collar paint is retained, complete claw pads move together, and far/body/near
occlusion replaces detached atlas limbs. The rock now leads the first 0.92-second
block while about 3% of the turtle is on screen. A second 1.94-second block occurs
during approach. After stopping at 3.03 seconds, the turtle charges a weathered
jade-stone hex ward with primordial carvings, golden fissures and a broken rim.
The third block expands into the unchanged verified cut interval. All new raster
and audio assets are saved in this checkout; exports and build caches stay on C:.
[V14-TURTLE-REVIEW.md](V14-TURTLE-REVIEW.md) records owners, exact built-in image
prompts, reference roles, choreography and verification requirements.

Turtle gait refinement keeps the accepted v14 art and choreography while adding
whole-leg knee articulation and rigid claw pads. Its export directory is
`C:/StreamingMedia/Transitions/udyr-spirits-v15-turtle-gait`, separately owned from
the v15 bear delivery. See [V15-TURTLE-GAIT.md](V15-TURTLE-GAIT.md) for owners and checks.

Version 16 updates only the phoenix to a gritty frostfire-and-ash creature with four
used camera views, dorsal/ventral wing paint, independently articulated talons and
a flowing tail. Its wing contacts drive the new cold-fire/ember storm and retain
the 4.05 s configurable cut. [V16-PHOENIX-REVIEW.md](V16-PHOENIX-REVIEW.md) records
owners, art provenance, exact prompts, visual evidence and rebuild/installation.
Use `SPIRIT_OUTPUT=C:/StreamingMedia/Transitions/udyr-spirits-v16-phoenix` and
select only `phoenix phoenix-alt` when rendering, optimizing and reviewing.

Version 17 corrects whole-character turning with complete quarter/profile/rear
flight paintings. The egg splits and lingers, the bird exits/re-enters at the side
and bottom, and two central wing brush strokes cover and reveal outward.
[V17-PHOENIX-FLIGHT.md](V17-PHOENIX-FLIGHT.md) records assets, exact prompts, owners,
projection limits and verified timing. Export only `phoenix phoenix-alt` to
`C:/StreamingMedia/Transitions/udyr-spirits-v17-phoenix-flight`.

Ram revision 19 adds true rear turn angles and complete crouch, push, tuck and
landing paintings. It turns before its leftward jump and faces each direction
of travel. [V19-RAM-MOTION.md](V19-RAM-MOTION.md) records art, owners and rebuild
checks; exact built-in ImageGen prompts are in `RAM-MOTION-V19-PROMPTS.json`.

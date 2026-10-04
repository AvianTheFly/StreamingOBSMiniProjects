# Turtle gait refinement

The accepted intact v14 turtle and ward paintings remain unchanged. This revision
corrects the toe-only crawl: the former skin pinned every point above the knee,
and the body mask retained most of that static upper-leg painting.

`web/rigs/turtle/joints.js` now solves each registered root, knee and foot target
as a two-bone chain. Reach extension is continuous for the perspective-shortened
far legs. `skin.js` follows both segments, retains rigid claw pads below calibrated
ankles, and moves the belly's shoulder socket with its attached tissue. Roots stay
bound to the breathing/recoiling body. `art.js` retains only the shoulder/hip
collars, with a tightened front-leg region that excludes neighboring belly paint.
Far legs remain behind the body and near legs in front. No new raster artwork,
worker, native plugin change, OBS source controller or shared runtime is introduced.

The diagonal contact paths, travel, stop/brace, all three rock impacts, audio,
shield and 3.85–4.25 s opaque plateau are unchanged. Default cut remains 4.05 s;
existing valid per-animal timing settings remain personal data.

Use the distinct output directory
`C:/StreamingMedia/Transitions/udyr-spirits-v15-turtle-gait`, which is separate from
the version-15 bear artwork delivery. Set `SPIRIT_OUTPUT` for the finite renderer,
optimizer, media validator and showcase; export only `turtle turtle-alt`. Preserve
the other six clips from the currently installed generation and compare SHA-256
before installing through the existing maintenance adapter.

`tools/test_turtle_motion.cjs` checks visible knee and upper-leg displacement and
knee-angle variation on every leg, rigid foot geometry, exact root/sole binding,
world-space planted contact and actual painted triangle orientation at 120 Hz.
It also checks the rock-first opening, all collisions and every cut-frame pixel
for both variants. `tools/review_turtle_motion.cjs` produces enlarged actor and
dense choreography sheets. Run the generic choreography and preview checks,
architecture check and focused offline transition/native tests before delivery.
Encoded files must undergo the complete alpha/decode/quality checks independently.

Install with an explicit media directory, preserve the user's selector and program
scene, and never start/restart OBS. Restart only the supported Hub hidden when
required; preserve Footage Desk and verify one keyboard child. Backups and QA
evidence belong beside this separate export; settings history stays outside the repo.

Delivery checks passed: 736,368 painted triangles remained positive; all four
knees and upper legs moved, knee bend varied by more than one radian, and root,
rigid-foot and planted-contact error was effectively zero. Production SSIM was
0.996469 / 0.996458; all eight clips decoded to 396 frames, with all 25 full-size
opaque frames verified. Other six encoded clips match their original SHA-256.

OBS took about 54 seconds to finish reloading this collection, exceeding the
maintenance adapter's ten-second request timeout. Do not repeat a collection
reload while the first frontend operation is pending. The subsequent independent
inspection confirmed the new native directory and all four 4050 ms cuts, and
restored the Move selector. The delivery audit uses the actual external backup
and checks personal source/settings preservation; the saved scene choices and
freshly observed live scene are reported separately. No native scene take or
OBS restart was performed. The correct Hub and one keyboard child are ready;
Footage Desk remains running. See the export's loaded/delivery validation reports.

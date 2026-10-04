# Storm bear artwork, delivery 15

The user approved the single dark-fantasy lightning-bear concept, including its
metallic claws. This revision changes bear paint only. The accepted walking path,
gallop cadence, view handover, three impact beats and follow-through remain intact.
Each bear variant remains a separate 1920x1080, 60 fps alpha WebM; the MP4 files
are review exports over synthetic scenes. Other animals are preserved from the
actually loaded native generation before installation, including their cut data.

## Artwork and responsibilities

`web/assets/bear-storm-{run,turn,rig,front}-v14.png` are four independent generated
transparent paint atlases. Their filenames identify the artwork study; version 15
identifies this delivery. `rigs/bear/art.js` owns atlas selection and masks. The
left crossing-swipe crop excludes neighboring ready-pose/alternate-pose fragments.
`calibration.js` owns the quarter body's measured 653/540 aspect ratio.
`front-motion.js` owns the complete frontal poses' measured 435/433, 401/387 and
430/396 ratios and projected claws. The existing paint, presentation and motion
owners retain their lifetimes and choreography. No worker or runtime resource is added.

All four sets use charcoal fur, a jagged silver-tipped mane, bright storm fissures
and reflective dark steel claws with silver bevel highlights and blue electrical
edges. These are painted metallic materials, not a physical 3D metal simulation.
The existing storm-cover material, soundtrack and full-opacity interval remain.
The scene cut remains configurable per animal, with the default bear cut at 4.05 s
inside the verified 3.85-4.25 s opaque plateau.

## Generation prompts and provenance

Mode: built-in imagegen, true transparent background. Each call used its original
production atlas as the edit target and the user's approved concept as a style
reference. The full concept and original generated PNGs are preserved under
`C:/StreamingMedia/Transitions/udyr-spirits-v15/generated-art/`. Original source
is preserved in `before-v15`; original bear art remains recoverable there and in
`archived-unused-art`. Large exports stay on C: because the workspace drive is full.
Two historical debug JSON exports were moved intact into `archived-debug-exports`
to permit workspace writes. Personal settings and media paths were not changed.

Shared prompt direction for all four calls: repaint to a hardcore primal
dark-fantasy storm bear, charcoal-black rugged fur, sharp silver-tipped storm mane,
massive sculpted anatomy, weathered snarling/angular muzzle, fierce icy-blue eyes,
restrained blue-white branching electricity. Every claw has a polished dark
forged-steel core, sharp silver bevel highlights and a thin electric-blue edge;
avoid entirely neon claws. Premium gritty cinematic hand-painted fantasy materials.
Preserve the edit target's exact pose count, grid, orientation, positions, silhouette,
proportions, anatomy and paw/claw endpoints. Transparent background and gaps;
no ground, dust, shadows, text, borders, armor or weapons. Electricity hugs each
sprite and cannot bridge cells. Atlas-specific constraints:

- Front: preserve the eight poses in two rows of four, especially complete lower-row
  quarter arrival, frontal ready, left crossing swipe and right crossing swipe.
- Run: preserve four distinct right-facing quadruped gallop phases in a 2x2 grid.
- Turn: preserve four quadruped poses and each view's distinct head yaw in a 2x2 grid.
- Rig: preserve upper-left torso/rear legs, upper-right torso without forelegs,
  lower-left complete near foreleg and lower-right complete far foreleg. Never
  add missing limbs to the torso or alter joint registration.

## Validation and rebuild

Set `SPIRIT_OUTPUT=C:/StreamingMedia/Transitions/udyr-spirits-v15`, use the README
commands with `bear bear-alt`, and keep other six encoded clips from the latest
installed generation. `tools/test_bear_storm.cjs` compares 397 samples of both
accepted arrival variants, gait, view weights and strike beats against `before-v15`;
it also checks native ratios, non-folding projection, actual visible claw paint,
mirrored contacts, stable support and retained follow-through. Pixel equality to
the old art is deliberately not claimed. The previous pixel-comparison test
remains as historical version-11 evidence.

Enlarged normal/alternate turn and attack sheets belong in `review/`. Encode
validation must check every pixel of all 25 opaque frames, exact clip hashes and
transparent boundaries. Installation uses the existing maintenance adapter,
settings snapshot and Hub instance lock; preserve the live selector and program
scene and never start or restart OBS. Restart only this checkout's Hub hidden,
preserving Footage Desk and verifying one keyboard child.

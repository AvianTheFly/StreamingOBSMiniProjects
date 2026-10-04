# Phoenix whole-character turn and twin wing strokes

The quarter/profile flight now uses complete paintings with their own turned
wings, tucked talons and tail. A true rear camera supplies the away-facing bird.
The frontal rise and final wing stroke keep the articulated frontal rig. The egg
splits into two jagged halves, settles beneath the hatchling, and fades away. The
bird exits the side, returns across the screen, dives below it, and rises into its
central power stroke. Both direction changes happen wholly outside the viewport.

Two painted inner-wing contacts near the center of the screen release curved,
feather-edged brush fronts. The cold-fire/ember/ash storm remains separate from
the solid mask. After full cover and the configured scene cut, two openings bloom
outward from those same release spots. There is no vertical erosion line.

## Images and exact generation prompts

Mode: built-in imagegen. The preceding frostfire body and limb sheets are identity
and material references. Separate versioned originals remain in `web/assets/`:

- `phoenix-flight-v17.png`: complete quarter and profile birds, up/down extrema.
- `phoenix-rear-v17.png`: true rear flight, raised/spread wing extrema.
- `phoenix-quarter-study-v17.png`: retained unused quarter-view study; it did not
  provide the requested true rear camera and is not loaded by the renderer.

Exact prompts, reference roles, selected outputs and the rejected study's reason
are saved in `C:/StreamingMedia/Transitions/udyr-spirits-v17-phoenix-flight/generation-prompts.json`.
Copies of generated images live in `generated-art/`. The complete previous
feature and documentation remain in `before-v17/`; the original imagegen output
files and preceding exports are retained.

## Owners and projection limits

`rigs/phoenix/art.js` owns atlas extraction and four bounded buffers. `turned.js`
owns the complete-angle paints, torso registration, native aspect ratios and
continuous secondary feather/tail flex. Each pass uses one coherent painted
wing pose; the extra extrema remain available for future authored movement.
Short camera handoffs avoid long double-bird dissolves. `paint.js` composites
the complete angle; it does not paste frontal wings or legs over a turned body.
Only the frontal painting uses `projection.js` and its fixed-bone articulated
legs and continuously bending independent wings. This is authored painted
animation, not a complete physical 3D skeleton or six-frame wing cycle.

`phoenix/flight.js` owns the continuous path and off-screen direction changes.
`rigs/egg.js` owns shell splitting; `entrance.js` owns its linger/fade and hatch.
`phoenix/strokes.js` owns the two brush-shaped cover/reveal masks and curved
bristles; `veil.js` assembles them with the existing storm optics. Cast contacts
come from actual frontal feather paint. `phoenix_sound.py` owns the synchronized
flight whooshes and power-stroke storm score. No new global listener, connection,
worker or thread is introduced.

## Delivery and checks

Output: `C:/StreamingMedia/Transitions/udyr-spirits-v17-phoenix-flight/`.
Only `phoenix` and `phoenix-alt` are rendered. Each remains an independent alpha
WebM at 1920x1080, 60 fps, 6.6 seconds, with an individual review MP4. Latest
installed bear/turtle/ram clips are copied byte-for-byte, with a hash guard before
installation. Per-animal cut values and the selected OBS transition are preserved.
Full opacity stays 3.85–4.25 s, with the default cut at 4.05 s.

`test_phoenix_rig.cjs` checks the actual turned-paint draw calls and rejects any
frontal wing draw at the three complete turned angles. It checks non-folding
complete-pose deformation, native ratios, all four camera views, exact exported
PNG reproducibility, central feather contacts, resource release, and zero visible
bird pixels at both direction changes for both variants. Frontal rig geometry
checks cover fixed legs and attached painted wing/tail mounts. General choreography
checks progressive cover and center-out reveal, all opaque authoring frames and
a configurable cover hold. Encoded validation checks every pixel in all 25 safe
frames per clip and binds its results to the exact production hashes.

Set `SPIRIT_OUTPUT` to the delivery folder, render/optimize/review only
`phoenix phoenix-alt`, preserve the latest other six installed clips, and run
full encoded validation before the transactional installer. Keep user settings,
source filters, faders, transforms, recording paths and selected transition.
`install-validation.json` and `delivery-validation.json` record installation and
the completed checks; decode benchmarks are offline, not a claim about live OBS
playback. OBS crash recovery is owned by the separate shared-connection fix.

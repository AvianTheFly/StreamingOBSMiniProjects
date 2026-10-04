# Bear animation review and calibration, version 10

Only the bear is revised. The six accepted v9 production clips for turtle, ram
and phoenix are retained byte-for-byte. Native random selection, audio, media
clock ownership and per-animal safe cut controls retain their existing contracts.

## Findings and changes

- The v9 body was drawn at width 1.12 / height .72, wider than its native painted
  aspect ratio. Its calibrated width is now .92; the turn views use measured
  image proportions, with registered view widths and eyes during interpolation.
- Bounding-box limb bending did not identify the painted shoulder, elbow or sole.
  `calibration.js` now supplies source landmarks, body shoulder locations, fixed
  bone lengths, planted contacts and near/far perspective. `skin.js` maps the
  continuous paint onto those landmarks, rounds the elbow blend, and controls
  forepaw orientation separately so claws do not flip upward with the forearm.
- Shoulder caps are painted behind torso fur; the near lower leg has foreground
  priority. The far leg is behind the body with a smaller perspective width.
- The approach decelerates to a stable position and scale before the attacks.
  Planted paws stay still in screen coordinates; breathing/recoil affect the
  upper body rather than scaling or translating the grounded actor.
- Four complete intermediate yaw views replace the large side-to-quarter dissolve.
  Bounded view/mix canvases blend complete layers in premultiplied form; skin
  triangles retain ordinary compositing. Their lifetime belongs to the loaded
  Character asset generation and ends when it is disposed or replaced.
- Each .14-second strike begins .07 seconds before the existing 2.18 / 2.68 /
  3.18-second sound/camera impacts, putting peak paw speed on the impact beat.
  Charging arcs follow the current claw; impact sparks/dust use the midpoint
  contact; alternate performances mirror all of these coordinates.
- The cover expands from the new scratches far enough to cover every pixel by
  3.85 seconds. The 4.05-second cut and 3.85–4.25-second plateau remain unchanged.

## Evidence and rebuild

`tools/test_bear_motion.cjs` checks source-image/body aspect ratio, painted
shoulder/elbow/sole attachment, fixed bone lengths, bounded elbow angles,
world-space planted contacts, visible paint at claw contacts, finite deformed
mesh vertices, continuous contact paths and mirrored scratch attachment. These
checks support calibration; they are not a substitute for visual review.

`tools/review_bear_alignment.cjs` creates enlarged turn/strike sheets for both
variants. `review_bear_motion.cjs` creates full-frame dense motion sheets. Review
the individual videos at normal speed as well as their frames before delivery.
The full choreography check validates all covered pixels and deterministic
scrubbing; encoded validation checks every opaque frame of the compressed clips.

Outputs: `C:/StreamingMedia/Transitions/udyr-spirits-v10`. The complete pre-change
implementation is under `before-v10`. The unused upright v5 atlas is retained
under `unused-v5` and also in that source backup; no original sprite is deleted.

The live v10 update was installed in the observed `10326.json` collection. Move
and the Lobbies program scene were preserved. Only the native/Lua media directory
and native version metadata changed in the saved collection. The finite installer
waits for queued OBS frontend selector changes before checking loaded properties
and restoring the user's selection. No program-scene take is used for inspection.
`delivery-validation.json` records the preserved data and final Hub/OBS checks.

Run the existing README rebuild commands, selecting `bear bear-alt` for render,
optimization and review-video exports. Keep the other six files unchanged.

## Built-in image-generation prompt

Final project-bound transparent atlas: `web/assets/bear-turn-v10.png`.
Generated with the built-in tool from the v9 quadruped atlas and original gritty
side gallop sheet as references, inspected before selection. Original output:
`C:/Users/Michael/.codex/generated_images/01a0f7e9-178f-7131-bf3b-485f7b137ba5/exec-ed85b5f7-eca2-4ec1-95e7-cae6ef2a9cea.png`.
Authored separation polygons keep the top-left muzzle complete and exclude the
neighboring silhouette; registration belongs to the bear art/turn owners.

```text
Create an animation turn atlas for the SAME gritty electric grizzly in the two reference images. Reference 1 is the exact selected fur, low head, shoulder hump and three-quarter body identity; reference 2 shows its side-on four-legged gallop. Preserve realistic charcoal-brown shaggy fur, subtle electric-blue fur fissures, blue eyes, natural grizzly anatomy and detailed painted fantasy realism. Not cute, not toy, not humanoid. Transparent RGBA square, EXACT 2x2 equal cells with four COMPLETE FULL-BODY standing quadruped poses, no detached parts. All four bears have head low, stern closed mouth, long horizontal back, heavy shoulder hump and all FOUR natural legs, paws planted on the SAME level ground baseline within each cell. Exact same anatomical proportions, bear size and lighting in all cells. Four successive yaw angles turning from right-facing side profile toward camera: TOP LEFT pure right-facing side profile, TOP RIGHT 15 degrees toward viewer from profile, BOTTOM LEFT 30 degrees toward viewer, BOTTOM RIGHT 45 degrees toward viewer matching the first reference's top-left chassis, including its same face, head and body shape. The FULL near front leg must grow naturally from front shoulder behind cheek and reach to planted paw; far front leg is naturally slightly smaller due to perspective, behind the chest, also planted. Back legs belong under rear hips. No gigantic muscular human arms, no small hanging paws, no upright chest, no palms, no sockets or rings, no giant biceps or glowing shoulder outlines. Short natural claws pointing down and forward. Keep equal padding of transparent pixels, each bear completely inside its own cell, no shadow/backdrop/ground/dust/labels/grid. Maintain consistent feet and head sizes across all four views. This is one continuous right-to-three-quarter turn of the SAME animal, not four different character designs.
```

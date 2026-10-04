# Frostfire and ash phoenix, delivery 16

The original gritty bird identity remains: silver crown, dark hooked beak, layered
charcoal feathers and a hot ember core. New paint adds frost-blue outer fire,
silver ice edges, ash wear and clearer material detail. The flight now uses four
authored torso/head views, dorsal and ventral wing surfaces, two independently
articulated talon legs and a continuously bending tail. The normal performance
banks right and the alternate banks left; both return to a frontal power stroke.

## Artwork, prompts and recovery

Mode: built-in imagegen. Original phoenix hero/rig/egg artwork was used as the
identity reference. Four separate versioned assets are saved in this checkout:

- `web/assets/phoenix-views-v16.png`: front, quarter, profile and rear quarter bodies.
- `web/assets/phoenix-limbs-v16.png`: dorsal wing, ventral wing, complete talon leg, tail fan.
- `web/assets/phoenix-props-v16.png`: matching volcanic frostfire egg and solitary feather.
- `web/assets/phoenix-storm-v16.png`: opaque turbulent blue-fire/ember/ash material plate.

Copies and exact final prompts are in
`C:/StreamingMedia/Transitions/udyr-spirits-v16-phoenix/generated-art/` and
`C:/StreamingMedia/Transitions/udyr-spirits-v16-phoenix/generation-prompts.json`.
The complete pre-revision feature is in that delivery's `before-v16` directory.
Original art and earlier media are preserved. No existing user art is overwritten.

The generation direction is a hardcore gritty frostfire/ash phoenix with the
existing fierce raptor face, silver crown and black beak, charcoal soot-worn
feathers, frost-blue outer flame and warm molten seams. Matching view and limb
atlases keep one character identity, isolate continuous anatomy on real alpha,
and exclude labels, scenes, props, armor and weapons. The storm plate is opaque,
full-frame volumetric ash with cold fire and orange currents, without a bird or
empty portal center. Consult the exact prompt JSON before regenerating a part.

## Responsibility map

| Owner | Responsibility |
| --- | --- |
| `rigs/phoenix/art.js` | Atlas regions, largest continuous paint island/fringe, exact trims and bounded view buffers; tiny neighboring sprite fragments cannot enter a limb |
| `anatomy.js` | Native aspect ratios and per-view shoulder/hip/rump UV mounts |
| `motion.js` | Absolute-time view weights, yaw, asynchronous shoulder/elbow/wrist lag, leg tuck/extension and tail sway |
| `projection.js` | Shared painted mount/contact coordinates, continuous wing tangents, bounded perspective and foreshortening, fixed leg bones and tail deformation |
| `paint.js` | Far-wing/leg, body, near-wing/leg depth order; premultiplied camera/surface blending; wing/body/leg/tail paint |
| `web/phoenix/flight.js` | World trajectory and mirrored direction, retained hatch and power-stroke beats |
| `entrance.js` | Feather/egg rebirth, flight wake and hot/cold accents |
| `storm.js` | Continuously flowing storm plate, depth ash, cold/ember filaments and generation release |
| `veil.js` | Solid wing-contact coverage, progressive upward erosion and burning rim |
| `palette.js` | Consistent cold-fire, hot ember and ash colors |
| `phoenix_sound.py` | Finite phoenix-only sound: wing air, hatching, power stroke, storm and crystalline crackle |

`web/phoenix.js`, `rigs/phoenix.js`, `rigs/phoenix-motion.js` and `flame.js` stay thin
public/compatibility facades. Character loading publishes complete generations;
replaced/stale/disposed paint and storm resources are released. No OBS worker,
browser source, listener, thread or new global runtime resource is introduced.

This is articulated painted animation with an art-directed projection, not a
complete 3D simulation. A minimum wing silhouette width prevents collapse during
the edge-on bank. Continuous tangent interpolation avoids mesh-boundary creases.
Wing folding is projected foreshortening; fixed physical bone lengths are claimed
only for the articulated legs. The same projected feather contacts drive the
climax's storm fronts, so the cover does not originate from unrelated coordinates.

## Timing and delivery

Both clips remain 6.6 seconds at 1920x1080/60 fps with transparent boundaries.
The hatch remains at 1.12 s and power-stroke camera/sound beat at 3.16 s. The
default phoenix cut remains 4.05 s inside the 3.85-4.25 s full-opacity interval.
Per-animal cut configuration, native shuffled selection and alternating clips
retain their existing contracts. The new sound is normalized to a conservative
peak near -10.8 dBFS; no personal fader/filter/volume setting is changed.

Production files, lossless masters, previews, review sheets and validation live
in `C:/StreamingMedia/Transitions/udyr-spirits-v16-phoenix/`. The other six bear,
turtle and ram clips are copied byte-for-byte from the actually loaded native
generation immediately before verification. The manifest records only the two
phoenix clips as rendered in this revision.

## Verification and rebuild

Set `SPIRIT_OUTPUT=C:/StreamingMedia/Transitions/udyr-spirits-v16-phoenix` before
finite exports. Use the README build commands with `phoenix phoenix-alt`, regenerate
only those two soundtracks with `phoenix_sound.synthesize`, then preserve latest
other clips and run full encoded-alpha verification before installing.

`tools/test_phoenix_rig.cjs` verifies all four views are used, native body ratios,
actual paint at UV mounts/wing contacts, fixed articulated leg bones, continuous
non-folding wing projection, moving talons/tail, mirrored contacts, storm origins,
exact PNG reproducibility after out-of-order scrubbing and resource release.
PNG comparison matches encoder input; raw Canvas readback can change rounding
when Chrome promotes a frequently read surface between graphics paths.
`tools/review_phoenix.cjs` exports normal/alternate enlarged anatomy and stage sheets.
The general choreography verifier covers all opaque authoring frames, progressive
growth/reveal and configurable cover holds. The encoded verifier checks every
pixel of all 25 opaque VP9 frames per clip and binds reports to exact file hashes.

Installation uses existing native collection policy, settings history and Hub
instance ownership. Preserve the selected transition, program scene, filters,
transforms, latest faders, soundboard profile and recording/replay paths. Never
launch or restart OBS. Restart this checkout's Hub hidden when its maintenance
installation requires a stop, preserve Footage Desk, and verify one keyboard child
and the live preview. `delivery-validation.json` records completed checks and
`install-validation.json` records the exact loaded directory and preserved settings.

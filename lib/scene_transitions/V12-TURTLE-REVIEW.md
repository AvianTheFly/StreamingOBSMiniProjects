# Armored turtle and reactive hex ward, version 12

This revision owns only the turtle. The user's attached siege-turtle image supplies
the low quadruped anatomy, jagged shell, scale texture and jade palette. The original
`TurtleArt.png` was inspected and preserved; its robed/staff-bearing design is
not the anatomical target for this revision.

The turtle walks in on four independently articulated legs, settles its feet,
and retracts its neck/loads its shoulders before each rock. Rocks hit at 1.94,
2.74 and 3.62 seconds. A six-sided ward with hex cells materializes 140 ms before
each impact and reaches full local strength before contact. Every intact rock
stops at the same analytical boundary used to draw the shield. Rock fragments
scatter outward. The third anticipation has a stronger brace and shell charge;
the shield expands to full coverage by 3.85 seconds.

The 4.05-second turtle cut and 3.85–4.25-second verified opaque interval remain
unchanged. Hex tiles release from the center outward, shrink and rise, revealing
the new scene. Coverage begins only with the third block; the first two shields
are translucent defenses, so the growth regression samples the final expansion.

## Owners and verification

- `web/rigs/turtle/art.js`: selected alpha atlas and authored cell boundaries.
- `calibration.js`: source shoulder/joint/sole landmarks and fixed bone lengths.
- `motion.js`: deterministic crawl, world-space contacts, brace and head acting.
- `skin.js`: continuous joint-bound paint; stable sole orientation.
- `presentation.js`: depth order, shell breathing and head/neck composition.
- `web/turtle/projectiles.js`: rock paths, stone paint and seeded destruction.
- `web/turtle/shield.js`: hex geometry, hit coordinates, local defense and cover.
- `web/turtle.js`: thin choreography assembly and tile release.
- `turtle_sound.py`: finite three-hit stone/jade soundtrack; other audio unchanged.

`tools/test_turtle_motion.cjs` checks 3,708 fixed-bone poses, painted landmarks,
finite mesh vertices, planted-foot stability, all three projectile/ward contacts,
shield readiness before contact, destroyed-rock lifetime, both variants and every
opaque frame. `tools/review_turtle_motion.cjs` exports dense full-screen and enlarged
actor sheets. Review these and the two normal-speed videos before handoff.
All output/evidence stays in `C:/StreamingMedia/Transitions/udyr-spirits-v12`;
the preceding source is preserved in `before-v12`. Other animals' production
clips must be copied from the latest installed/verified generation without encoding.

The final v12 directory is installed in the observed `10326.json` collection.
The Move selector and valid per-animal cuts are preserved. The semantic delivery
audit accounts for OBS reordering transition entries, concurrent named visualizer
QA references and the existing lobby script reapplying its owned item transitions.
Personal source transforms, filters, levels and non-owned data compare unchanged.
The native playback clock/audio implementation is unchanged; no live scene-take
recording was performed for this art revision. `delivery-validation.json` records
loaded properties, encoded validation, six preserved clip hashes and Hub readiness.

Finite installers accept `media=...` so separate animation revisions do not need
to change a shared default. For this generation use
`install(collection_file='10326.json', update_existing=True,
media='C:/StreamingMedia/Transitions/udyr-spirits-v12/production')` with OBS open,
streaming/recording inactive, the Hub stopped and its instance ownership held.
The closed-OBS adapter accepts the same explicit media and collection arguments,
preserves the selector and never opens OBS.

## Built-in image-generation prompt and provenance

Saved atlas: `web/assets/turtle-rig-v12.png` (transparent RGBA, 1254×1254).
Built-in image generation used the user's attached image as its character/material
reference. Original output remains at
`C:/Users/Michael/.codex/generated_images/01a101fd-d306-7113-bb4a-98037679fae8/exec-82c147dc-ef91-42ca-b0b8-f8dcae70ce75.png`.
The body exceeds a nominal quarter-cell width, so authored separation regions
preserve its shell and exclude the neighboring neck rather than cutting the image
into blind equal quarters.

```text
Use Image 1 as the CHARACTER AND MATERIAL reference for a production animation asset atlas. Generate the same hardcore ancient giant snapping turtle: heavy quadruped body, huge weathered charcoal-jade shell with angular crystalline jagged spikes, carved eroded shell plates, realistic dark olive reptile scales, craggy low beaked head and fierce natural eyes, restrained green fissure glow. Detailed painted cinematic fantasy realism; the turtle is low and horizontal like the creature in Image 1. Transparent RGBA background. No environment, shield, rocks, ground, shadows, humanoid anatomy, clothing, robes, staff, flowers, cute/cartoon features, labels or grid lines. Deliver EXACTLY FOUR separated cutout components in a clean 2x2 square atlas, each part entirely inside its cell with transparent margins. All components share the SAME right-facing three-quarter view, light direction and anatomy, so they assemble into ONE believable turtle. TOP LEFT: complete horizontal broad turtle torso with massive spiked shell and low scaled underbody/hips/shoulder collars; NO HEAD, NECK OR LEGS in this cell. Shell dominates its mass, broad rear at left, front shoulder at right. TOP RIGHT: complete long thick head-and-neck component, pointing right and slightly toward viewer; continuous leathery neck root at left/back, heavy craggy jaw and tough beak at right, stern small natural eyes, mouth closed. BOTTOM LEFT: one complete NEAR FRONT quadruped leg, from broad scaled shoulder cap at top through a natural slightly outward-bent elbow to a large heavy clawed foot on the ground at bottom; the paw points right/forward. Short load-bearing reptile limb, NOT A HUMAN ARM or hand. BOTTOM RIGHT: one complete NEAR HIND quadruped leg, from scaled hip at top through a broad knee to a squat clawed foot on the ground at bottom, paw right/forward; slightly shorter and thicker than the front leg. Both isolated leg parts must include their full anatomical shoulder/hip roots, joints and feet in one continuous painted piece, no separated bones or sockets. Strong realistic texture continuity, natural proportions, opaque subject interiors, clean alpha silhouette. All four cells have one component each, fully visible and separated by generous empty margins, no component crosses the central cell boundaries. This atlas is for a slow heavy FOUR-LEGGED turtle walking then bracing under three impacts.
```

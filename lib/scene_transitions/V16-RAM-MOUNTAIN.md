# Golden mountain ram: skin and performance

The ram is a weathered golden mountain spirit with ivory rim light, cool blue
eyes, massive spiral mineral horns and coarse wool. Ember seams are restrained
horn trim. Five registered views support three mountain bounds, a frontal turn,
a triumphant rear on its hind hooves and a descending, lens-directed horn strike.
The cut cover is opaque carved gold/slate mountain stone with twin radial breaks;
its plates detach after the configured cut hold. Separate normal and mirrored
clips remain independent production assets.

## Change artwork without rewriting animation

`web/rigs/ram/skin-pack.json` selects the skin ID, material filename and five
view records in order: side, quarter, front, rear, fall. Each record names a PNG,
an optional normalized crop `[x, y, width, height]`, and its ground-to-top height
in character units. Image proportions come from the trimmed painting; do not
stretch a replacement to a square. Use transparent creature paintings and an
opaque material. Keep the measured pose and proportions when repainting a skin.

The current files under `web/assets/` are `ram-mountain-side-v16.png`,
`ram-mountain-views-v16.png`, `ram-mountain-rear-v16.png` and
`ram-mountain-material-v16.png`. The pose sheet's unused rearing view remains a
study; the standalone rear supplies the active triumphant pose. Change only pack
filenames/material for a compatible repaint. Changed anatomy requires updating
UV roots, knees, ankles, hoof regions and horn contacts in `calibration.js`.
The crop gutter is intentional; preserve it when replacing the atlas.

## Owners and verification

`art.js` decodes and registers a complete skin, splits calibrated side/quarter
limbs, preserves body collars and owns two bounded 1536×1320 blend buffers.
`motion.js` owns three trajectories, joint effort and viewpoint weights, with
landings at .86, 1.66 and 2.36 seconds and the final strike at 3.65 seconds.
`joints.js` solves upper/lower segments; `skin.js` moves their painted tissue and
rigid hooves. Front/rear/fall use complete painted poses with bounded joint flex.
`registration.js` aligns the horn midpoint through viewpoint changes, preserving
the ground pivot. `presentation.js` owns far/body/near paint order and projected
contacts. `web/ram/stage.js`, `impact.js`, `reveal.js` separately own staging,
cover/material and falling plates. Public facades only assemble these owners.
`ram_sound.py` owns finite synchronized original sound; no personal gain is changed.

Run `tools/test_ram_mountain.cjs` for actual painted triangles, complete buffer
containment, roots/hooves, head registration, three jumps, painted horn contacts
and every opaque cut frame. `tools/test_ram_skin.cjs` independently substitutes
skin/material filenames and checks failed/replaced generation handling.
`tools/review_ram_mountain.cjs` provides enlarged and dense sheets of both clips.
Also run generic choreography, preview, architecture, workflow and focused offline
transition/native tests. Production SSIM and decoded alpha are independent checks.

Use `SPIRIT_OUTPUT=C:/StreamingMedia/Transitions/udyr-spirits-v16-ram-mountain`
for `tools/render_spirit_transitions.cjs ram ram-alt` and the optimizer/validator.
Carry the other six clips from the actually loaded directory and recheck hashes
before the finite installer. In this delivery those include the v18 turtle gait
and v17 phoenix flight. Keep their timing metadata. OBS's native media-clock cuts,
random selection, existing 3.85–4.25 s plateau and valid personal cut choices stay
in their existing owners. Never start OBS for maintenance. Restart only the
supported Hub hidden if needed, preserving Footage Desk and keyboard ownership.

Generated art uses built-in ImageGen. Exact prompts, source paths, mode and the
standalone rear prompt are recorded in `RAM-MOUNTAIN-PROMPTS.json`. The original
paintings remain on disk. Backups and delivery evidence live beside the versioned
export; personal settings history remains outside the checkout.

Delivery passed 4,708,247 painted-triangle checks, complete buffer containment,
all four articulated side/quarter limbs, registered heads and painted horn
contacts. Both ram production clips reached 0.997101 SSIM. All eight clips decoded
to 396 frames, and every pixel of all 25 cut frames was opaque. The loaded OBS
directory, preserved six-clip hashes, personal cuts/selector/settings, synchronized
replay paths, and one ready Hub/keyboard child were independently audited.
Footage Desk remained running. No OBS restart or program-scene take was performed.
Architecture and eight focused offline tests passed. The transition workflow is
reviewed; existing review warnings for unrelated owners remain in the global map.

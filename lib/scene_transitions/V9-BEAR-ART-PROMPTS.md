# Version 9 bear artwork

Built-in image generation mode, 2026-10-03. Only the bear was redesigned.
The original gritty four-pose side gallop is restored as `web/assets/bear-run.png`
from the verified v8 archive. The other animals retain their accepted v8 art and
six encoded production clips unchanged.

The new transparent 1254 × 1254 atlas is saved in
`web/assets/bear-quadruped-v9.png`. The bear art owner selects its top-left low
three-quarter chassis and bottom two complete forelegs. The top-right frontal
study is preserved but unused: it did not read as a braced standing quadruped.
The painted chassis includes both hind legs; only its forelegs are rigged.
The rejected upright v8 rig and full preceding implementation are preserved at
`C:/StreamingMedia/Transitions/udyr-spirits-v9/before-v9` and
`C:/StreamingMedia/Transitions/udyr-spirits-v9/previous-implementation`.

## Generation prompt

Reference: the original gritty `bear-run.png` gallop sheet. Transparent background enabled.

```text
Production animation cutout atlas for THIS EXACT gritty electric grizzly bear. Preserve reference realistic dense charcoal/brown fur, blue eyes and restrained electric-blue fissures, cinematic detailed painted fantasy realism. Natural adult bear anatomy, NOT humanoid, NOT standing on hind legs, NOT cute, no armor. TRANSPARENT square RGBA with four isolated complete cutouts in EXACT 2x2 cells, generous transparent gutters, all parts fully contained. TOP LEFT: three-quarter bear quadruped CHASSIS facing viewer and slightly right: broad horizontal torso and high shoulder hump tapering toward low rear hips, head held forward and LOW between shoulders, stern slightly snarling closed-mouth muzzle, both bent hindlegs and hindpaws planted, OMIT BOTH FORELEGS entirely with natural overlapping shoulder fur, no sockets/wounds. Natural quadruped back horizontal; never upright torso. TOP RIGHT: same exact chassis in nearly frontal view, very slight three-quarter depth: head forward and LOW, massive shoulder hump behind head, belly horizontal receding backward, hind feet planted farther back at either side, OMIT BOTH FORELEGS. BOTH chassis low wide heavy real grizzly bodies, same size and lighting, no front paws baked into them. BOTTOM LEFT: one complete LEFT natural bear foreleg including rounded shoulder fur, thick elbow/forearm, downward planted paw, short real curved claws; continuous furry leg, no fingers, no human palm, no open hand, generous shoulder overlap. BOTTOM RIGHT: matching complete RIGHT foreleg and grounded paw. Lower limbs same scale/lighting as bodies, long enough to reach from shoulders to ground. Render complete forelegs as intact curved anatomy suitable for continuous mesh bending, no rings or hinges. Blue restrained light at claw tips, not gigantic glowing spikes. No text, labels, grids, backdrop, smoke clouds, detached fragments, other characters.
```

Initial generated file:
`C:/Users/Michael/.codex/generated_images/01a0f7e9-178f-7131-bf3b-485f7b137ba5/exec-30c9bebd-0e67-4606-a080-87a06b25d0d7.png`.

## Targeted atlas edit prompt

Reference: that generated atlas. Transparent background preserved.

```text
Precise animation-rig edit of this transparent 2x2 atlas. Preserve TOP LEFT chassis and BOTH BOTTOM isolated limbs EXACTLY unchanged, including positions, scale, fur and lighting. Change ONLY TOP RIGHT chassis: REMOVE both of the large FRONT legs and FRONT paws currently growing downward from the outer shoulders. This cell must be a foreleg-less quadruped torso/head layer, because the two separate bottom limbs will supply those legs during animation. Keep its same low natural bear head, massive horizontal receding body, shoulder hump and exact face. Finish the shoulders with shaggy soft overlap fur, no wound, no socket, no forearm or front paw baked into this layer. Two small distant HIND feet may be visible much farther back behind the chest, subtly near the lower torso sides; do not turn those into big legs hanging from front shoulders. Keep chest/head low and wide; never upright/humanoid. Keep cell fully inside the top-right quadrant, preserve transparency and exact art style. No added limbs, no background, no labels, no other changes.
```

Final generated file:
`C:/Users/Michael/.codex/generated_images/01a0f7e9-178f-7131-bf3b-485f7b137ba5/exec-a238ba3f-5cbb-4004-b39f-3df55a1c7d3a.png`.

Both outputs were visually inspected. Runtime cell selection is explicit in
`web/rigs/bear/art.js`; anatomy/contact paths belong to `motion.js`, and paint
layering/deformation belongs to `presentation.js`. Numeric support tests validate
the logical rig, not the painted image's anatomy. Dense contact sheets and the
individual preview videos provide the visual review.

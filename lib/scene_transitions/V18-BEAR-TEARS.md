# Bear: cumulative screen tears

Both bear performances retain the accepted storm artwork, metallic claws,
four-legged approach, frontal poses, claw trajectories and synchronized audio.
Each 140 ms attack at 2.11, 2.61 and 3.11 seconds immediately opens a visible
storm-material tear. Earlier cuts persist while later attacks add more coverage.
After the third attack, pressure expands those same cuts into the final plate.

The bear is painted above its tears. It remains fully visible through all three
attacks and fades from 3.30 to 3.78 seconds as the existing tears take over.
The fully opaque interval remains 3.85–4.25 seconds, with the per-animal native
cut setting inside that interval. The diagonal reveal follows `coveredUntil`.
No additional source, playback worker, browser channel or timer is introduced.

## Owners

- `web/bear/approach.js`: shared, unchanged world placement for performer and claws.
- `web/bear/tears.js`: claw-attached paths, permanent strike growth and final expansion.
- `web/bear.js`: bear staging, optional foreground performance, material and reveal.
- `web/renderer.js`: generic composition hook after masked coverage and before bloom.
- `web/rigs/bear/`: existing artwork, anatomical motion and presentation.

Strike width grows to 600/850/1100 pixels during the respective attacks and
settles another 200/300/400 pixels afterward. Tapered irregular ribbons retain
claw-shaped edges. Absolute-time evaluation makes coverage independent of scrub
order. The final pressure envelope uses the existing 3.28–3.85-second timing.

## Rebuild and verification

Set `SPIRIT_OUTPUT=C:/StreamingMedia/Transitions/udyr-spirits-v18-bear-tears` and
the documented Playwright `NODE_PATH`. Run `node tools/test_bear_tears.cjs`,
`node tools/render_spirit_transitions.cjs bear bear-alt`, and
`py -3.11 tools/optimize_spirit_media.py bear bear-alt`.
Run the accepted-motion regression with `SPIRIT_REFERENCE` pointing to the
immutable v15 `before-v15/lib/scene_transitions/web` archive.

The versioned delivery preserves the latest installed six other clips by exact
SHA-256. Its finite helper rejects installation if another animal changes before
installation. `tools/verify_spirit_media.py` verifies all 25 encoded opaque frames
in every cut window and transparent boundaries. `tools/test_bear_tears.cjs`
checks visible coverage during each strike, retention of previous cuts, actual
foreground bear pixels over storm material, and scrub-independent mask interiors.
Browser GPU/CPU edge antialias differences are excluded from the interior test.

Original sources remain under `before-v18`; final sources and validation reports
remain in the versioned delivery alongside separate lossless masters, production
WebMs and individual review videos. Review videos use synthetic scene A/B cards.

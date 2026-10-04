# Turtle attachment, slow crawl and siege dome — version 13

The user's v12 feedback asks for far-limb/body/near-limb depth, connected roots,
four readable legs, a slower approach, early first rock, a second approach block,
then a settled charge that expands while the last boulder arrives. Their siege
reference supplies the curved jade energy, weathered material and violent stone
impacts. Existing v12 gritty raster artwork is preserved; this revision generates
no new artwork and changes only code-native turtle geometry, acting and audio.

## Owners and timing

- `rigs/turtle/calibration.js`: torso UV shoulder/hip mounts, feet and fixed bones.
- `motion.js`: continuous 2.96-second crawl and four independently phased contacts;
  root positions use exactly the torso's breathing/recoil deformation.
- `presentation.js`: far hind/fore, torso/head, complete near hind/fore depth order.
  No lower-leg-only foreground pass or detached upper limbs.
- `skin.js`: continuous painted joint surface, anchored sole and perspective width.
- `turtle/projectiles.js`: 0.06/2.05/3.04-second launches; 1.94/2.74/3.62-second
  impacts; heavier chipped boulders, slow spin, shed chips, dust and seeded fracture.
- `shield.js`: reactive shield timing, shared impact locations and independent solid
  cut mask. The third dome charges at 3.02, starts growing at 3.12, surges on impact.
- `dome.js`: hemisphere-projected hex panels, winding aurora currents, branched
  jade veins, pale illuminated rim and localized impact waves. Loops are bounded;
  no new sockets, threads, globals, persistent canvases or Hub resources.
- `turtle.js`: thin assembly, individual contact dust, charge and hex tile reveal.
- `turtle_sound.py`: matching slower footsteps, heavier stone and pre-impact charge.

The configurable cut remains 4.05 s within an exact opaque 3.85–4.25 s plateau.
Both turtle clips are separate VP9 alpha assets, 1920×1080, 60 fps, 6.6 seconds.
Other six clips are copied from the latest installed delivery and hash-checked.
Native media clock, random selection, source audio faders and global transition
selection remain with existing owners. No native DLL or program scene changes.

## Regression and review

`tools/test_turtle_motion.cjs` checks 3,708 bone poses, root/joint/sole binding,
world-planted foot stability, full-limb far/body/near draw order, painted contacts,
three exact shield collisions, pre-impact expansion and every opaque cut frame.
`tools/review_turtle_motion.cjs` captures both full timelines and enlarged anatomy.
Use SPIRIT_OUTPUT and SPIRIT_REVIEW to keep review/export evidence versioned on C:.
The finite exporter, production SSIM measurement, complete encoded-alpha decode,
preview state tests, architecture checker and relevant offline regressions apply.

Final media/evidence: `C:/StreamingMedia/Transitions/udyr-spirits-v13/`.

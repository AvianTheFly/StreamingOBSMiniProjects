# Living lobby artwork

The first example adds motion to the existing Turtle Reef painting and makes
small, thematic visitors arrive automatically. Spirit Forge, Forest Sanctuary,
Sky Harbor, Storm Coast, Phoenix Observatory, Spirit Railway, Lobby of Legends,
Future Lounge, Spirit Arcade and Aurora Camp now have their own themed
performances in the same studio. All original artwork remains preserved.
The existing Spirit Afterparty keeps its independent automatic party renderer.

Open the running Hub's review studio:
`http://127.0.0.1:7420/lobby-motion/studio.html`.
The preview uses the original painting with empty display apertures. Native OBS
keeps the actual camera, desktop and chat sources in those apertures.

The two painted turtles gently swim, coral and plants sway, a hanging lantern
moves, underwater light and bubbles drift, and the original mug gives off steam.
The surprise cast includes a teapot submarine, diving rubber duck, manta ray,
jellyfish lanterns, seahorse courier, fish forming a turtle constellation,
tea-service crab, escaping treasure pearls and a living treasure map.

Automatic entrances use varied spacing, recent-guest weighting and soft visual
pressure. They do not require button presses, a fixed playlist or a fixed number
of guests. Quieter moments retain the painted environment's movement. An accepted
visitor finishes its own entrance; a manual invitation never restarts it. Turning
automatic entrances off stops new arrivals while the present visitors finish.
The studio provides optional invitation buttons, keys 1–9 and pause for review.
No audio is added.

## Ownership and maintenance

- `motion.py` owns the optional per-world browser-source contract. It passes the
  saved screen, camera and chat rectangles to the renderer. `presentation.plan`
  publishes this layer between the original foreground and dedicated chat, or
  after the camera in the two flat paintings that have no foreground cutout.
- `web/reef-scene.js` owns painted landmarks, deformation and underwater clipping;
  `reef-cues.js` owns cast, timing and weights; `reef-visitors.js` and `reef-room.js`
  own their thematic performances; `reef-ink.js` owns local subject drawing.
- `web/stage.js` owns one visible-document rendering loop and finite manual and
  automatic instances. Complete live apertures are cleared after every accent.
  Hidden documents pause; teardown clears instances and decoded patch canvases.
- Public `lib/browser_effects/web/world-motion.js` owns only reusable scheduling
  and cached mesh mechanics. It starts no timers, workers or network connections.
- `tools/build_lobby_motion.py` publishes the canonical web files and public
  mechanics into `hub_ui/app/lobby-motion`, recording source paths and hashes in
  `build.json`. The `./shared/` imports refer to that published directory. Edit
  canonical owners and run the build; do not edit the generated distribution.
- `tools/install_lobby_motion.py --world <source>` adds one transparent living-world
  input while off-air, snapshotting settings and verifying all existing input
  settings, filters, item transforms and program scene are preserved. Repeated
  installation reuses the input. Native OBS shuts down this source while inactive.

The original image files are never rewritten. No new Hub socket, microphone,
keyboard listener, playback worker or program-scene writer is introduced.
SceneDirector and the existing lobby presentation contract retain their roles.

## Verification

Run `py -3.11 -B tools/build_lobby_motion.py` after artwork-code edits, then the
architecture check and offline regressions described in CONTRIBUTING.md.
`tools/test_lobby_motion.py` checks placement, stacking, pilot scope and build
provenance. `tools/test_lobby_motion.cjs` runs against the real Hub with Chromium:
all nine performances must visibly draw; custom live apertures must have zero
alpha; the painting must move with every guest disabled; manual and automatic
instances retain continuity; pause, mobile layout and automatic variety work.
It also records a 40-second automatic preview without invitation presses.

`tools/test_lobby_worlds.cjs` checks the entire ready-world catalog, including
visible performances, original-painted movement, complete custom aperture alpha,
cache teardown, mobile layout and switching between studios. It records automatic
clips for the requested worlds without invitation presses.

## Ready worlds

| World | Motion in the painting | Automatic surprises |
| --- | --- | --- |
| Turtle Reef | Swimming painted turtles, swaying coral/leaves, hanging lantern, tea steam, moving water light | Nine sea and counter visitors described above |
| Spirit Forge | Swaying painted banners, moving fire bowl and furnace flames, embers, crystal shimmer | Practicing hammer, smithing duck, waking wall spiral, crystal chimes, ember moth, tiny forged duck |
| Forest Sanctuary | Swaying painted lanterns and vines, gently moving turtle lamps, incense/tea steam, flowing waterfalls | Duck in a paper boat, mushroom with leaf umbrella, moon moths, leaf-winged teacup, polite frog, firefly turtle |
| Sky Harbor | Bobbing painted airship, swaying banner/lantern/leaves, cloud light and orb glimmer | Cargo blimp, paper-plane post, pilot duck, lantern-borne tea, cloud swallows, wandering compass bearing |
| Storm Coast | Swaying painted lanterns and cloth, stirring waves/fire, rain clipped to the outside view | Umbrella duck, message bottle, gulls, dancing shells, distant lightning trace, lifebuoy duck |
| Phoenix Observatory | Swaying painted banner/gem, moving armillary fire and braziers, constellation glimmer | Comet teacup, duck astronomer, pocket phoenix, orbiting planets, passing wish, curious moon |
| Spirit Railway | Swaying painted banner/phoenix lantern, rocking distant train, bell motion, steam and drifting autumn leaves | Pocket express, walking luggage, conductor duck, runaway ticket, silent bell rings, leaves forming a turtle |

| Lobby of Legends | Breathing painted dragon, swaying banners/chandelier, moving quill and hat, candle warmth and mug steam | Dragon spark sneeze, walking mug, wizard-hat stars, floating quill, bouncing dice, wandering coins |
| Future Lounge | Stirring robot/robot dog, bobbing orbital object, galaxy shimmer, console pulses | Coffee UFO, maintenance bot, solar toast, duck astronaut, orbiting marbles, passing comet |
| Spirit Arcade | Moving painted turtle and plants, rain outside, cabinet glow, warm lanterns and incense | Wandering credit, pixel visitors, duck gamer, dancing joystick, orbiting marbles, prize claw |
| Aurora Camp | Flowing painted aurora, breathing canopy, moving fire and plants, sparks and tea steam | Marshmallow hikers, magic kettle, fire moths, scarf duck, star mountain, wandering lantern |

`worlds.js` catalogs complete presentations. `loadWorld` loads only that world's
artists; `reef-world.js` keeps the reviewed reef policy intact. `painted-world.js`
shares feature-local decoded-art assembly across the painted worlds; each
`*-world.js` owns its own coordinates and deformation, and either includes
continuous atmosphere locally or delegates it to `*-atmosphere.js`;
`*-guests.js` owns its cast and performances.
The studio replaces its single iframe on world changes and rejects stale
selection results; it never loads every world at once or changes the OBS program.

Review evidence lives outside the checkout at
`C:/StreamingMedia/LivingLobbies/Reef/review` and
`C:/StreamingMedia/LivingLobbies/catalog/review`. Native installation and restart
proofs accompany the clips and actual-render reports; the studio is for review,
while the installed OBS sources run their automatic entrances without it.

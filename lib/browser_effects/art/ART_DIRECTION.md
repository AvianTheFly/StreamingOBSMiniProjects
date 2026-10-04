# Original border artwork / 2026-10-02

Created with the built-in image-generation tool, six independent generations.
The original PNG bytes are preserved: no background removal, recoloring,
resizing, or destructive image processing was applied. The renderer selects
atlas cells at runtime and composites them over true alpha. Unused cells remain
in the original atlases. These are original themed illustrations, not official
Riot assets. Event identity and gameplay timing remain owned by the existing API.

## Prompt set: reproduction briefs

Each generation requested one square 3×3 atlas on a true transparent background.
The first requested 1536×1536; the other five requested 1280×1280. The delivered
native sizes are recorded below. Each cell contained one complete isolated
silhouette, centered with 25–50px clear padding. No labels, grid, logos, lettering,
background scene or emoji faces. Premium cinematic game-item/environment art,
physically lit, refined material surfaces, crisp small-scale readability,
restrained emissive highlights, no huge glow clouds or flat vector treatment.
The ordered cell subjects (left to right, then top to bottom) were:

### Cinematic sound props A

`lib/browser_effects/art/sound-a.png` — 1254×1254 native pixels.

Red-orange crab on turquoise coral; graphite Japanese drift car; obsidian sarcophagus with brass and violet seams; mint/champagne reel-to-reel machine; burgundy violin and bow; broken rose-quartz anatomical heart; copper skillet on sapphire gas stove; tilted lime alchemical flask with spill; cracked ruby/charcoal reactor.

### Cinematic sound props B

`lib/browser_effects/art/sound-b.png` — 1254×1254 native pixels.

Gold eagle championship belt; chrome hammer with rose quartz head; iridescent opal prism; lavender/cyan mirror ball; engraved martial cuffs with ivory cloth; coral/pearl/lavender foil balloons; dark silver rat on brass gear; natural raccoon at amber turntable; smoked chrome wraparound sunglasses.

### Cinematic sound props C

`lib/browser_effects/art/sound-c.png` — 1254×1254 native pixels.

Muffin with copper foil and amber sugar; fractured optical camera lens; smoked-glass speakers with lime/violet membranes; silver cat on rainbow-glass comet; red leather boxing glove against broken stone; emerald arcade cartridge; jade checkmark on gold seal; antique gold/turquoise music box; metallic sapphire/coral/champagne party streamers.

### Elemental environment fragments

`mini projects/league_api/production/art/elements.png` — 1254×1254 native pixels.

Sandstone mineral cliffs; volcanic shelf with amber lava; turquoise tide pool with corals; wind-carved pale arch with feathers; brass and midnight-blue Hextech engine with cyan rods; dark-brass alchemical terrarium and lime foliage; ivory dragon skull and pale soul fire; purple Void serpent around a black cliff; silver hourglass inside a ruined crescent arch.

### League event relics

`mini projects/league_api/production/art/relics.png` — 1254×1254 native pixels.

Steel greatsword with brass guard and crimson silk; bronze crown with five icy blue gem spires; violet watchful eye in an obsidian crescent; ruined white-stone turret with cyan core; sapphire inhibitor in a brass cradle; enchanted green sprig with a seed in glass; open ancient spellbook and floating rune; marble/silver portal doorway with steps; gilded laurel branch and ivory victory pennant.

### Community celebration miniatures

`mini projects/twitch_celebrations/art/celebrations.png` — 1254×1254 native pixels.

Ivory/gold spirit bear; jade turtle with inlaid shell; bronze ram with ivory horns; coral/amber phoenix; violet lantern dragon; natural tree frog on lotus lily pad; silver celestial cat in an astronomical carriage; mother-of-pearl seashell and pearl; three brass-framed amber lanterns.

## Build and motion

### Short-Cue Timing / 2026-10-03

Live playback warms and clears its first draw before starting the audio clock.
BorderShow explicitly opts into 12-ms attack/18-ms release below 1.5 seconds;
other EdgeFinish consumers and long cues keep their established envelopes.
Drawing, pose progress, pause and cleanup still follow the actual owning audio.

Finite review exports sample each frame at its interval midpoint and distribute
at least 60 frames/second over the original browser audio duration. MP3 decoder
padding is matched with silent preview-only tail padding; no original media is
changed. A/V tracks start at zero and must finish within 2 ms of each other and
the original duration. Native transport overlays were replaced by external
play/replay/scrub/loop controls and millisecond time readouts. Only one preview
can play audibly. Preview-only looping makes half-second performances inspectable
without stretching live sounds; a one-shot clears its video on its ended event.
`tools/test_sound_preview_timing.cjs` verifies actual decoded playback frames,
visible onset and duration, timestamps, looping, pause and responsive controls.

### Random Soundboard / 2026-10-03

The follow-up Piuw/Frog pass adds actual flowing perimeter effects behind the
existing casts. `piuw-border.js` owns three counter-traveling aqua/pink plasma
tails with bright cores, interference zigzags, edge sparks and outgoing shock
rings. `frog-border.js` owns broad translucent pond currents with silver crests,
four droplet fans, bubbles and outgoing croak rings. Their progress and fades
use only the existing short audio clock; no wall-clock timer or runtime DSP is
added. The standard gameplay opening remains alpha-zero.

`tools/prepare_border_audio.py` owns the requested finite cleanup. Piuw targets
sub-100-Hz microphone rumble using a 160-Hz high-pass, 3.5-kHz low-pass and modest
spectral denoising. Frog is reprocessed from its original external backup, not
the already-cleaned version: 100-Hz/3.2-kHz band limits, spectral denoising and a
gentle room-noise gate. Both have millisecond edge fades and no normalization.
Original and previous media are preserved outside the checkout; per-asset gain
and settings are untouched. Exact filters, hashes and candidates are recorded
in `output/audio-border-refresh/{piuw,frog}/audio-recipe.json`.

Built-in imagegen produced five native 2172x724 RGBA atlases. Original PNG bytes
are preserved in `spam-{lizard,gary,quack,bonk,piuw}.png`; each has three equal
square cells, true alpha and generous padding. Shared prompt constraints were:
one consistent recognizable character, fully visible subjects, no words, no
background or scene, no border or shadow extending outside the cutout, and
three separated poses with no props crossing cell boundaries.

Per-atlas generation briefs:
- Lizard: faithful film-style mint-green Tom with huge goofy eyes, three-quarter
  raised hand above a big button, pressing the same button, then gleefully eating
  popcorn from a red-striped tub. Use the supplied Tom/button and popcorn
  references, not a generic reptile. Keep the same face and body in all poses.
- Gary: faithful pink-shell/red-spiral, teal-body Gary with long eyestalks; side
  crawl, open-mouth meow, then sailor hat and fish-biscuit snack. Preserve the
  familiar silhouette and colors with clean cel/painterly shading.
- Bonk: faithful seated photographic Shiba from the supplied meme reference,
  ordinary pose, cooking-pot helmet, then holding a soft pink foam mallet.
  Match real golden fur, face and proportions, with playful harmless props.
- Quack: original clay-style yellow duck, operating a compact vintage Macintosh-
  style computer, open-beak quack wearing headphones, then sailor hat/life ring.
  Do not pretend the original short quack identifies a named cartoon character.
- Piuw: original cute aqua alien, lilac overalls/coral boots, holding a toy raygun,
  recoiling from its zap, then waving from a pearlescent miniature UFO. No fixed
  media origin was confirmed for this sound; this is a custom thematic cast.

Source context: [Pixar Hoppers](https://www.pixar.com/hoppers/?intoverride=true),
[Tom/button meme](https://trending.knowyourmeme.com/editorials/guides/whats-the-origin-of-the-lizard-lizard-lizard-meme-disney-pixars-hoppers-and-the-elio-post-credits-scene-explained),
[Gary meow](https://www.youtube.com/watch?v=sz0iZ_ahQqg),
[Bonk meme](https://knowyourmeme.com/memes/bonk-cheems), and
[Mac Quack sample](https://www.myinstants.com/en/instant/mac-quack-83896/).
Local visual references are under `output/spam-cues/references/`.

`spam-cues.js` selects only the existing scene/style tags. Per-cue owners animate
the pose changes, button ripples/popcorn, slime/jellyfish/biscuits, desktop disks
and sound lines, mallet/spring/impact stars, and UFO/zap/rockets respectively.
All motion follows normalized original audio progress. The shared edge mask
keeps the central gameplay opening alpha-zero. Original MP3s, random selection,
saved profiles, filters, transforms and gain are untouched. Finite Chromium QA
records original-media SHA256s and exact durations in
`output/spam-cues/render-verification.json`; previews include the original audio.

### Mom Frog / 2026-10-03

Built-in imagegen produced `mom-frog-views.png`, a 2172x724 RGBA sheet with three
equal horizontal cells. Prompt: isolate the exact stocky, grumpy, speckled brown
frog from Mom Frog's source frame, remove the blue floor, dirt and microphone,
and provide original three-quarter, front and left-facing side views of the same
individual. Preserve realistic skin, markings, proportions and lighting; true
alpha, all feet visible, generous transparent padding, no cartoon treatment,
props, text or backdrop. Original generated bytes remain intact.

The separate `output/mom-frog/mom-frog-extracted.png` was also made with built-in
imagegen. Prompt: isolate only the original single brown frog, keep its pose,
expression, speckled skin and proportions, remove the floor/dirt/microphone/cable
and cast shadows, use clean true alpha and padding, with no props or text.

`mom-frog.js` selects the three cells at presentation time, with eight miniature
performers, lily-pad stages, microphones, crown/bow accents, lotus flowers, reeds
and ripples. All motion uses normalized progress of the actual audio duration.
`tools/prepare_mom_frog.py` owns finite noise reduction and original-media backup;
`output/mom-frog/audio-recipe.json` records the exact filter chain and backup.

`py -3.11 tools/build_border_art.py` embeds the original PNG bytes in three
self-contained JavaScript modules using the already-supported static URLs.
The adjacent source files own composition and choreography. The build adds no
service, feature-to-feature import, fetch loop or clock. Atlas decoding happens
once per page, and readiness is available to finite review tools.

Sound effects follow audio time. League cues follow actual event elapsed time
and saved duration. Sustained death uses actual death state and respawnTimer;
new particle birth serials change the field throughout the death interval.
Subscriber copy and usernames are runtime DOM text, with no names burned into art.

Solid props stay outside the standard top-corner and lower-corner gameplay HUDs.
The central opening is fully alpha-zero; atmospheric fields are confined to the
outer edge. Performance and geometry are verified in the real browser renderers.

Riot context used for artistic interpretation:
[Hextech lightning](https://www.leagueoflegends.com/en-au/news/game-updates/patch-11-23-notes/)
and [Void ecosystem](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-1-notes/).
These historical descriptions inform materials and motifs, not current buff
numbers, event detection, spawn schedules or timing claims.

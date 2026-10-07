# Soundboard cultural-context redesign

The exact scope is the `default` profile's `! 2 # Z T t h H`: 30 distinct
assets. Every original video was sampled at three points; actual media provided
the strongest context evidence. Audio-only cues were checked against existing
reference artwork and context research. Automatic speech review was treated as
fallible: song mis-transcriptions were not used to invent content.

| Sound | Context and authored visual joke |
| --- | --- |
| dancing music | Blue-shirt street-dance clip; articulated shuffling, planted shoes, footwork reflections and a late-arriving dancer. |
| coffin dnace | Astronomia/pallbearers; six suited dancers carry the same casket with aligned shoulders/hands, arch lights and an exit encore. |
| celebrate | Mashle's Bling-Bang-Bang-Born; a deadpan bowl-cut dancer bends a wand with muscle power, accompanied by cream puffs and manga screentone. |
| crab rave | Original dancing beach crabs; articulated pincers and scuttling feet, beach currents, shells and a percussion solo. |
| die die die | Muffin Song; preserve the approved singing muffins and title choreography, add an oven-mitt conductor and bakery encore. |
| fun celebration | Actual Dancing Toothless clip; floppy dark dragon, big lime eyes, wing and hip movement, fern-frond clearing and fish applause. |
| JOHN CENA | Preserve the approved wrestling arena and camera entrance; staged flash accents and a miniature championship-belt reveal. |
| rat dance | Actual booted Milton-style dancing rat; expressive rat legs in large rain boots dance through dissolving brick/subway/night-window stages. |
| Pedro | Preserve the approved raccoon DJ crew; a circular spinning cameo echoes the original crop and moves away from the existing title. |
| Sigma Boy | Ironic overconfidence; a cool strut nearly meets a tiny cone, the aura counter briefly collapses, and the performer stays shamelessly cool. |
| Deja Vu | Preserve the full-perimeter accelerating car and gears 1–5; add a nervous spare-wheel pit crew and checked flags. |
| hype up music | Actual trombone-and-oven jam; a connected sliding trombone and sound-driven oven door, kitchen-rack scenery and brass notes. |
| meow meow | The local clip confirms Nyan Cat; crisp pixel pastry cat, continuous rainbow wake, traveling lights and pixel stars. |
| lizzard-1 | Preserve Tom/button/popcorn cast; the physical press sends one outgoing ripple to the popcorn audience and updates a cinema placard. |
| gary_meow | Preserve Gary's recognizable snail cast; shell-spiral and slime-wave meow echoes rather than unrelated cats. |
| mac-quack | Duck desktop joke; a miniature QUACK.EXE window completes and ejects a playful cursor alongside the existing cast. |
| bonk_7zPAD7C | Mallet/helmet comic impact; mallet lower face and native helmet placement share y=318, followed by settling burst work. |
| piuw | Existing custom alien/toy-zap cast; a ricochet reaches the edge satellites and one final impact. No specific source character is falsely claimed. |
| mom frog | Preserve the actual grumpy brown frog; a single short croak receives an absurdly grand miniature microphone ovation. |
| dang it | The local clip is Buttercup/run humor; frantic rubber-hose sprint, one small hurdle, warm speed ink and an undignified misclick finish. |
| im cooked | Local worried-dog clip; floppy-eared dog pops from a toaster, toast verdict, heat ribbons and crumbs. |
| OH NO NO NO NO | Local telephone panic; banana receiver lifts on three measured phrase regions, rotary dial and escalating small NOs. |
| I shouldve seen that coming | Local perspective/Frolic gag; a hindsight detective overlooks an obvious peel, then its clue halo reveals it. |
| sad violin | Local sad-hamster melodrama; keep the approved violin orchestra and add a huge-eyed tiny hamster conductor and tissues. |
| woops | Actual Curb-style end-credits clip; dropped cup, narrow transparent credits, clapper and gravity credit. |
| How could this happen to me | Overdramatic emo reaction; headphone cloud, split heart, finite rain and a tissue encore. |
| leave me alone | Akira overload context; stressed gamer holds their head as pings accumulate, then a large-enough-to-read tiny mute switch settles. |
| prowler | Violet comic menace; glowing angled eyes, hatching, claw lights and a scared little hiding silhouette. |
| you saved me | Local Superman/Starman clip; hopeful cape flight, falling ally physically caught at the supporting hand, and a support-diff payoff. |
| what just happened | Local UFO/dog-files clip; miniature UFO lifts a bewildered dog, radar follows and the border registers the ridiculous evidence. |

Native illustration is deliberately different between performances: pixel art,
manga ink, rubber-hose figures, enamel/brass machinery, comic shadow, photographic
cast, theatrical serif credits and soft miniature character animation. Shared
helpers provide only drawing geometry. They do not choose a subject or place a
template around every sound.

## Timing and preservation

### Follow-up: performances instead of repeated dances

The next review found that several main characters still repeated a single pose
cycle despite their contextual supporting props. The longer performances now
have finite actions and held consequences:

- Muffins trade solos, do a staggered wave, anticipate the last lyric, then all
  eight flop with X-eyes. Microphones and hats fall separately; nobody revives.
  The final "die" is cued at approximately **6.24 seconds** in the unchanged
  6.687-second local clip. Cached word-timing review and the source's final DIE
  frames informed that point. The earlier full-song transcription was unreliable;
  the bounded last-phrase pass was more useful. A 55-ms visual release preserves
  a brief readable dead tableau without extending the sound.
- The shuffle becomes a moonwalk, single turn and freeze. The coffin crew enters,
  wobbles, catches a hat and bows. Mash stops to flex, bends the wand, then eats
  a cream puff. A beach ball rolls under the crab chorus; the final crab over-rotates.
- Toothless spots and gulps a fish, then burps its silhouette. A rat loses a boot,
  hops, recovers it and poses. Sigma's glasses actually leave and return to his
  face. The oven launches toast into a waiting mitt. Nyan dodges a pixel moon
  and performs one barrel roll.
- Pedro's crew has a traveling wave, stolen-record bite, one flip and a final pose.
  Sad violin progresses through solos to a snapped string, fallen score notes
  and the hamster's tissue surrender flag. Their established main designs remain.
- The runner brakes and slumps, the banana phone is unplugged after three answers,
  the broken heart gets a crooked bandage, and the UFO returns the dog with a
  foil hat before leaving. The mute reaction now completely releases its shake.

The short press/quack/bonk/zap/frog cues, catch/rescue, cup/credits and existing
car acceleration already have finite outcomes and were retained. Some beat motion
remains as secondary movement; it no longer supplies the entire long performance.
All new motion is a pure reconstruction from the existing audio position, including
backward seeking and replay. No per-frame state, extra clock or audio was added.

`tools/test_sound_story.cjs` checks all eight muffins on both sides of the lyric,
no revival through the ending, clear gameplay, seek/replay reconstruction and
empty canvas at audio end. It saves the six-moment `muffin-story.png` contact sheet.

### Further meme-action pass

Ten more performances received new actions, with four additional contact fixes:

| Sound | New action and relevant reference |
| --- | --- |
| JOHN CENA | His open palm moves across his face, he vanishes, the belt drops, and autofocus hunts. This takes the established [You Can't See Me invisibility joke](https://www.wwe.com/section/overtheropes/article/john-cena-cricket-wireless-cant-be-seen) literally while retaining the approved camera arena. |
| I shouldve seen that coming | A detective ignores Exhibit A, steps on its actual banana peel, slips and loses his glasses. His raised leg clears the ground and his whole face remains inside the border. The existing Frolic/hindsight reference drives the setup. |
| im cooked | The dog sips coffee, pops out of the toaster with the mug attached to his paw, then settles with crumbs. Coffee denial is an added [KC Green / This Is Fine homage](https://gunshowcomic.com/648), not a claim about the original local clip. |
| woops | The cursor nudges a mug off its ledge, coffee lands, undo fails, then Curb-style credits and a single clapper close the joke. The cup stays on its landing surface. |
| leave me alone | A cursor reaches Mute All before clicking. Pings fall away, the character lowers both arms, closes their eyes and gets an inner-peace halo. These are illustrated controls; no actual game/chat action is sent. |
| prowler | A ward lights the would-be hiding place, then the red-masked figure sinks into the box: the gank was visible. The Prowler menace remains behind this gaming-context joke. |
| you saved me | The [Superman/Starman rescue context](https://knowyourmeme.com/memes/superman-starman) gets a second beat: an ally survives at 1 HP, health returns, and the last projectile reaches the raised fist before deflecting. |
| gary_meow | One meow calls a fish biscuit into the actual open mouth, crumbs fall, then the mouth closes. A pose cut removes the earlier translucent duplicate eyes. |
| mac-quack | The cursor contacts the popup's X. The window closes, three ducks escape, and the bottom reads Task failed successfully. |
| mom frog | One croak topples the microphone around its fixed foot; the original unimpressed photographic frog remains. |

Crab jumps now use the beach ball's actual crossing times. The oven's toast
lands exactly on the mitt. Piuw's primary impact starts when the projectile
reaches its endpoint. The returning UFO dog's foil hat now shares the dog's
transform, so it cannot slide off during the character's sway.

`culture-contacts.js` owns the cue-specific coordinates; it does not run physics
or own playback. `tools/test_sound_gags.cjs` validates seven jump clearances,
toast/hand contact, shoe/peel contact, cup landing, cursor/button contact and
projectile/fist contact. Its 56 full-composition frames and enlarged prop views
are in `output/sound-culture/gag-details-*.png`. The exact 30-source original-audio
review, browser lifecycle regression and muffin ending regression also pass.
The latest visual adjustments are rechecked with the targeted original-audio
review instead of repeatedly running unchanged cues.

The original audio element remains the sole playback clock and owns its duration,
pause and ended cleanup. Measured PCM envelopes guide light/door/prop accents.
Ten-ms positive spectral flux and autocorrelation identify a useful cadence for
music excerpts; supported half-time peaks are resolved only where the double is
also visible in the signal. The stored confidence/offset is reproducible from
original media. Short cues retain their established 12-ms attack/18-ms release.

Saved media, default profile, bindings, phrases, levels, filters and placement
remain unchanged. League artwork, including Hextech, is not part of this pass.
No OBS window is opened. New sources compile into the existing browser bundle;
there is no new worker, controller, resource owner or wall-clock animation.

## Verification

`tools/review_sound_culture.py` owns finite context extraction. Outputs in
`output/sound-culture/` include original-media hashes, source-video contact
sheets, measured envelopes and cadence. The review uses one local cached CPU
speech model, without microphone access or model downloads.

`tools/review_sound_culture.cjs` owns exact-scope isolated Chromium review:
all 30 sounds, nine story moments, full-resolution clear gameplay, unique composed
frames, reverse-seek reconstruction, original-sound playback, live motion,
supporting-hand alignment, end cleanup and unchanged original-media/settings
hashes. It captures eight three-moment motion contact sheets and a JSON report.
Its HTTP fixture issues only GETs and cannot trigger live stream actions.

Initial cultural-context pass: all 30 passed, with 270 full-resolution story samples and 9,735
live audio-clock frames. All original media hashes matched, all gameplay samples
were clear, and all ended previews cleaned up. Browser playback/gallery checks
passed; the live Hub serves all 30 story owners without page errors. The
architecture check passed 405 modules with zero violations, and the full offline
suite passed 1,001 tests. The updated browser playback workflow explanation is
reviewed; unrelated existing workflow scope/AST notices remain unstamped.

Finite-action follow-up: all 30 passed again, with 270 samples and 9,530 live
audio-clock frames. A targeted rerun passed for Pedro and the telephone after
the last record-mask/socket corrections. The additional muffin regression passed
for lyric timing, all eight deaths, no revival, backward seek, replay and end
cleanup. Browser playback regressions, 13 relevant offline tests and the
405-module architecture check passed. The running Hub gallery was checked at the
new ending with no page errors; no Hub restart or OBS launch was needed.
The browser playback workflow was reviewed; unrelated workflow notices remain.

Supplementary cultural references:
[original Crab Rave video](https://www.youtube.com/watch?v=cE0wfjsybIQ),
[Cas van de Pol's dragon animation](https://www.youtube.com/watch?v=9MCiixIkzUk),
[Pedro circular dance context](https://knowyourmeme.com/memes/raccoon-dancing-in-a-circle-pedro-pedro-pedro),
[Milton rat-dance context](https://trending.knowyourmeme.com/editorials/guides/what-is-the-rat-dance-meme-miltons-dancing-rat-tiktok-trend-explained),
[Akira overload context](https://knowyourmeme.com/memes/leave-me-alone-akira).

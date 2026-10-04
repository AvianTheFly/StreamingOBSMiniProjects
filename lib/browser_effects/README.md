# Browser stream effects

The supported v2 Hub starts one loopback service at **127.0.0.1:7444**.
Each participating module owns a channel and an OBS browser input. Soundboard's
`die die die` retains its original audio with an amber patisserie border.
Hooray (`@`) keeps its original audio with transparent foil confetti, corner
party poppers, curled streamers and gold perimeter ribbons. Ctrl+1 (`!`)
celebrations each have independently authored scenic borders. John Cena is on `5`; `%` (Shift+5)
is the Hub intro. Crab Rave already belongs to the `!` random group. Oh No, Bonk, and Anime Wow also use borders.
They keep their original audio length and per-asset gain. Most shows leave the
gameplay center clear; Hooray scatters sparse foil over a transparent canvas.
Open the existing soundboard trigger window
first, then use Ctrl+6 / the existing `^` profile mapping. The trigger gate is
intentional and must be preserved. Voice matching, random groups and the explicit
Hub test button use the same player path. No keyboard input is simulated.

## Responsibilities

| File | Responsibility |
| --- | --- |
| `catalog.py` | Read module effect mappings and select supported renderers |
| `session.py` | Current playback ownership, pause clock, start/end acknowledgements |
| `audio.py` | Preserve original audio in an external ffmpeg WAV cache |
| `player.py` | Module adapter, preparation, OBS fader, completion/cancellation |
| `obs_source.py` | Create/reuse full-canvas browser inputs without resetting user edits |
| `runtime.py` | Hub-owned HTTP lifecycle and per-project channel lookup |
| `http_server.py` | Host checks, scoped media, byte ranges and acknowledgements |
| `web/playback.js` | Browser audio lifecycle, polling, offline cleanup |
| `web/muffins.js` | Compatibility adapter for the retained muffin cue |
| `web/renderers.js` | Explicit renderer selection for the active effect |
| `web/borders.js` | Perimeter canvas and boundary finish |
| `art/hooray.js` | Bounded full-canvas foil particles and gold borders, compiled into rave.js; native alpha without chroma key |
| `web/production.js` | Thin compatibility facade for the shared optical mechanics |
| `web/rave.js` | Generated sound scenery and audio-time development; source in art/sound-scenes.js |
| `web/subtle.js` | Gameplay mask, sprite atlas decoding, atmospheric fields and fading light trails |

## Integration contract

Soundboard retains its PlaybackWorker, coordinator, profile selection, matching,
volume calculation and finish callback. Mapped assets call BrowserPlayer; other
assets use their existing renderer. Mappings live in the module's
`browser_effects.json`, separate from personalized profiles and OBS overrides.
Additional modules can use the same adapter and their own channel/source.

The browser source is `Hub Soundboard Effects`, nested in `soundboard` so the
existing Test/game and Lobbies scene links show it. It uses a transparent 1920x1080
canvas, 30 FPS and OBS-controlled audio. New sources scale to the base canvas;
later transforms and filters are preserved. The source stays loaded and transparent
while idle. There is no idle animation loop. Pause freezes audio and choreography;
resume continues at the same position. Changing clips serializes old cleanup before
new playback. Stale end acknowledgements cannot stop a replacement.

Soundboard keeps Monitor and Output on track 2. Desktop Audio carries monitored
audio to stream track 1, matching the established routing. Gain is the existing
project + profile + category + per-file value. Browser audio plays at unity;
OBS remains the fader. Hub audio memory attributes changes to the channel's loaded
stem, including while idle, and never changes unrelated assets. New audio cache
files live at LOCALAPPDATA/StreamingHub/browser-effects/audio and do not normalize,
trim, or overwrite originals.

Per-asset small-video transforms and chroma filters are preserved in the existing
settings; they describe the original video's placement, and are not suitable for
the entire border canvas. A new production renderer controls the placement of its
characters. Do not migrate other assets by replacing their saved data or applying
their original crop/chroma filter to the full-screen browser source. When extending
the migration, interpret each asset's placement/filter data within its renderer and
retain all profile/phrase/volume/layout files.

## Transport behavior

The server is loopback-only. Static files are allowlisted. Audio URLs contain the
current random playback ID; expired IDs cannot retrieve files. Only audio prepared
by the owning module is served; paths supplied by clients are never opened. Byte
ranges support seeking/reloading. JSON acknowledgements reject cross-origin callers
and refer to a specific playback ID. Audio `playing`, `ended` and `error` events
provide actual browser playback evidence; a server poll alone does not prove audio.
Loss of server contact clears visuals/audio within 2.5 seconds. Startup failure or
autoplay rejection ends the request and releases coordinator ownership.

Twitch alerts remain in `mini projects/twitch_celebrations` at port 7443. Its live
OAuth/EventSub transport and raid renderer are independent of manual effects, so a
muffin stop cannot discard a queued raid. Twitch can listen while OBS is offline.
An existing OBS alert source is refreshed when its server starts, recovering an
OBS page opened before the Hub. No archived modules or duplicate Hub are required.

## Verification and use

Run `py -3.11 -X utf8 -m unittest tools.test_browser_effects tools.test_twitch_celebrations
tools.test_audio_settings tools.test_player_interfaces tools.test_hub_startup
tools.test_editor_profiles` from the repository root.

`tools/test_browser_rendering.cjs` checks the actual browser renderer and audio
lifecycle in isolated headless Chromium. It does not operate the user's desktop.
Provide Playwright through NODE_PATH if it is not installed in the repository.

In the Hub's Soundboard page, **Test Muffin Dance** uses the same asset, volume,
coordinator and player as the trigger-window Ctrl+6 shortcut. The OBS source's own screenshot can be inspected
through GetSourceScreenshot without moving the mouse or changing scenes. HTTP
`/api/state/soundboard` includes last_playback status for start/end/error diagnosis.
Twitch control shows each accepted subscription and the last live event. A synthetic
raid validates rendering; actual Twitch delivery still requires a real raid.

## Original scenery and sound-cue choreography

All 90 mapped sound cues have canvas presentations. The main 25 now use
authored vector props and independent motion, including the approved recovered
Cena/muffin performances and the accelerating Deja Vu circuit. The other 63
library scenes remain subject to the active collection redesign/review.
Hooray's sparse confetti can cross the picture while gold ribbons stay at the
edges. Its original video and saved chroma filters/placement remain preserved;
only its audio is played. Mom Frog now uses the extracted photographic frog
in three views, lily-pad concert props and glass ripples, driven by its original
0.418-second croak. `art/mom-frog.js` owns its composition; the original video is
retained, with cleaned audio and an external original-media backup. The finite
`tools/prepare_mom_frog.py` maintenance tool records the audio recipe without
normalization or changes to saved faders.
Edit the cue owners assembled by `art/sound-scenes.js`, then run
`py -3.11 tools/build_border_art.py`; `web/rave.js` is the generated delivery bundle.
The former sound PNG originals remain preserved, but their bytes are no longer
embedded or decoded by the live sound renderer. The Mom Frog sheet is embedded
in the delivery bundle and decoded once before playback. No animation worker or
audio clock was added.

Each scene develops against the existing audio time: a drift car traverses a
night circuit, perforated film reverses between machined reels, a gilded coffin
is carried in the top strip, metallic crabs dance through water-light wakes,
and a wooden violin is bowed at the edge.
The compositions have different placements, materials and motion. There is no
common ribbon frame. Alpha stays zero in the gameplay opening
(x240–1680, y170–840 at 1920×1080). Solid props avoid standard corner HUDs;
translucent atmosphere and light can travel through the rest of the perimeter.

Original audio, durations, shortcut groups, aliases, gains, filters, transforms
and personal settings are unchanged. The follower art also remains unchanged.

| Sound asset | Authored scene |
| --- | --- |
| `die die die` | Recovered dancing muffins and changing metallic titles |
| `oh no` | Tipping porcelain teacup and settling droplets |
| `JOHN CENA` | Championship belt, arena uprights and gold lights |
| `bonk_7zPAD7C` | Machined hammer, sprung mounting and settling impact rings |
| `anime-wow-sound-effect` | Opal prism and spectral glints |
| `dancing music` | Mirror ball, moving mosaic reflections and light caustics |
| `coffin dnace` | Gilded carried coffin and staggered warm edge lights |
| `celebrate` | Crystal-tipped wand, gold ink and rotating spell circle |
| `crab rave` | Dancing metallic crabs, tidal light and bubbles |
| `fun celebration` | Sculptural foil balloons and rising confetti |
| `rat dance` | Silver dancing rat, cable tail and machined service pipes |
| `Pedro` | Seven dancing raccoons, hats/shades/headphones, DJ deck, foils, confetti and light floor |
| `Sigma Boy` | Smoked chrome eyewear and architectural reflections |
| `Deja Vu` | Drift car crossing a night circuit with fading taillights |
| `hype up music` | Glass oscilloscope fins and developing wave traces |
| `meow meow` | Travelling pixel cat and prismatic wake |
| `dang it` | Compressing chrome tension spring and settling ripples |
| `im cooked` | Copper skillet, sapphire heat and rising steam |
| `OH NO NO NO NO` | Cracked glass pressure vessel and rising charge |
| `I shouldve seen that coming` | Machined reversing reels and perforated film |
| `sad violin` | Five-instrument orchestra, moving bows, notes, tearful glass cameos and open score |
| `woops` | Tipped glass vial and glistening liquid ribbon |
| `How could this happen to me` | Fractured rose quartz heart and drifting petals |
| `roblox-old-winning-sound-effect` | Assembling pixel trophy and scanning score tower |
| `check-mark_oPG7Xo5` | Enamel success seal and unfolding laurel |

`tools/verify_border_materials.cjs` checks every sound at four moments without
labels, including transparent center, solid detail, atmosphere and distinct
rendered frames. `tools/preview_border_cinema.cjs` exports silent animated
previews over a local gameplay frame. Set `BORDER_REVIEW_ARTIFACT_DIR` to choose
an output directory (the current review uses the task workspace on C:).
`tools/verify_border_rework_obs.py` is finite native OBS QA: private silent
source, guarded Studio preview, no program-scene writes or live audio.

See `art/ART_DIRECTION.md` and `art/scenery-manifest.json` for generation briefs, exact prompts and provenance.
Scenic image caching remains available to other presentation owners. The sound
renderer has no image decoding to await, but retains the renderer readiness
contract; stale readiness callbacks cannot revive a replaced cue.

The 63 extended-library scenes each have an explicit composition selected by the
catalog `scene` field. `library-tech.js`, `library-play.js` and `library-mood.js`
own the focal performances; `library-accents.js` owns independently arranged
supporting casts. Iris blades, docking shutters, shells, watch escapements,
roulette enamel and other cue-specific structures have their own paths and
choreography. `cue-accents.js` adds contextual supporting performances to the
primary cues. Pedro and violin's larger casts stay in their character/reaction
owners. Approved Cena, muffin and car compositions bypass these additions.
This dispatch does not alter the media owner or the audio clock.
The exact 1920×1080 transparency mask is shared immutably within each page.
Short cues scale their entrance and exit to their actual duration.

Hotkey 5 / John Cena currently uses the recovered September 30–October 1
production composition in `art/arena-legacy.js`: slanted metallic Impact title,
paparazzi cameras, ring ropes, championship belts and moving spotlights.
The art builder embeds this isolated compatibility composition in `rave.js`;
other sound styles retain their current scenes. Original audio/profile data stay
in their existing owners.

`die die die` also uses the recovered October 1 `MuffinShow`: rubber-hose
muffin dancers, singing faces, beat stars, original scenery and changing metallic
Impact titles. `muffins.js` consumes only the recovered design factory exported
by the generated art bundle; audio and completion remain in `playback.js`.

Deja Vu currently previews `art/night-run.js`: a hand-drawn coupe racing around a rounded circuit on all four
edges, shifting tachometer, manual H-pattern shifter, checkered cloth and fading road-light wakes.
The gauge and shifter progress through gears 1–5 while the coupe accelerates,
completing its circuit before the original 6.873-second audio fades out.
Side light wells, kerb reflectors and marshal gates provide translucent supporting
motion; corner sparks vary by their absolute birth positions. Car scale and alpha
soften near standard HUD locations. Arc-length sampling keeps turns and the lap
seam continuous, driven solely by audio time.
The car, Cena, muffin and Hextech effects remain approved references; the other
sound cues have new compositions and supporting casts awaiting user review.
`BORDER_SOUND_PREVIEW` selects one sound for the finite motion review,
and `BORDER_REVIEW_LABELS=0` shows only the actual presentation.
`BORDER_REVIEW_SECONDS` sets the review length to match the actual audio duration.

The collection refresh is tracked per cue in `docs/BORDER-REFRESH-20261002.md`.
Hotkey `2` retains its original five-file random queue and saved audio levels.
Short border cues now warm their atlas/mask before audio starts and use a 12-ms
entrance/18-ms exit rather than spending much of a half-second clip fading.
The existing audio clock still owns drawing, pause and ended cleanup. Long and
non-border presentations keep their original fades. Review exports distribute
60-fps-or-better samples over the exact sound duration; decoded-frame tests
check both visibility and A/V start/end timestamps. The file review has external
play/replay/scrub/loop controls, millisecond readouts and one audible cue at a
time, so native controls cannot obscure the bottom border. Looping is preview-
only; live hotkeys still play their original sound exactly once.
`art/spam-cues.js` dispatches its character borders: Tom's button/popcorn,
Gary's underwater snacks, a duck desktop, the Bonk mallet crew and Piuw space
cadets. Each uses a native three-pose transparent atlas and its actual audio
duration, with no added timer or source controller. The five performance owners
share only local paint mechanics. `tools/review_spam_cues.cjs` verifies actual
audio playback, pause determinism, cleanup, transparency and unchanged media,
and writes individual playable examples to `output/spam-cues/review.html`.
`art/authored-cues.js` replaces earlier scenery for Crab Rave, Coffin Dance,
Bonk, anime Wow, dancing music and hype music with independent code-native
performances. Each has its own prop geometry, light composition and motion.
Audio/channel ownership, original media and user settings are unchanged.
`BORDER_SOUND_PREVIEWS` accepts a JSON list and exports a separate four-second
60-fps review for each selected cue.
`BORDER_REVIEW_DETERMINISTIC=1` exports exact 60-fps JPEG frames instead of a
wall-clock MediaRecorder clip. A finite maintenance export can then encode those
frames with original audio through `lib.media_jobs.jobs`, avoiding recorder
startup latency and preserving the complete sound in review examples.

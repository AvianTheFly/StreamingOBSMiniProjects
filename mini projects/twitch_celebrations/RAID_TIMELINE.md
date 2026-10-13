# Incoming raid: the border comes to life

The show lasts one non-repeating music cut: 6.551 seconds for Crab Rave,
6.625 for Toothless, 6.389 for Nyan and 6.429 for Pedro. The server owns
that expiry; the browser animates from the owned audio element's position. A large top-center
announcement identifies the actual raider and exact viewer count; long names fit
without ellipsis. Only that useful announcement contains text. The central
rectangle x=240..1680, y=170..840 remains transparent at every phase. The top
announcement is clipped to the upper 15.4% of the screen.

This replaces the former three-slot carousel. There are ten one-time acts with
different trajectories, physical setups and visual payoffs, not a repeating
entrance or a group of continuously bobbing characters:

Times below are authored story coordinates, mapped to the score, not wall-clock
seconds. They retain physical contact relationships while the whole show is retimed.

| Story coordinate | Act and payoff |
| --- | --- |
| 0.00 | Tiny crabs yank the party cord, hop onto a cannon, and launch colored stars |
| 0.48 | Toothless drops in, lands with a squash, winds up and sneezes paper butterflies |
| 0.95 | The ending-screen penguin surfs a wake, jumps with a fish, and earns a crown |
| 2.10 | Bongo cat plays a staggered solo; notes escape and the last hit hatches a duck |
| 2.78 | Pedro tosses a record high along the edge, catches it, and gets a DJ crown |
| 3.18 | Nyan Cat streaks across the bottom with a long rainbow and delivers a star parcel |
| 4.35 | A UFO arrives, beams up the spinning cat and lifts it into a corkscrew exit |
| 4.94 | A banana slips on a record, somersaults, lands and takes a crowned bow |
| 5.28 | A frog's trumpet notes become flowers blooming up the edge and across the top |
| 6.50 | Headphone cat crowd-surfs a single wave of cheering hands across the bottom |

Scenery develops with the show: bunting unfurls, mirror balls drop independently,
balloons rise, speakers arrive, discrete edge rockets burst and a single crowd
wave travels across the bottom. The final two seconds add corner streamers and
staggered confetti bursts. Saturated colors, dimensional props and more active
border space give the show energy without a full-screen overlay. At most four
principal acts overlap briefly; Mob and video panels remain absent. Alert identity
varies color arrangements and small staging details; theme can mirror the show.
Each authored act occurs once per raid, not infinitely unique content across raids.

`raid_story.js` owns finite timing and analytic trajectories. `raid_acts.js` owns
character-specific props and payoffs. `raid_effects.js` owns bounded stagecraft.
`raid_party.js` composes and clips one canvas. `raid_cast.js` owns native puppets;
`raid_penguins.js` caches poses from feature-local copies of the user's original
ending-screen art. `raid_sequence.js` owns the announcement, name fitting, audio
cues and cleanup. The existing overlay clock, transport and queue own lifecycle.

There are no new workers, timers, decoders, settings or external media requests.
The existing audio element uses four feature-local single-pass WAV cuts.
No full-frame brightness pulses or strobes are used. Reduced motion uses a fixed
composition and announcement, then clears at expiry. This is not a medical safety
guarantee. Music/mute/current volume remain with their existing owners. Saved
custom visuals remain stored but do not produce panels in raids. Other event
presentations retain their behavior.

The browser proof in `tools/test_raid_rendering.cjs` exercises actual production
art, every act, all themes, clear center across transitions, distinct frames,
non-repeating act windows, rendered name/count, long-name fitting, reduced motion,
expiry, budget and transport/audio cleanup. Six full-resolution story frames and
a single-pass music-synchronized movie support visual review. The off-air OBS verifier checks the
configured source, clear center, visible production, name region, clean expiry,
and unchanged settings/faders/filters/tracks/placements. It never records or
saves a replay. Earlier media downloads remain for provenance and reuse.

## Connected character comedy

The existing show is joined by five finite interactions using unmodified local
copies of all 24 generated lobby poses. Original lobby art and behavior are not
changed. `raid_guests.js` owns a bounded page-local image cache;
`raid_crossovers.js` owns interaction timing and shared prop/contact paths.
`tools/prepare_raid_guests.py` verifies exact hashes and records provenance.

| Time | Connected gag |
| --- | --- |
| 0.15–2.18 | A crewmate repairs the crab cannon's fuse box. The repair powers its existing 1.13-second shot, kicks a bolt loose, and lands a party hat on the startled engineer. |
| 1.25–3.58 | Knife goose steals a cupcake. Kirby inhales it from the next ledge, puffs up, and spits a star into Bongo's drum as its rubber duck pops out. Goose escapes with the wrapper. |
| 3.00–5.25 | The cauldron climber plants a fixed-length hammer on a ledge, almost makes it, and slips. Hornet watches, leaps in, and catches the actual moving pot with silk. A tiny victory pennant unfolds. |
| 3.90–5.62 | Boo peeks from Pedro's deck. The same flying record is diverted onto Boo's head as a DJ hat, and Boo hides its embarrassed face. |
| 5.48–7.92 | Creeper winds up a party blower, hops, and launches confetti with a gold cup. The startled salvage robot tracks the cup across the bottom and catches it. |

New comedy uses existing spare perimeter space, with at most four support
characters overlapping alongside the bounded principal cast. Mirrored themes
mirror both characters and shared prop paths. No text labels, repeated windows,
new timers, media decoders, settings changes or external image requests are added.
Browser regression checks render every pose, verify unique pose pixels and
single-run scene windows, measure the anchored hammer, and check shared snack,
record and trophy endpoints. All-theme center clipping, expiry, reduced motion,
name fitting, audio and transport checks remain.


## Musical score and single-pass playback

The original Crab/Pedro preparation baked repeats into 16-second MP3s. Matching
waveforms found repeats at 7.407/7.384 seconds; Nyan repeats its phrase near 6.760.
`tools/prepare_raid_music.py` preserves those sources and makes shorter WAV cuts,
with a 360 ms end fade and a 420 ms landing after the last scored beat. Exact
source hashes, measured onsets/BPM, durations and contact anchors are recorded
in `raid_score.json`; the queue and private preview read that same contract.

| Contact | Crab music position |
| --- | --- |
| Crewmate powers the cannon | 0.850 s |
| Toothless confetti sneeze | 1.330 s |
| Kirby star hits Bongo / duck appears | 2.770 s |
| Hornet throws rescue silk | 3.731 s |
| Pedro's record lands on Boo | 4.211 s |
| Creeper confetti / trophy launch | 5.171 s |
| Salvage robot catches trophy | 6.131 s |

All four scores anchor these shared contacts to observed beats. Monotone smooth
retiming changes pacing between contacts instead of uniformly speeding up the
show. Bongo plays half-beat notes, dancers articulate on the beat, speaker cones
kick geometrically, and discrete edge fireworks land on scored beats. Brightness
stays steady. All gags, shared prop paths and the gameplay aperture are preserved.

The sole overlay RAF reads music currentTime. Initial playback catches up to the
server position; stalled music holds animation, and blocked/failed music falls
back to the bounded server clock. Audio ending clears a raid immediately, and
its completed ID prevents a still-active server snapshot from restarting it.
Expiry, replacement and disconnect retain existing cleanup. Custom audio and
its saved level remain intact; custom tracks have no measured score and use the
selected theme's timing. No custom audio is rewritten or repeated.

The browser proof checks beat/contact alignment, monotone retiming, media-clock
holds/seeks, early audio-end cleanup, complete cast, center transparency and
expiry. `tools/export_raid_preview.cjs` renders production frames at exact audio
timestamps and muxes one audio input without looping or a review-video tail.

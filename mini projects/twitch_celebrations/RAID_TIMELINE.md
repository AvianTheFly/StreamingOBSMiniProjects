# Incoming raid: four personal arrivals

Eight seconds from the server timestamp. The arrival develops instead of resetting
one burst on a loop. Geometry is authored in `raid_art.js`; `raid_sequence.js`
owns the cue list and audio lifecycle. `raid_sequence.css` owns name, count,
mascot choreography and exit. Existing music, chimes and personal media remain.

| Flavor | Details |
| --- | --- |
| Crab harbor flotilla | Growing tide contours, separate paper-boat arrivals, tiny sail stars, wakes, pearl fan, boarding pennants and rising bubbles |
| Dragon lantern flight | Arched flight trails, individually launched glass lanterns, folded dragon kites, hanging crystal and tiny constellation lights |
| Cosmic cat express | Cat-eared space train, illuminated windows, rainbow rails, orbital corner stations, punched constellation ticket and antenna |
| Frog lily-pad carnival | Sequential flowering stepping-stones, pond ripples, musical reeds, lily crown and gently drifting notes |

| Time | Choreography |
| --- | --- |
| 0.00 | Quiet edge arrival with the existing radar chime |
| 0.65 | Personalized name, flavor-specific headline and count reveal |
| 1.50 | Music reaches saved volume; the matching crew joins along the sides |
| 3.20 | Props continue arriving; mascots shift to a playful wiggle |
| 5.00 | Small side sparkle release, gentle cheer motion and appreciation |
| 6.40 | Welcome headline and a slower settle |
| 7.40 | Smooth panel and artwork exit; fully clear at eight seconds |

Artwork is feathered toward gameplay, with bounded translucent alpha. Trails have
bright heads and disappearing tails. Variation is seeded from alert identity,
never from viewer count; particle/prop budgets remain fixed. The center region
x=240..1680, y=170..840 stays clear. Reduced motion freezes the illustration,
removes travel traces and CSS motion; name/count and lifecycle still work.

Mute and current saved volume apply to music and active chimes. Late joins skip
old sounds and render the correct current phase. Stop, expiry, pause, replacement
and server loss dispose raid layers and stop music, chimes and custom video.
Private preview never polls or consumes live events. Four worlds still shuffle
without adjacent repeats through the existing queue. Incoming EventSub delivery,
deduplication, raid priority and channel ownership checks are unchanged.

OBS uses the shared `Hub Twitch Celebrations` browser source: 1920x1080, 30fps,
local port 7443, OBS audio routing, no shutdown/restart on scene activation. The
attachment helper repairs its route and stream-track membership without resetting
filters, transforms, audio fader or other track selections. Existing instances
in Test, Lobbies, just screen and afk reuse that source.

Verification: `py -3.11 tools/test_twitch_celebrations.py` and
`node tools/test_raid_rendering.cjs` (Playwright with installed Chrome).
The Chromium test uses an isolated static fixture and produces
`tmp_obs_debug/raid-worlds.png` plus `raid-worlds-motion.webm`; it never sends an
alert to the live Hub. It covers distinct actual artwork, center transparency,
alpha bounds, reduced motion, frame time, late join, stop and transport loss.
Real Twitch delivery still requires an incoming raid; a local OBS test proves
only the Hub-to-browser rendering and playback path.

## October 2026 material refinement

Built-in cartoon mascots are replaced by the authored scenic art. Personal visual
overrides retain their existing playback path. Paper boats now have cut-metal
hulls and glass sails; lanterns have glass ribs and small brass caps; the express
uses folded chrome cabins; lilies use refracting petal planes. Shared material
mechanics come from `lib/browser_effects/web/production.js` via `/optics.js`.
The original eight-second sequence, live name/count, private preview, queue,
audio, fader and transparent gameplay opening are preserved.

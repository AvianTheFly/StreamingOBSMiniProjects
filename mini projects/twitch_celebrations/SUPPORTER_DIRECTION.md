# Subscriber and follower spirit moments

Subscribers and gift batches receive a 3.8-second miniature cinematic; followers
receive a 2.2-second corner welcome. `supporter_show.js` and `.css` own these
independently from the full-screen OBS transition. Follower sprites/layout and
existing event durations remain unchanged. Native composition lives in the
supporter performance owner; no scene switch is added.

| Spirit | Subscriber | Follower |
| --- | --- | --- |
| Stormclaw / bear | Storm den, cubs, etched thunder, glass umbrella, den steps and paw charms; gifting adds rail parcels opening into cubs | Little bear and soft paw/claw sparks |
| Verdant Aegis / turtle | Leaf terrarium, tiny keepers, growing shoots and glass butterflies; gifting adds seed boats and new turtle sprouts | Tiny greeting and hexagonal sprout |
| Sundering Gold / ram | Golden horn workshop, geared arches, prisms and jeweled anvil; gifting delivers crowns from a carriage | Horn salute and three gold fragments |
| Cinder Ascension / phoenix | Egg hatching, feather fans, birds and flowing glass ribbons; gifting opens ember envelopes into fledglings | Wing cameo and ember trace |

The viewer name is the hero of the subscriber text, supported by tier and observed
months. Returning subs can share a message. Spirits shuffle without adjacent repeats. Legacy theme
slots map crab→bear, dragon→turtle, cat→ram and frog→phoenix to retain personal
media. The control page changes labels and exposes preview-only tier/month/message
fields. Prime status, tenure and streak are never inferred from absent data.

Subscriber wording has 36 authored combinations: three variants for each spirit
and each new-sub, returning-sub and gift context. The bear's den, turtle's grove,
ram's golden gate and phoenix's flock have separate vocabulary and humor. Four
additional anniversary messages use observed month counts at multiples of 12;
gift messages use the actual count with singular/plural agreement. An event ID
selects wording consistently across simultaneous overlays. Shared resub messages
take priority over the authored line.

The username is supplied at runtime through `textContent`, never embedded in a
sprite or interpreted as markup. It reveals smoothly over 0.42–0.9 seconds, with
the message following at 0.68–1.03 seconds. Names fit after font readiness and
viewport changes, shrinking or wrapping to two lines within the top strip.
Reduced motion shows text immediately. Follower wording and visuals are retained.

Timing: anticipation 0–0.55s, impact/reveal 0.55–1.3s, recognition until 3.25s,
smooth exit by 3.8s. Each animal has independent choreography and an original
stereo sound bed with an aligned cast/impact. Follow accents are shorter and
quieter. Rebuild WAVs with `build_supporter_audio.py`; existing media, saved module
gain, OBS fader and filters are preserved. Custom visual/audio slots take priority.
Video and sound stop on expiry, replacement, stop, pause or server loss.

Subs and gifts keep the main spirit, name and details in the top-center
168-pixel strip of the 1920×1080 canvas. Small supporting casts and staged prop
deliveries develop at the perimeter. The background is transparent; reflective
subjects remain readable, alongside glass leaves, gold, pearl and feather detail.
Glass and light use selective translucency; the shared mask
only feathers the boundary next to gameplay. The gameplay center stays clear.
Follows retain their approved small
lower-left welcome. No full-screen blackout or game-camera shake. Reduced motion
holds a stable illustration and text with the same lifecycle.
Artwork preloads before consuming live events. A preview waits for decoding;
stopping during loading cancels the pending preview.

`channel.subscribe` provides new-sub identity/tier. The newly registered
`channel.subscription.message` provides returning-sub months and shared text using
the existing `channel:read:subscriptions` permission. Individual gifted-sub notices
are ignored in favor of the batch, including anonymous gifts. Source event IDs
retain deduplication; account ownership checks, disable and pause remain intact.
Raids retain queue priority, followed by subscriptions/gifts; these can displace a
lower-priority queued event without interrupting the active celebration. No chat
messages are sent. Private previews never consume live events.

Research favored channel-specific motifs and personal recognition. Nogodi's
artist-authored case study shows per-viewer and tier variation; Twitch documents
name/tier/tenure/message customization. Searches for major-streamer alerts did not
establish their current exact animation/timing, so none is claimed as reproduced.

- https://www.behance.net/gallery/217500105/Nogodi-Sub-Alert
- https://help.twitch.tv/s/article/alerts-by-twitch-customization
- https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channel-subscription-message

Verification: `py -3.11 tools/test_twitch_celebrations.py`,
`node tools/test_supporter_rendering.cjs` and `node tools/test_raid_rendering.cjs`.
The renderer test uses `tools/celebration_fixture.py`: production routes with no
Twitch listener, OBS access or settings writes. It checks four sub/follow variants,
relative footprint, a clear gameplay center, visible border details, unchanged follower
fingerprints, evolving frames, frame budget, contextual copy, anniversary and
gift wording, dynamic name fitting at full/half resolution, metadata omission, escaping,
custom media, stop, expiry, reduced motion and private control preview. Artifacts:
`tmp_obs_debug/supporter-spirits-motion.webm`, `subscriber-spirits.png`,
`follower-spirits.png`. OBS still uses the shared source in Test, Lobbies, just screen
and afk with saved transforms, filters and fader. Live Twitch delivery needs an
actual incoming event; local tests prove only the playback/normalization path.

# Twitch Celebrations

Open **Hub → Tools → Twitch Celebrations**, or http://127.0.0.1:7443.
This is a supported Hub module, separate from the silent Channel Points stickers.

## Included shows

- Crab Carnival, Dragon Disco, Cosmic Cat Club, Frog Fiesta.
- Raids: eight-second authored arrivals with a translucent name panel, animated
  viewer count, reflective edge scenery, glass details, fading light trails,
  welcome outro and the existing music/chimes. Each flavor has its own world:
  crab harbor flotilla, dragon lantern flight, cosmic cat express, frog lily-pad
  carnival. These keep the gameplay center transparent. See `RAID_TIMELINE.md`.
- Follows: 2.2 seconds, one small spirit cameo and a friendly corner name.
- Subscriptions and gift batches: 3.8 seconds, four original miniature spirit
  cinematics with original bear/turtle/ram/phoenix miniatures.
  Names, actual tier, returning-sub months/messages and gift counts personalize
  the celebration. Missing facts are omitted. See `SUPPORTER_DIRECTION.md`.
- Cheers: seven-second pearl harbor, amethyst alchemy, orbital crystal and lily
  fountain worlds, with real usernames/Bit counts at the top center. Each has
  separately timed prop development, reflections and fading light trails.
- Raid/cheer hooks: Crab Rave, Driftveil City (Toothless dance), Nyan Cat and Pedro.
  Each is prepared as 16 seconds, normalized to -17 LUFS / -2 dB true peak, with
  fades. Character changes follow the selected track cadence.
- Four original synthesized tracks remain optional; reproduce with `build_audio.py`.
- Dance cameos are copies of the existing League library's Minions, Tobey and
  Squidward clips. No existing media or audio settings were modified.

The 16 subscription/gift/raid/cheer acts are native compositions built by
`tools/build_border_art.py` into the 30 KB `raid_art.js`. The thin assembly lives
in `art/celebration-scenes.js`. Local ink/subject helpers supply materials and
silhouettes; `supporter-performances.js`, `raid-performances.js` and
`cheer-performances.js` own composition and choreography. Gifts have separate
delivery acts: thunder gifts/cubs, seed boats/turtles, a crown carriage and ember
envelopes/fledglings. Subscriptions have a storm den, leaf terrarium, horn
workshop or hatching feather fan. Raids assemble a crab flotilla, lantern-bearing
dragons, occupied cat train carriages or jumping frog musicians. Cheers unfold
a pearl chest, alchemy retort, observatory or botanical wind instrument.

Names and contextual wording remain at the top. The approved follower drawings
and placement retain their existing renderer. Its four original images are now
owned in `spirit_assets/`, so scene-transition cleanup cannot break follower
readiness. Personal media overrides remain authoritative. Original generated
scenery remains preserved, with unused sound atlases archived on C: after the
project drive filled. All art uses existing elapsed time and clears on expiry;
shared optical helpers supply materials/masks without event policy or workers.
See `MEDIA_SOURCES.md` for audio provenance and preparation.

## Setup and use

1. **Preview the party** plays privately inside this page, with audio. It never
   enqueues an OBS alert. Select each flavor to audition it.
2. **Add overlay to current OBS scene** creates/reuses `Hub Twitch Celebrations`.
   Repeat in other desired scenes; it reuses the same source. The canvas is
   1920×1080 at the intended custom 30 FPS. Existing source transforms, filters
   and fader settings are preserved. The game/stream output stays at its own FPS.
3. **Connect Twitch**, then authorize the channel owner's account using the
   displayed Twitch link/code. Uses the existing `.env` `TWITCH_CLIENT_ID` and
   `TWITCH_BROADCASTER_ID` (and `TWITCH_CLIENT_SECRET` if configured).
4. **Send test to OBS** explicitly plays on the stream overlay. Live events shuffle
   the four shows without adjacent repeats. The selected preview flavor affects
   manual tests, not the automatic shuffle.

The original default is 22%; your latest saved gain remains authoritative. Subs
and follows use original spirit accents at that same gain. OBS
receives browser-source audio directly. The OBS fader remains independently usable.
The overlay does not alter other sources, mute gameplay, or switch scenes.
For another canvas size, scale the source once in OBS to fit your canvas.

## Media customization

Put small clips in `media/`, reload the control page, choose a flavor and save its
visual/audio slots. Supports WebM/MP4/GIF/PNG/WebP visuals and WAV/MP3/OGG/M4A audio.
Transparent WebM is best for characters. Sub/follow clips play muted once and
stop with the alert; custom raid/cheer visuals retain their configured loops. Audio
plays once and fades out with the alert. Prefer music
long enough for an 8-second raid. HTTP serves only files directly in this folder.
Built-in raids use their authored scenery and original transparent miniatures.
Personal visual and audio overrides remain authoritative. Cheers use their own
native material worlds; subs/follows use the spirit artwork.

Raids keep the middle clear. Subs and gifts place their spirit, name and playful
charms at the top center, within the top 168 pixels of the 1920×1080 canvas.
The background stays transparent. Solid subjects remain visible; glass, vapor and
glints choose their own translucency. The shared mask feathers only the boundary
next to gameplay. Followers retain their small lower-left welcome.
Preview against your gameplay layout before going live.

## Structure for future agents

| File | Responsibility |
| --- | --- |
| `engine.py` | Pure queue, expiry, deduplication, shuffle and durations |
| `twitch.py` | Device OAuth, token refresh, EventSub subscriptions/reconnect |
| `main.py` | Lifecycle, locking, settings validation, OBS attachment |
| `http_server.py` | Loopback routes, CSRF/Host checks, media allowlist |
| `interface.py` | Hub status and stop/pause/resume arbitration |
| `overlay.js` / `.css` | Client clock, border choreography, media playback |
| `characters.js` | Original SVG character library |
| `supporter_show.js` / `.css` | Miniature spirit sub/gift cinematics and follower cameos |
| `cheer_show.js` | Four Bit worlds, runtime text fitting, custom media and cleanup |
| `raid_art.js` | Four raid arrivals and their material/light choreography |
| `build_supporter_audio.py` | Original short spirit sound accents |
| `control.html` / `.js` | Private preview and live controls |
| `build_audio.py` | Deterministic original audio generation |

Do not import or launch archived modules. `settings.json` is user data and is
included in Hub settings backups; snapshot before writing it. OAuth credentials
are stored outside the repo at `%LOCALAPPDATA%/StreamingHub/twitch-celebrations/`.
The Channel Points bridge and its credentials are untouched.

Queue behavior: up to 8 waiting events, at most one pending follow, raid priority
followed by subscription/gift priority (which may displace a lower-priority event),
without interrupting an active alert, 45-second expiry and one-hour in-memory
message-ID deduplication. Alerts wait for an overlay poll before starting. The
private preview does not poll/consume live events. Multiple OBS instances of the
same browser source see the same timestamped active alert. Losing the Hub clears
playback within 2.5 seconds; stop/pause clears the queue. Restart drops queued events.

Twitch authorization requests `moderator:read:followers`,
`channel:read:subscriptions`, and `bits:read`. Raid uses the incoming-channel
condition; follow uses v2 with the owner as moderator. Gifted subscribe events are
ignored in favor of the gift batch. Unavailable subscription types are reported
without disabling the others. No chat messages or reward changes are sent.

Official protocol references:
- https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
- https://dev.twitch.tv/docs/eventsub/handling-websocket-events/

Verification: `py -3.11 tools/test_twitch_celebrations.py`.
End-to-end Twitch delivery requires completing channel authorization and an actual
event; private preview and mocked event normalization do not establish that.

The control page reports each event hook, including raids and returning subscribers,
and the last live notification received. Saved tokens reconnect automatically and
refresh on expiry; startup validation checks both channel owner and application.
Hourly validation keeps a healthy EventSub socket open. A Twitch reconnect handoff
retains subscriptions; individual revocations mark only that event unavailable.
Twitch starts even while OBS is offline. The existing OBS alert source refreshes
once when this server starts so an OBS-first startup recovers an initially offline
page. Browser sources are attached in the broadcast scenes Test, Lobbies, just
screen and afk on this machine.

Manual soundboard production effects have their own reusable service at port 7444.
See `lib/browser_effects/README.md`; after the soundboard trigger, Ctrl+6 plays a muffin border show using the
existing soundboard audio/volume instead of its small video. This is independent
of Twitch's queue and celebration settings.

Current raid, cheer and subscriber artwork is authored in `art/celebration-scenes.js`
and `art/celebration-frames.js`, compiled into `raid_art.js`. Each spirit has an
individual scenic environment. Subscriber text is dynamic in the top strip;
the approved follower presentation and all custom media overrides are preserved.

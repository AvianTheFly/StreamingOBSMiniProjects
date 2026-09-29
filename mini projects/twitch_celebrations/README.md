# Twitch Celebrations

Open **Hub → Tools → Twitch Celebrations**, or http://127.0.0.1:7443.
This is a supported Hub module, separate from the silent Channel Points stickers.

## Included shows

- Crab Carnival, Dragon Disco, Cosmic Cat Club, Frog Fiesta.
- Raids: 8 seconds, raider name + viewer count, mirrored border mascots,
  changing characters, small dance-clip cameos, welcome outro, fading audio.
- Follows: 4 seconds and two small characters. Subscriptions: 8 seconds;
  gift batches: 10 seconds; cheers: 7 seconds.
- Default hooks: Crab Rave, Driftveil City (Toothless dance), Nyan Cat and Pedro.
  Each is prepared as 16 seconds, normalized to -17 LUFS / -2 dB true peak, with
  fades. Character changes follow the selected track cadence.
- Four original synthesized tracks remain optional; reproduce with `build_audio.py`.
- Dance cameos are copies of the existing League library's Minions, Tobey and
  Squidward clips. No existing media or audio settings were modified.

The mascots are original stylized drawings. Crab/Pedro cameos reuse local meme
video; the dragon is an original mascot dancing to the downloaded Driftveil hook.
See `MEDIA_SOURCES.md` for audio provenance and preparation.

## Setup and use

1. **Preview the party** plays privately inside this page, with audio. It never
   enqueues an OBS alert. Select each flavor to audition it.
2. **Add overlay to current OBS scene** creates/reuses `Hub Twitch Celebrations`.
   Repeat in other desired scenes; it reuses the same source. The canvas is
   1920×1080. Existing source transforms, filters and fader settings are preserved.
3. **Connect Twitch**, then authorize the channel owner's account using the
   displayed Twitch link/code. Uses the existing `.env` `TWITCH_CLIENT_ID` and
   `TWITCH_BROADCASTER_ID` (and `TWITCH_CLIENT_SECRET` if configured).
4. **Send test to OBS** explicitly plays on the stream overlay. Live events shuffle
   the four shows without adjacent repeats. The selected preview flavor affects
   manual tests, not the automatic shuffle.

Music begins at 22% within this module, with separate mute/volume controls. OBS
receives browser-source audio directly. The OBS fader remains independently usable.
The overlay does not alter other sources, mute gameplay, or switch scenes.
For another canvas size, scale the source once in OBS to fit your canvas.

## Media customization

Put small clips in `media/`, reload the control page, choose a flavor and save its
visual/audio slots. Supports WebM/MP4/GIF/PNG/WebP visuals and WAV/MP3/OGG/M4A audio.
Transparent WebM is best for characters. Visual clips loop muted and mirrored;
the separate audio slot plays once and fades out with the alert. Prefer music
long enough for an 8-second raid. HTTP serves only files directly in this folder.
Built-in clips appear as small lower-edge cameos in the second half of a raid.

The middle 74% of width × 62% of height stays clear. Side/bottom game HUD elements
may still overlap decorations: preview against your own layout before going live.

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
| `control.html` / `.js` | Private preview and live controls |
| `build_audio.py` | Deterministic original audio generation |

Do not import or launch archived modules. `settings.json` is user data and is
included in Hub settings backups; snapshot before writing it. OAuth credentials
are stored outside the repo at `%LOCALAPPDATA%/StreamingHub/twitch-celebrations/`.
The Channel Points bridge and its credentials are untouched.

Queue behavior: up to 8 waiting events, at most one pending follow, raid priority
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

The control page reports the health of **each** event subscription, including raids,
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

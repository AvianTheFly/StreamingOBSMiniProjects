# Browser stream effects

The supported v2 Hub starts one loopback service at **127.0.0.1:7444**.
Each participating module owns a channel and an OBS browser input. Soundboard's
`die die die` is the first production mapping: original audio, eight animated
muffins, beat-driven dancing, microphones, party hats, stars and corner lights.
Hooray uses its original confetti video, with no browser mapping. Ctrl+1 (`!`)
celebrations each have themed borders: disco, coffin procession, party confetti,
crabs, muffins, balloons, championship belts, rats, Pedro raccoons, sunglasses,
racing trails, equalizer bars, and cats. Oh No, Bonk, and Anime Wow also use borders.
They keep their original audio length and per-asset gain. The gameplay center is transparent. Open the existing soundboard trigger window
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
| `web/muffins.js` | Original canvas characters and audio-time choreography |
| `web/renderers.js` | Explicit renderer selection for the active effect |
| `web/borders.js` | Border confetti, reaction faces, belts, mallets and stars |

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

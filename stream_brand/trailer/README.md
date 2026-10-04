# Four spirits. One lane. — channel trailer

A 36-second introduction assembled from your existing saved Udyr replays, your
five-second cinematic intro, and the matching channel artwork. The edit opens in
combat, explains Udyr bot, shows the spirit world, returns to a play and an escape,
then turns a real death into the question behind Bot Lane Court.

The local deliveries are on C: because F: had less than 500 MB free during this
work. This does not change OBS recording storage, REPLAY_DIR, saved clip paths,
Footage Desk review decisions, tags, faders or the Hub runtime.

- `C:/StreamingMedia/ChannelPresentation/2026-10-02/channel-trailer-music.mp4`:
  original synthesized music only. No audio from the replays or existing intro.
- `C:/StreamingMedia/ChannelPresentation/2026-10-02/channel-trailer-voice-review.mp4`:
  original mixed recording audio plus the quieter new music bed. Listen to the
  selected commentary and sounds before choosing this version for publication.
- `trailer-manifest.json` beside the deliveries: exact source cuts, source SHA-256
  fingerprints and delivery verification. Originals were fingerprinted before
  rendering and checked again afterward.
- `trailer-storyboard.jpg` beside the deliveries: visual review of the edit.

The music-only version was uploaded with your approval on October 2, 2026 and
set as the channel trailer, with the matching thumbnail and League of Legends
category. Its title is **Four spirits. One lane. | UdyrIsABotLaner** and the
published video is [on Twitch](https://www.twitch.tv/videos/2889759322).
Featured Content was checked to confirm its Channel Trailer assignment. Twitch's
interface displays `0:35`; the local delivery has 2160 frames / 36 seconds.
The original-audio review version remains local.

The host-operated Court cards are installed; rehearse the segment before your
first live case. There is no automatic vote counter in this edit or the cards.
Publication screenshots and field verification are in
`C:/StreamingMedia/ChannelPresentation/2026-10-02/publication/`.

## Editorial timeline

| Time | Purpose |
| --- | --- |
| 0–4s | A genuine Udyr combat moment, with the visible payoff and camera reaction |
| 4–6s | Udyr. Bot lane. Yes, really. |
| 6–10s | The existing cinematic intro, including its closing title |
| 10–17s | Bot-lane approach, fight and aftermath |
| 17–24s | Chase and turnaround from your escape-tagged replay |
| 24–30s | A real death and the channel's theatrical event presentation |
| 30–32s | Genius or inting? Chat has a role |
| 32–36s | Four spirits. One lane. The channel name and invitation |

There is no invented rank, match result, schedule, viewer count or subscriber perk.
The original game HUD, camera framing and recorded event art remain visible.
The clip order is an authored montage, not one continuous match.

## Technical delivery and rebuild

[Twitch's channel setup guide](https://help.twitch.tv/s/article/channel-page-setup)
specifies trailers up to 60 seconds, 1080p/60 fps, H.264 picture and AAC audio,
up to 10 Mbps, stored in the VOD library. It currently limits channel trailers to
Affiliates and Partners; confirm the available controls in your own dashboard
before publishing. Our edit is 36 seconds / 2160 frames, with stereo AAC at
48 kHz and a 9 Mbps video rate cap. The measured delivery bitrate is about 7 Mbps.

The score is an original, deterministic synthesized composition; it loads no
samples or existing songs. Its harmonic bed, pulse, bass and percussion are in
`soundtrack.py`. A video with the mixed original clip audio still needs a listening
review; audio measurements do not establish what is being said or played.

`plan.json` owns editorial decisions. `timeline.py` checks that every input exists,
every cut lies inside the actual source, durations use whole frames, and originals
are outside the generated-output folder. `render.py` runs finite conversions
through `lib.media_jobs`, with one FFmpeg decoder/filter/encoder thread and hidden,
below-normal child processes. It verifies picture/audio formats, frame count,
duration, bitrate, full-file decoding and delivered loudness before replacing
its own generated output. Intermediate files stay in a uniquely named `render-*`
folder on C: for inspection; the existing source recordings are never modified.

```powershell
py -3.11 -X utf8 stream_brand/trailer/render.py
py -3.11 -X utf8 tools/run_offline_tests.py tools.test_channel_trailer
py -3.11 tools/check_architecture.py
```

If you edit the matching cards first, rebuild them with
`tools/build_channel_brand.cjs` before rendering the trailer. The video exporter
does not start OBS, restart the Hub, install listeners, access Twitch credentials,
or publish content.

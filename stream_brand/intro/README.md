# Four spirits. One lane. — stream intro

The separate v2 fight story adds 23 connected Udyr/Sion action keyframes and
43 cuts while preserving this original delivery. See [STORY-README.md](STORY-README.md)
for its artwork, choreography, files and rebuild commands.

An original cinematic intro for UdyrIsABotLaner, inspired by the staging and
escalation of the supplied Burnt Peanut sequence from 6:32 to 7:15:
https://www.youtube.com/watch?v=U-VPAYl27xY&t=392s

The reference establishes its river landscape, reveals the squad, introduces a
helicopter with a banking camera, alternates wide action with character close-ups,
and raises the scale through fire, debris and airborne gunfire. The adaptation
uses the Rift and Udyr's four spirits as its own setting and action vocabulary.
The artwork is newly generated; reference footage was reviewed in the browser.

The first request was for 30 seconds. The subsequent instruction to use the first
40 seconds of the downloaded song sets this delivery to exactly 40 seconds.
The supplied file is **CCR - Fortunate Son (MOONLGHT Remix).mp3**, rather than
the original CCR recording. Its spectral attacks fit approximately 128 BPM with
a 0.03-second beat phase. The picture cuts use that grid, rounded to 60 fps.

## Play and edit

All large deliverables and eight original image assets are in:
`C:/StreamingMedia/ChannelPresentation/2026-10-03/rift-awakening/`.
The small editable build sources are in this repository's `stream_brand/intro/`.
The generated originals also have workspace copies in the task's C: visualization
directory. F: had approximately 11 MB free at the beginning of this work.

- `udyr-rift-intro-40s.mp4`: ready to play, supplied music plus original effects.
- `udyr-rift-intro-effects-only-40s.mp4`: same picture, effects without the song.
- `udyr-rift-intro-picture-40s.mp4`: silent picture for an editor or another mix.
- `spirit-effects-40s.wav`: independent original stereo impact/whoosh stem.
- `music-first-40s.wav`: the supplied recording's 0–40s excerpt, decoded to stereo.
- `index.html`: local player and version selector.
- `storyboard.jpg`, `poster.jpg`: visual review.
- `delivery-manifest.json`: source fingerprints, exact cuts and delivery checks.
- `build/`: a copy of the editable source and exact built-in imagegen prompts.

The music delivery uses the supplied first 40 seconds, with a short final 0.18s
fade and loudness normalization. The source MP3 remains unchanged. No music
purchase or additional license was made as part of this build.

## Choreography

| Time | Image and action |
| --- | --- |
| 0–3.78 | Approach across the ruined Rift; separately composited foreground Udyr |
| 3.78–7.53 | Face reveal and a closer fist insert as storm energy awakens |
| 7.53–13.15 | Storm bear: wide impact, pullback and close camera pass |
| 13.15–18.78 | Turtle: emerald ward, advancing shimmer and close impact |
| 18.78–24.40 | Ram: cracked causeway, moving embers and hot debris |
| 24.40–30.03 | Phoenix: rising frost and a tightening airborne reveal |
| 30.03–31.90 | Brief return to the Rift and a breath before the final run |
| 31.90–37.53 | Spirit return cuts accelerate from two beats to one beat |
| 37.53–40 | All spirits converge; Four spirits. One lane. and channel name |

The technique is 2.5D motion design: seven cinematic image plates, a transparent
foreground character, approximate depth fields, independent moving atmosphere,
camera paths, beat accents, lens smears, chromatic impact accents and rendered
typography. The characters originate as still artwork; there are no skeletal
character rigs or video-generation clips. Source plates are 1672×941, the alpha
character is 1024×1536, and the delivery composite is 1920×1080 at 60 fps.
The source paintings are slightly upscaled for this composite.

## Rebuild and verify

Python 3.11, NumPy, Pillow, SciPy, OpenCV and FFmpeg are used. The finite exporter
uses the existing `lib.media_jobs` budget, two OpenCV workers and a single hidden,
below-normal FFmpeg encoder. Its child is reaped on failure or cancellation.
Source artwork and audio are fingerprinted before and after the render. Each MP4
is completely decoded and checked for 2400 frames, 40-second duration, H.264
picture and stereo 48 kHz AAC where present. The mixed export is normalized to
approximately −16 LUFS with a −1 dB true-peak target.

```powershell
py -3.11 -X utf8 stream_brand/intro/render.py
py -3.11 -X utf8 stream_brand/intro/render.py --preview-only
py -3.11 -X utf8 stream_brand/intro/render.py --reuse-picture
py -3.11 -X utf8 tools/run_offline_tests.py tools.test_intro_renderer
py -3.11 tools/check_architecture.py
```

The editable plan owns the camera and cut values. Artwork replacements keep the
named files in `art/`, and the transparent hero keeps its alpha channel. The Hub,
OBS settings, replay paths, personal data and source song are outside this
exporter's mutation scope. The video can be added to an OBS Media Source through
the user's normal setup after review.

`--reuse-picture` is an explicit audio-only recovery option. It checks the existing
picture's format, duration and complete decoding; use a full render after changing
artwork, shot timing, camera values or visual-effect code.

# Rift Stand — Udyr vs Sion, v2

Forty seconds of Udyr defending a ruined bot lane. The story introduces Sion,
shows an axe dodge and storm punch, lets the turtle shield fail, then turns the
fight with the ram charge and phoenix finish. The original intro remains in
`C:/StreamingMedia/ChannelPresentation/2026-10-03/rift-awakening/`.

The v2 delivery and all 31 artwork files live in:
`C:/StreamingMedia/ChannelPresentation/2026-10-03/rift-story-v2/`.
There are 23 newly generated keyframes and eight reused original assets. The
new keyframes include distinct windup, release, contact and recovery poses.
Exact built-in imagegen prompts and input references are in `story-prompts.json`.
Workspace copies of the new artwork also live in the task's C: visualization
directory under `rift-story-v2/art/`. Final art does not depend on the default
generated-image folder.

- `udyr-sion-story-intro-40s.mp4`: 1080p60, supplied music plus original effects.
- `udyr-sion-story-intro-effects-only-40s.mp4`: same picture, effects without music.
- `udyr-sion-story-intro-picture-40s.mp4`: silent picture.
- `spirit-effects-40s.wav`: original effects stem.
- `music-first-40s.wav`: the supplied recording's first 40 seconds.
- `index.html`: optional local player with soundtrack selectors and pose galleries.
- `storyboard.jpg`: a review frame from every shot.
- `*-poses.jpg`: the five attack sequences, shown in action order.
- `delivery-manifest.json`: file fingerprints, cuts and complete decode results.
- `build/`: archived editable sources, plans and prompts. Rebuild from this
  repository, where the shared media-job service is available.

## Edit and timing

`story_timeline.py` owns the story policy and generates `story-plan.json`.
The plan owns individual camera values, pose groups, localized impact points,
approximate depth regions and motion treatments. `cinema.py` applies these
contracts without moving story policy into the runtime Hub.

| Seconds, approximately | Story |
| --- | --- |
| 0–5.66 | Approach, footfall, Sion reveal and Udyr reaction |
| 5.66–8.47 | Axe windup, swing, dodge and stone impact |
| 8.47–13.16 | Storm spirit, electric punch, contact insert and recoil |
| 13.16–18.78 | Turtle shield collision, slide back and setback |
| 18.78–24.40 | Resolve, ram charge, enemy thrown back |
| 24.40–28.16 | Phoenix rise, dive and frost strike |
| 28.16–31.90 | Quiet victory and hero camera pass |
| 31.90–37.53 | Accelerating recall montage of the four attacks |
| 37.53–40 | Four spirits. One lane. Channel reveal |

The supplied file is `CCR - Fortunate Son (MOONLGHT Remix).mp3`. Its measured
grid is 128 BPM with a 0.03-second phase. Forty-three shots use that grid,
including half and quarter beats for the fastest pose changes. The music starts
at zero and uses the first 40 seconds with a final 0.18-second fade. Original
source music and artwork are fingerprinted before and after export.

This is a cinematic animatic made from connected poses: it adds brief contact
accents, short camera hit stops, directionally smeared release frames, local
shockwaves, moving atmosphere and depth camera motion. It has no skeletal rigs
or generated-video clips, so transitions between poses remain stylized cuts.
Source landscape art is 1672×941 and is slightly enlarged for the 1920×1080
composite. The alpha foreground hero is 1024×1536.

## Rebuild and verify

Run in the supported repository with Python 3.11 and FFmpeg available:

```powershell
py -3.11 -X utf8 stream_brand/intro/story_timeline.py
py -3.11 -X utf8 stream_brand/intro/render.py --plan stream_brand/intro/story-plan.json --preview-only
py -3.11 -X utf8 stream_brand/intro/render.py --plan stream_brand/intro/story-plan.json
py -3.11 -X utf8 tools/run_offline_tests.py tools.test_intro_renderer
py -3.11 tools/check_architecture.py
```

The exporter owns one finite render and hidden FFmpeg child through the existing
media-job budget. All three MP4s are checked for 2400 frames, 40 seconds, H.264,
full decoding and stereo 48 kHz AAC where present. The music mix is normalized
with a −16 LUFS target and −1 dB true-peak target. Hub/OBS settings and source
media are outside this artifact owner's mutation scope.

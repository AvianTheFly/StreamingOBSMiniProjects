# Rift Stand — Storm and Stone, v3

The opening introduces Udyr and the four spirits before the fight begins.
The physical and spectral lightning bear share one ferocious silhouette; the
physical and jade guardian turtle share a jagged armored snapping-turtle design.
Their matching manifestations also appear in the punch and shield shots.

The fight stays with the characters: bear punch, Sion's axe retaliation, turtle
shield block and slide to one knee, ram-powered rise and charge, Sion falling
onto his back, phoenix summon and aerial finisher while Sion remains down,
then Udyr's landing recovery and standing victory. Sion's deflected axe catches
in the stone during the ram recovery window, then is discarded during his fall.
There are no standalone animal cutaways or earlier-fight recalls after combat
begins. The final four-spirit composition is the channel reveal after victory.

The delivery is in
`C:/StreamingMedia/ChannelPresentation/2026-10-03/rift-continuity-v3/`.
The earlier v1 and v2 deliveries remain at their original paths.
There are 26 newly generated images and 39 authored shots. The art archive
contains every plate used by this edit plus the alpha foreground hero.

- `udyr-sion-continuity-intro-40s.mp4`: supplied music and original effects.
- `udyr-sion-continuity-intro-effects-only-40s.mp4`: same picture, effects only.
- `udyr-sion-continuity-intro-picture-40s.mp4`: silent picture for an editor.
- `spirit-effects-40s.wav`: original effects stem.
- `index.html`: local player, soundtrack selectors and chronological galleries.
- `storyboard.jpg` and `*-poses.jpg`: reviewed frames and action sequences.
- `rift-continuity-artwork.zip`: used artwork, exact prompts and editable plans.
- `delivery-manifest.json`: source hashes, full decode checks and media formats.
- `build/`: archived rendering sources and authored plans.

## Timing

The supplied `CCR - Fortunate Son (MOONLGHT Remix).mp3` starts at zero; the edit
uses its first 40 seconds. The measured grid is 128 BPM with a 0.03-second phase.
The first strong energy lift at approximately 7.53 seconds is the faceoff.
Contact inserts use quarter beats; the final music fade is 0.18 seconds.

| Seconds, approximately | Action |
| --- | --- |
| 0–6.59 | Hero, physical/spirit bear and turtle, ram, phoenix, united spirits |
| 6.59–9.40 | Sion reveal and faceoff |
| 9.40–13.16 | Bear punch, impact, recoil and axe retaliation |
| 13.16–16.90 | Turtle shield collision and slide to one knee |
| 16.90–20.89 | Ram summons from knee, halfway rise, loaded crouch, charge |
| 20.89–23.47 | Ram contact, backward fall and grounded Sion |
| 23.47–28.16 | Phoenix summon, lift, dive and frost impact |
| 28.16–35.65 | Held landing, halfway rise and standing victory |
| 35.65–40 | Four spirits. One lane. Channel reveal |

This remains a cinematic animatic made from connected paintings, depth camera
motion, directional release smears, short hit stops, local shockwaves and moving
weather. Character poses change through stylized cuts. It uses no skeletal rigs
or generated-video clips. Landscape source art is 1672×941, enlarged slightly
for the 1920×1080 / 60 fps composite; the alpha hero is 1024×1536.

## Rebuild

`continuity_timeline.py` owns the authored choreography and generates
`continuity-plan.json`. `cinema.py` applies the same public visual contracts as
the earlier edits. V3 disables passing lens smears at the ends of matched poses
so the physical progression remains easier to read. Source media stays on C:.
No Hub or OBS settings are changed.

```powershell
py -3.11 -B -X utf8 stream_brand/intro/continuity_timeline.py
py -3.11 -B -X utf8 stream_brand/intro/render.py --plan stream_brand/intro/continuity-plan.json --preview-only
py -3.11 -B -X utf8 stream_brand/intro/render.py --plan stream_brand/intro/continuity-plan.json
py -3.11 -B -X utf8 tools/run_offline_tests.py tools.test_intro_renderer
py -3.11 -B tools/check_architecture.py
```

The renderer uses one finite hidden encoder under the existing media-job budget.
Each delivered MP4 must fully decode with 2400 frames and exactly 40 seconds.
Soundtrack variants use stereo 48 kHz AAC. Original source files are fingerprinted
before and after export and must remain identical.

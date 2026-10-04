# Spirit sanctuary — cinematic art MVP 01

Latest cinematic art pass: `--concept art` combines a continuous opening camera,
center-outward floor/wall/ceiling light, a fast portrait turn and immediate
claw-triggered collapse with five generated raster assets. Painted stone and
floor materials use perspective-correct UVs; the hero and spirit cards stay
attached to the approved articulated motion. This first art MVP uses 2.5D cards
and coarse geometry. Delivery and unchanged source PNGs:
`C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-cinematic-art-v1/`.
Pass `--art-dir` to use a copied asset directory when rebuilding.

Latest motion pass: **MVP 05** adds progressive statue beams and spirit growth,
a planted four-limb bear gait, ram anticipation/contact/recoil, connected world
and POV limbs, a continuous fall/lookback and arrival before sitting. Rebuild
with `py -3.11 -B -m stream_brand.sketch_journey.render --concept motion`.
Delivery: `C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-motion-mvp-v5/`.
It includes original quiet contact effects plus a music-only comparison.
The final review also corrects near-clipped floor depth and widens the rear
follow camera so the opening walk and lowered bear pose stay visible.

Earlier colour revision: **MVP 04** uses continuous perspective animation,
one collapsed entrance and a return to the same sanctuary island. Rebuild with
`py -3.11 -B -m stream_brand.sketch_journey.render --concept illustrated`.
Its delivery lives at
`C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-illustrated-mvp-v4/`.
Five new paintings are design references; no animated shot is replaced by a
still image. Earlier versions below remain available.

A 40-second exploration concept using original stick figures and simple animal
outlines. It tests the route, spirit-assisted movement and music pacing before
commissioning more detailed artwork. It generates no AI images.

The route references the existing Sanctuary, Storm Coast, Reef, Forge, Sky
Harbor and Phoenix Observatory lobbies. Lobby art is used only as a design
reference; no lobby files, OBS scenes or Hub settings are changed.

Udyr walks out of the Sanctuary following four spirit lights. Bear energy lets
him sprint and leap between sea stacks. The turtle forms an air shell for a dive
through submerged ruins. The ram powers a sprint and vault through the Forge.
Phoenix wings carry him above the floating harbor to the Observatory, where all
four spirits awaken an astrolabe and the camera pulls back.

The first 7.53 seconds allow the world to establish itself; the first energy lift
starts the bear-powered traversal. Bear and ram takeoffs and landings occur on
whole beats. Character position stays continuous at world changes; the scenery
dissolves around the same moving actor. Jump arcs follow a parabola, with a short
compression pose before takeoff and after landing. No earlier action is replayed.

The supplied Fortunate Son (MOONLGHT Remix) file plays from zero to 40 seconds.
The sketch uses 128 BPM and a 0.03-second phase. Review annotations identify the
world and intended action, with a small beat indicator and elapsed time.

Delivery: `C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-journey-sketch-v1/`.

- `spirit-journey-sketch-40s.mp4`: 1280×720, 30 fps, music included.
- `spirit-journey-sketch-silent.mp4`: the same movement without music.
- `storyboard.jpg`: nine points along the journey.
- `journey-plan.json`: timing and the specific lobby reference paths.
- `sketch-source.zip`: editable drawings, choreography and export code.

`choreography.py` owns scene times and character movement. `paint.py` owns the
line drawings and moving joints. `render.py` owns one finite hidden encoder under
the existing media-job budget and verifies both exports through full decoding.
The source music is fingerprinted before and after export.

Rebuild from the supported repository, where shared media resources are present:

```powershell
py -3.11 -B -X utf8 stream_brand/sketch_journey/render.py
py -3.11 -B -X utf8 tools/run_offline_tests.py tools.test_sketch_journey
py -3.11 -B tools/check_architecture.py
```

Changing the route or timing requires no image generation. Keep the earlier
finished artwork; useful spirit designs can be reused after the movement is chosen.

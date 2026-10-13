SANCTUARY / IMAGE SLIDESHOW MVP 01

Latest revision: v4/timeline.json repairs the ram charge and fall with four longer
first-person holds selected from six new paintings. Ram horns physically break the wall; the breach
reveals an already collapsed bridge, and momentum carries Udyr through its gap.
Delivery: C:/StreamingMedia/ChannelPresentation/2026-10-10/spirit-slideshow-v4-ram-impact/
Earlier versions remain available. See v4/README.txt for rebuilding and provenance.

34 newly generated cinematic paintings tell the complete sanctuary escape story
over the first 40 seconds of the supplied Fortunate Son / MOONLGHT Remix.
The images hold still and cut at the authored action moments. There are no
generated in-between frames, morphs, moving cameras or 3D scenes in this version.

Story: sanctuary approach, center-born branching lights, four statues awaken,
beams empower Udyr, overload cracks the room, lightning bear claws the root seal,
immediate falling masonry, armored turtle rescue, ram stance/charge/contact,
broken floor and fall, phoenix hint/storm/wings, return to the original surviving
terrace, touchdown, walk to the edge, and the earned seated vista.

Every action has selected preparation, contact and consequence pictures. These
are independent illustrations: small masonry, statue placement and perspective
details vary between pictures. This compares the look and pace of an illustrated
slideshow; it does not promise the exact geometry or motion continuity of a 3D
scene. The 34 original PNGs retain their native dimensions and bytes. The video
scales them to 1920 x 1080 for playback, holding each picture at 25 fps.

Files:
  sanctuary-slideshow-40s.mp4        Main 40-second movie with supplied music
  sanctuary-slideshow-silent-40s.mp4 Same picture, no audio
  images/                          All 34 original selected PNGs in story order
  gallery.html                     Local movie and full-size image browser
  storyboard-1.jpg through -4.jpg   Complete source contact sheets
  encoded-review-1.jpg through -4.jpg Frames from the actual exported movie
  timeline.json                    Editable cut times and image order
  slideshow-plan.json               Exact delivered frames and native hashes
  prompts.json                      Full prompt set and continuity corrections
  validation.json                   Movie/image/audio preservation evidence
  sanctuary-slideshow-source.zip    Editable code, timing, prompts and tests
  sanctuary-slideshow-complete.zip  Movies, all images, browsing and evidence

Images were generated using the built-in image_gen tool: 34 selected images and
three narrow continuity corrections. Existing hero, spirit, gateway and landscape
art supplied identity/style references. Earlier cinematic outputs remain intact.
The source MP3 is unchanged and is not copied into the package. The main movie
uses seconds 0-40, normalized to -16 LUFS with a short final fade. No added SFX.

Rebuild in the supported Streaming Scripts v2 checkout with Python 3.11, Pillow,
NumPy and FFmpeg installed:
  py -3.11 -B -m stream_brand.spirit_slideshow.render
  py -3.11 -B -m stream_brand.spirit_slideshow.review
Inspect the four encoded review sheets, then:
  py -3.11 -B -m stream_brand.spirit_slideshow.review --package
Checks:
  py -3.11 -B tools/check_architecture.py
  py -3.11 -B -X utf8 tools/run_offline_tests.py tools.test_spirit_slideshow

This is a standalone presentation artifact. No Hub restart or settings change
is involved. Delivery lives on C: separately from recording and replay storage.

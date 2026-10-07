SANCTUARY - ILLUSTRATED SEQUENCE 02

Watch sanctuary-slideshow-40s.mp4. Silent alternate is included.
58 full-frame illustrations: 33 new selections and 25 reused originals.
36 new built-in image_gen calls, including three replaced continuity variants.
1920x1080, 25 fps, 1000 frames, exactly 40 seconds.

Story: old stone approach bridge and sanctuary established; center-born light
awakens statues; beams travel inward; all four spirits fully engulf Udyr.
Bear energy condenses into planted claws, bounding strides and a root tear.
Immediate roof damage leads into turtle rescue and kneeling recovery.
Ram stance lowers through planted palms and alternating strides; wall impact
reveals the old bridge. Paving cracks, support gives way, and Udyr drops through
the giant missing span. Phoenix sparks, feathers, coiled turn, storm release,
wing stroke, climb, glide, braking approach, landing recovery and seated vista.

Music is the FIRST 40 SECONDS, starting at zero, of the supplied local file:
C:/StreamingMedia/twitch downloads/CCR - Fortunate Son (MOONLGHT Remix).mp3
The excerpt is normalized to -16 LUFS with a final 0.18-second fade.
The original MP3 is preserved. No additional sound effects were added.
Selected reveal/impact cuts use measured spectral attacks from that excerpt,
quantized to delivery frames within 20 ms. Intermediate action holds vary;
the four-spirit peak lasts 1.88 seconds and the final vista lasts 2 seconds.
music-cues.json records the selected synchronization points.

This is an illustrated cinematic MVP: hard cuts between unchanged paintings.
Additional action poses improve cause and effect but do not provide continuous
3D/body motion. Small statue, masonry and perspective details may still vary.
The new scenery includes spirit-carved mountains, aurora, cloud rivers,
waterfalls and distant lantern-lit ruins.

gallery.html browses the movie and full-resolution originals locally.
images/ contains all selected native PNGs; prompts.json contains actual prompts,
reference paths, replaced variants and reused-art provenance. validation.json
records encoded-frame, audio, source-preservation and complete-decode checks.

Rebuild from the supported Streaming Scripts v2 checkout with Python 3.11,
FFmpeg/FFprobe, Pillow, NumPy and the existing lib.media_jobs dependency:
py -3.11 -B -m stream_brand.spirit_slideshow.render --plan "PATH/timeline.json" --output "PATH/rebuild"
Use a different output directory. All selected PNGs must be beside that plan
under images/. For the repository version use stream_brand/spirit_slideshow/v2/timeline.json.
The source ZIP contains the exporter and authored plan; the complete ZIP also
includes selected images, both movies, review sheets, timing, prompts and proof.
Version 1, supplied music, Hub and OBS settings remain preserved.

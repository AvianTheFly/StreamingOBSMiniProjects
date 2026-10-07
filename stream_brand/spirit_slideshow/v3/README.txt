SANCTUARY - CALMER ILLUSTRATED EDIT 03

Watch sanctuary-slideshow-40s.mp4. Silent alternate is included.
26 selected original illustrations, down from 58 in version 2.
No new artwork generation calls. Selected native PNGs are unchanged.
1920x1080, 25 fps, 1000 frames, exactly 40 seconds.

The first wide view holds two seconds; the four-spirit peak holds 2.2 seconds;
the final vista holds four seconds. Every shot lasts at least 1.2 seconds.
Each change uses a 10-frame opacity dissolve: previous picture at frame zero,
new picture at frame nine (0.36 seconds later), followed by a stationary hold.
No zoom pulses, spins, shake, moving crops, parallax, strobe effects or flashes
were added. Video highlights and saturation are reduced consistently.

The ram uses one continuous low POV group from planted hands through the charge,
wall impact, breach, bridge footfall and broken span. The bridge failure still
causes the fall. Reverse-looking POV inserts and the overhead charge interruption
are removed. Bear movement has fewer pose substitutions; the phoenix sequence
has fewer camera reversals. This is an illustrated edit, not continuous 3D motion.

Music is the FIRST 40 SECONDS, starting at zero, of the supplied local file:
C:/StreamingMedia/twitch downloads/CCR - Fortunate Son (MOONLGHT Remix).mp3
The excerpt is normalized to -16 LUFS with a final 0.18-second fade.
The original MP3 remains unchanged. No extra sound effects were added.
The spirit reveal begins at eight seconds; shot readability now takes precedence
over following every musical beat. Version 2 music cue timing does not apply.

gallery.html has a paused, user-controlled movie preview and original-image gallery.
validation.json documents actual encoded blend progression and stationary holds,
audio alignment, full decoding and source preservation. comfort-comparison.json
compares frame-to-frame pixel changes with version 2. These numerical checks do
not certify medical safety or individual viewing comfort; viewer feedback remains
the way to judge whether the calmer edit feels comfortable.
transition-review-*.jpg contain decoded boundary frames, not source mockups.
research-notes.txt links the industry and accessibility sources used in the edit.

Rebuild from the supported Streaming Scripts v2 checkout with Python 3.11,
FFmpeg/FFprobe, Pillow, NumPy and the existing lib.media_jobs dependency:
py -3.11 -B -m stream_brand.spirit_slideshow.render --plan "PATH/timeline.json" --output "PATH/rebuild"
Use a different output directory with all selected PNGs under images/ beside
the plan. Repository plan: stream_brand/spirit_slideshow/v3/timeline.json.
Version 1, version 2, supplied music, Hub and OBS settings are preserved.

# Spirit Replay Studio artwork

The v2 presentation mixes restrained broadcast typography, teal and warm gold
framing with Udyr-inspired elemental spirit reliefs. The central recorded picture
and live companion use exact 16:9 viewports without overlapping gameplay HUDs.

The built-in imagegen tool generated the original background on 2026-10-02.
The project copy is `hub_ui/app/replay-stage/spirit-background-v2.png`.
The prompt requested a premium dark cinematic abstract spirit-forged broadcast
backdrop, ink navy and charcoal, softly luminous teal currents and aged warm gold,
with bear, ram, phoenix and turtle reliefs integrated into the outer edges of dark
obsidian; quiet central negative space; no text, logos, panels or frames. The exact
prompt is recorded in `STUDIO-V2-PROMPT.txt` beside this file.

Borders, icons and type are authored in HTML/CSS/SVG. To rebuild the six native
OBS fallback images, run `tools/build_replay_stage_art.cjs` with Playwright on
NODE_PATH and the supported Hub serving the authored files. Keep original images.
The transparent motion layer uses the same viewport contract and adds clip names,
context, progress, sequence markers and a bounded loading reveal. No new media
playback worker or background polling service is introduced.

Run `tools/test_replay_studio.cjs` for browser regressions and screenshots in
`output/replay-studio-v2`. Python coverage is in `tools/test_replay_presentation.py`.

# Camera-facing bear attacks, version 11

The accepted v10 approach remains intact through 1.65 seconds. The new turn
finishes in a frontal attack stance at 1.94 seconds. Three strikes now alternate
left/right/left across the viewer, retaining their existing 2.18, 2.68 and 3.18
second impact beats. Each strike keeps its follow-through until the next strike.

The original `web/assets/bear.png` already contains complete frontal ready and
crossing-swipe poses in its bottom row. These are selected directly by `art.js`;
no new artwork is generated. The whole painted shoulders, forearms, paws and
their occlusion stay together. Per-view measured native aspect ratios prevent
the broad attack poses from being squeezed to fit the ready pose. Continuous
perspective pressure and registered view blending supply motion between them.

`front-motion.js` owns view weights, registration, lens-pressure deformation and
projected claw contacts. `front-paint.js` paints complete poses into bounded
premultiplied blend buffers. Those buffers belong to the loaded Character asset
generation and are released with it; no runtime worker or OBS source is added.
The existing `motion.js` composes the quarter/frontal handover. `presentation.js`
retains the accepted gallop/yaw and dispatches the complete frontal presentation.
The frontal acting contract marks its raised forepaws as unplanted and omits the
quarter-view bones after the handover; effects must use the frontal paint contacts.

Screen gouges and charge/impact effects use the same projected claw coordinates
as the visible paint. Foreground pressure is bounded; the camera-facing mesh is
checked for folds. The cover remains fully opaque from 3.85 through 4.25 seconds,
with the default cut at 4.05. Native random selection, alternating clips, audio,
playback-clock ownership and adjustable per-animal cuts retain their contracts.

## Evidence and rebuild

Outputs live at `C:/StreamingMedia/Transitions/udyr-spirits-v11`; the complete
previous source is in `before-v11`. Each bear performance has its own WebM and
MP4 review video. The other six production clips are preserved from the most
recently installed generation when preparing the update.

Set `SPIRIT_OUTPUT=C:/StreamingMedia/Transitions/udyr-spirits-v11` before running
the README rebuild commands. Render, optimize and build previews with arguments
`bear bear-alt`. The finite Python exporters/installers honor that output root,
allowing independent versioned exports without changing another task's directory.

`tools/test_bear_front.cjs` compares sixteen exported approach frames against the
immutable accepted source in the same Chrome process. It checks native ratios,
view completeness, visible painted claw contacts, mirrored variants, continuous
contact motion, stable support coordinates, non-folding projection and retained
follow-through. PNG round-tripping matches the renderer's encoder input and
avoids graphics-process-specific rounding of raw premultiplied canvas pixels.
`test_bear_motion.cjs` retains the quarter-rig's calibration regression.

`review_bear_alignment.cjs` shows the complete quarter-to-frontal handover and
all three attacks at enlarged scale, for both variants. Dense review frames,
choreography validation and full-resolution encoded-alpha checks cover the final
export. Normal-speed review clips are provided separately for visual judgement.

# Spotify overlay

Starts with this checkout's Hub. Uses the Spotify desktop app's Windows media
session: no API key, login, or Premium requirement. It reads playback without
controlling Spotify. Spotify on a phone or the browser is not supported.

OBS source: **Hub Spotify Visualizer**, in the **Spotify Overlay** scene.
The new scene is added to the current OBS scene on first setup. Add that scene
as a scene source to any other scenes where you want the overlay. Move/resize
the visualizer inside Spotify Overlay; future Hub starts preserve its placement,
filters, visibility, and dimensions.

Browser URL: `http://127.0.0.1:7447/overlay`, transparent, 60 fps in the installed OBS source.
The layout uses a 400 × 300 logical stage and scales to the browser viewport.
The installed OBS source is 1200 × 900, with a 1200 × 660 sculpture canvas,
so its roughly 950-pixel presentation no longer enlarges a 400-pixel raster.
Its scene position and displayed size are preserved by inverse source scaling.

The production visualizer is a seventeen-scene musical journey. It uses different
compositions, rather than morphing every preset from one central ribbon mesh.

| Scene | Spatial character | Musical role |
| --- | --- | --- |
| Prism drive | Receding hexagonal corridor, turning vanishing point, spectrum dashes | Bass weight, forward travel, trance/EDM energy |
| Interference silk | Two slim ribbons with a clear central path and supporting contours | Tonal detail, sustained texture, spacious passages |
| Orbit engine | Five depth-sorted gimbals around a bass-driven core | Circular hypnotic movement and stereo depth |
| Crystal assembly | A central crystal with four orbiting satellites and three open arcs | Harder edges and rhythmic structure |
| Copper dunes | Warm spectral landscape with 4.8 seconds of real band history | Acoustic, folk, country and quiet listening direction |
| Petal chamber | Eight layered petals around an open central aperture | Kaleidoscopic concert geometry |
| Signal architecture | Two staggered banks of eight spectral towers with released peak caps | Clear current/recent per-register response |
| Flow choreography | Two flowing ribbons with restrained supporting traces | Poi/flow-art motion and relaxed musical travel |
| Resonance lattice | Suspended crosshatched membrane, sparse panels and corner brackets | Band history sculpts relief; bass bows the structure |
| Waveform loom | Eight ordered waveform sheets folding through depth | Separate spectral voices, captured waveform detail and stereo breadth |
| Phase helix | Double coil with frequency-bearing rungs and ribbon rails | Kick compression/rebound changes radius; mids articulate the strands |
| Morphic shell | Ribbed surface unfolding between angular and rounded contours | Bass expands the aperture; mids thicken the shell; highs travel along its ribs |
| Faerie constellation | Near/far winged lights following braided paths | Eight spectral voices control independent wings, cores and accents |
| Cinder phoenix | Swept wings, seven flight feathers per side and flowing tail plumes | Bass drives wing lift; local voices articulate individual feathers |
| Stormclaw bear | Recognizable ears, muzzle, faceted brow and three claw arcs per side | Heavy low-end stance, midrange claws and clear facial details |
| Verdant turtle | Domed plated shell with swimming flippers, head and tail | Spectral plates, buoyant bass response and stereo depth |
| Sundering ram | Spiral horns, spectral ridges and a faceted face | Horn compression/rebound and independent local accents |

The scene director measures audible exposure, spectral changes and attack
strength. Each scene continuously reshapes on independent, music-driven slow phases.
Opening, curl, depth and contour change together without resetting at song or
scene boundaries. Tunnels round and corkscrew, rings warp and unfold, crystals
change proportions, terrain rises and bends, petals curl in 3D, the city arcs,
and flow paths evolve their harmonic shape. Beats retain their faster response.
A family has at least 45 audible seconds to develop; an eventual family change
takes roughly 24–33 seconds and directly inherits both evolving shapes. Sustained music also advances the show.
Recent scenes are excluded and visit counts encourage variety. Quiet signals
favor the calmer families; stronger low-frequency and transient activity favors
structural scenes. This is an artistic response to sound, not genre recognition.

Light travels along the geometry through a separate audio-integrated phase.
There are no fixed-position lighting gradients. A low-but-nonzero audible
signal still moves the light even if individual frequency lanes are quiet.
Low-frequency attacks drive an initial compression followed by a spring rebound.
Mid-frequency attacks bend or torque the structure and briefly strengthen its
contours; high-frequency attacks send short accents along those contours.
Sustained loudness, bass pressure, stereo width/balance and waveform shape have
separate roles. Transients use the unsmoothed captured features so smoothing
does not erase the attack. Midrange energy drives travel;
large structures use separate steadier presence envelopes. Fixed waveform gain
and unsaturated full-window loudness preserve the difference between a loud
passage and a quieter break. A bounded salient-partial roughness proxy reuses
the existing FFT; spectral flatness supplies noise content. Sustained texture
drives fine contour vibration and facet grain, scaled by absolute presence,
without repeatedly inventing hits. This is a visual timbre mapping, not a
calibrated roughness measurement or emotion classifier. Smaller onset changes
are rejected; evolving forms follow presence, stereo space and texture while
their slow drift continues.
Absolute per-register energy (Hann-compensated FFT power) drives structural
voices, strings, and spatial memory. The fixed perceptual display curve does
not track a local maximum or raise its gain during quiet music. The logarithmic
48-band display remains available for immediate accents. Phrase context guides
swelling/release, timbre guides contour roundness and lasting tension, and
arrangement density guides quieter supporting contours. Main shape evolution
combines these musical gestures with a smaller continuous drift. Color
saturation follows phrase intensity while authored color families keep their
variety. These are expressive mappings of musical behavior, not emotion labels.
Waveform shape and spectrum influence local detail. Seventeen authored color families evolve continuously with audible time, midrange
energy, stereo width and spectral tone. Six contrasting color scores exchange continuously, with separated primary and accent hues. Correct modulo wrapping preserves every hue sector. Color travel survives scene changes,
while saturation and lightness stay bounded. Silence clears the canvas and holds the
journey. Pause/disconnect hides both visualizer and metadata. Song changes
preserve motion continuity and update the two independent text labels.

The GPU renderer uses one fixed-capacity vertex buffer, one program and one
vertex array. Lines are derivative-antialiased at 1200 × 660. Solid facets and
transparent gaps supply depth; there is no bloom, blur pass or canvas feedback.
Family changes transport live contours directly into the next family, without
an intermediate ribbon pose or a thinning-material cue. Both geometries keep
receiving current audio and structural evolution. Branch coverage is compensated
after antialiasing, and consistent curve sampling avoids a brightness jump at
either seam. One fixed plan per directed scene pair bounds the correspondence
cache to 272 entries. A Canvas fallback draws the same scene
catalog after unavailable/lost WebGL; restoration recreates GPU resources.
Page exit disposes them. Painting never advances the simulation.

The expressive mapping draws on [music/movement dynamic contour research](https://pmc.ncbi.nlm.nih.gov/articles/PMC3538264/),
[timbre/shape correspondence](https://pmc.ncbi.nlm.nih.gov/articles/PMC4038957/),
and [emotion-mediated music/color associations](https://pmc.ncbi.nlm.nih.gov/articles/PMC3670360/).
These studies motivate coherent changes in motion, curvature and saturation;
they do not imply one universally correct visual emotion for a song.
`tools/build_spotify_reference_study.py SOURCE OUTPUT` analyzes a user-selected
recording causally at the production 100-Hz cadence, with bounded decoding and
30-Hz presentation samples. `tools/test_spotify_expression.cjs` verifies lasting
timbre response, absolute register contrast, release gestures and no quiet-gain
creep; optional full-song data verifies both loud/release pairs and real morphs.

Responsibility map: `reactive.js` owns conditioned audio features (the production
caller disables its older mesh simulation); `music_motion.js` owns fast transient detection, independent low/mid/high
release envelopes, stereo response, spectral peaks and the bounded bass spring;
`journey.js` owns musical scene
selection, transition progress, travel, impact, and the bounded 48-frame band
history, continuous structural evolution and musical palette phase; `stage_palette.js` owns bounded
color families; `stage_geometry.js` owns shared contours and abstract compositions;
`stage_spirits.js` owns pure faerie/animal compositions and their spectral articulation; `stage_morph.js`
owns curve sampling, correspondence and geometric transport; `stage_renderer.js`
owns GPU/Canvas presentation and resource lifetime. `overlay.js` owns polling,
visibility, viewport scaling and frame scheduling. The earlier `forms.js`,
`surface.js`, `filament.js` and `radiance.js` instruments remain available for
regression/reference work; they no longer define the production presentation.

Research and design synthesis (October 2026):

- [Resolume parameter animation](https://resolume.com/support/en/parameter-animation)
  separates low/mid/high FFT controls, gain, fall and directional travel. This
  informed independent visual roles and released accents instead of whole-frame flashing.
- [Synesthesia](https://www.synesthesia.live/) presents a library of distinct
  shader scenes and live VJ workflows. This informed scene-level variety.
- [Magic Music Visuals](https://magicmusicvisuals.com/features) combines modular
  2D/3D graphics and scenes. This informed separate composition and rendering owners.
- [projectM](https://github.com/projectM-visualizer/projectm) is a MilkDrop-compatible
  generative visualizer. Its preset-oriented approach informed a continuous journey,
  while this implementation intentionally avoids feedback blur.
- [Derivative's kaleidoscope tutorial](https://derivative.ca/community-post/tutorial/audio-reactive-kaleidoscope-visuals/69771)
  demonstrates beat/envelope-driven mirrored visuals. This informed Petal chamber.
- [js.nation](https://github.com/caseif/js.nation) and the
  [Monstercat-style implementation](https://github.com/kaischallenberg/monstercatVisualizer)
  document music-channel spectrum conventions. These informed readable bass/band
  responses without copying logos, templates or artwork.
- [Lofi Studio's Sleep Ambient](https://studio.lofigirl.com/projects/sleep-ambient)
  describes a soothing listening environment. The quieter country/folk/ambient
  direction here uses warm landscape contours, slower travel and more space.
  Official country and folk visualizers were also located through
  [Sony Music Nashville](https://prep.sonymusicnashville.com/zach-john-king-releases-his-new-song-i-deserve-a-heartbreak/)
  and [Smithsonian Folkways](https://www.si.edu/object/jake-blount-didnapost-it-rain-official-audio-visualizer%3Ayt_L3p20tC2k-w).
  Those pages establish examples, not a universal visual style for a genre.

These are design interpretations. No external visualizer engine, branded art,
remote assets or additional audio capture are used at runtime.

WASAPI application loopback includes only Spotify.exe and its child processes.
Games and other desktop audio do not drive the visualizer, even on the same
speakers. It follows Spotify when it restarts. No output-device setting or
virtual cable is needed; the former SPOTIFY_AUDIO_DEVICE setting is unused.
Capture failures appear in module status and leave the geometry quiet; the
module never falls back to desktop capture. Nothing is saved or played back.
Spectral valleys remain deep rather than being flattened by a raised dB floor.
Separate loudness, bass, treble, signed waveform, spectral pitch/tonality,
stereo width/balance, spectral flux and beat-onset features drive
the visualizer, with quick attack and slower release. Silence stops its flow.

The widget produces no audio. Spotify must already be routed to an OBS audio
capture (Desktop Audio or an Application Audio Capture for Spotify). Keep your
existing music volume and routing. This module does not change those settings.

Dependencies are in root requirements.txt. Verification:

- `py -3.11 tools/check_architecture.py`
- `py -3.11 -X utf8 tools/run_offline_tests.py tools.test_spotify tools.test_spotify_transport`
- `node tools/test_spotify_evolution.cjs`: within-scene deformation after removing
  translation, rotation and uniform scale, small-step continuity and silence holds.
- `node tools/test_spotify_palette.cjs`: full hue spectrum, separated simultaneous
  accents and continuous score changes across every scene.
- `node tools/test_spotify_motion.cjs`: isolated-frequency causality, sustained
  sound rejection, compression/rebound/settling, stereo response and scene mass.
- `node tools/test_spotify_journey.cjs`: catalog-scaled quiet/energetic journeys,
  all-scene visitation, minimum residence, bounded history, silence, pure geometry
  and traveling light in every scene.
- `node tools/test_spotify_morph.cjs`: all 272 directed pairs, endpoint identity,
  continuous geometry, live bass response, bounded vertices and palette evolution.
- `node tools/test_spotify_morph_gpu.cjs`: actual pixels at both seams and the
  midpoint of all 272 pairs, nonblank coverage and fixed GPU resources.
- `node tools/test_spotify_radiance.cjs`: actual GPU output, geometric transitions,
  light transport with frozen path motion, resource bounds, transparency,
  frame cost, context recovery and the same-scene Canvas fallback.
- `node tools/test_spotify_rendering.cjs`: metadata, scaling, the complete catalog,
  silence, pause/resume, disconnect/reconnect and earlier instrument regressions.
- `node tools/test_spotify_transport.cjs`: idle notification, off-scene painting
  suppression, immediate resume and reconnect.
- `node tools/verify_spotify_live.cjs`: current Hub/UI/capture integration.
- `py -3.11 tools/verify_spotify_obs.py`: isolated native CEF rendering, cleanup,
  existing-source and personal-settings preservation.

`node tools/preview_spotify_abstract.cjs` records natural progression from original
PCM analyzed by production DSP, without forcing scene choices or timing.
`node tools/preview_spotify_journey.cjs` produces fixed-scene inspection stills;
these deliberately select each scene and are not a natural progression record.
Neither preview plays on the speakers nor controls Spotify.

Idle browser requests wait on the service's bounded change notification.
Active clients wait for the next complete audio revision (bounded to 250 ms),
then immediately request the newest sample. They never replay a queued backlog.
Capture publishes every fresh native packet (about 100 times per second on this machine); browser presentation
runs up to 60 fps, bounded by the host. The installed OBS source uses a custom 60 fps cadence. Off-scene frames retain musical
history but skip presentation. The presentation retains the same socket, keyboard listener and one Spotify capture.
The audio lifetime now isolates that capture in one owned process, described below.

`node tools/preview_spotify_morph.cjs` exports a finite transition study to
`SPOTIFY_PREVIEW_FRAMES`. It deliberately selects two handoffs, but keeps the
production transition rate and drives motion with the original analyzed PCM.

`node tools/preview_spotify_evolution.cjs` exports 30 uninterrupted seconds of
Petal chamber with original test audio and no scene handoff or speed change.

`node tools/preview_spotify_catalog.cjs` exports a 24-second four-up study of
the lattice, waveform loom, helix and shell to `SPOTIFY_PREVIEW_FRAMES`.
Every pane receives the same original PCM at its natural timing. The production
overlay still renders one evolving scene at a time.

The motion owner retains eight fixed spectral voices and released local details.
Tonal passages gather the spirit figures; textured passages loosen their field
lines. Projection, stereo separation and depth shading preserve near/far cues.
This is vector geometry driven by captured sound, not an animal recognition model.
Set `SPOTIFY_PREVIEW_STAGES=12,13,14,15,16,8` for the six-pane spirit study.

Sustained-spectrum motion follows the complete musical signal between attacks.
The analyzer uses batched stereo FFTs and a fixed 60-dB display range, so a
louder bass bin cannot suppress an unchanged quiet upper note. Per-register
stereo width and balance preserve wide layers that would cancel in a mono sum.
Eight independently integrated spectral phases excite a fixed coupled-string
field throughout all seventeen scenes; local pitch distribution controls their travel, sustained
energy controls bending, and stereo detail controls depth. Longer loudness swells
open the composition. Beat compression and sparks remain separate accents.

`node tools/test_spotify_sustain.cjs` disables beat responses and freezes the old
global animation clocks, checking sustained movement in every scene, silence,
independent upper-register motion and read-only painting. The Python audio tests
also check quiet-note preservation under louder bass and opposed stereo layers.
`tools/build_spotify_sustain_study.py <output-directory>` creates original
percussion-free PCM and current-DSP measurements. Set `SPOTIFY_PREVIEW_DATA`,
`SPOTIFY_PREVIEW_START`, `SPOTIFY_PREVIEW_SECONDS` and
`SPOTIFY_WITHOUT_TRANSIENTS=1` to render that study with beat accents disabled.


`music_strings.js` owns 520 fixed nodes with pinned ends. Each frequency register
pulls a local part of its string; signed disturbances travel along it, reflect,
lose energy and excite adjacent strings. Rising and falling amplitudes both launch
waves without waiting for the slower phrase envelope. Geometry samples this field with continuous-slope interpolation: its local slope stretches the contours, displacement bends them, and
per-register stereo width adds depth. Existing bass compression remains a separate
accent, so quiet harmonic movement survives between drums. This is frequency
analysis, not instrument or vocal source separation.

Capture timestamps use WASAPI's packet QPC position plus the packet duration;
invalid timestamps fall back to receipt time and are marked invalid. See
[Microsoft's GetBuffer contract](https://learn.microsoft.com/en-us/windows/win32/api/audioclient/nf-audioclient-iaudiocaptureclient-getbuffer).
`sample_age_ms`, `timestamp_valid`, `analysis_ms` and `audio_revision` expose
internal pipeline freshness. Browser `visualizerTiming` adds receipt-to-paint age
and paint cost. These do not measure speaker output, screen scanout or OBS encoding
latency. Bass still uses a 2048-sample temporal aperture; live mids and highs now use shorter apertures described below.

Additional checks:

- `node tools/test_spotify_strings.cjs`: immediate local response, delayed traveling
  crests, signed troughs, neighbour coupling, amplitude scaling, damping, pinned
  ends, stability and fixed buffers.
- `tools.test_spotify_transport`: latest-audio notification, complete snapshots,
  released locks, pause interruption and bounded waits alongside idle contracts.
- `node tools/test_spotify_latency.cjs`: set `SPOTIFY_BASELINE_WEB` to immutable prior
  web assets. A disposable HTTP server and actual browser compare identical
  spectrum steps reaching half amplitude in a submitted production paint. Set
  `SPOTIFY_LATENCY_REPORT` to save the finite benchmark. It never controls Spotify.

Verified on October 2, 2026: the controlled ten-trial comparison measured a median
130 ms before and 14 ms after for publication-to-half-amplitude paint. A separate
20-second live Spotify run measured median newest-sample age of 20 ms at paint,
median paint cost 2.7 ms, valid capture timestamps and no browser errors. These are
measurements from this machine, not promises of total audible-to-visible latency.
Native OBS source screenshots showed live changing geometry; its settings,
placement and filters were unchanged. All 17 sustained-note scene checks and 272
directed geometric morph checks passed.


Musical pacing and silhouette limits (October 2, 2026)

The requested relaxed/hyped contrast is musical energy, sometimes discussed as
arousal or activation. It can change within a song through loudness, timbre and
rhythmic/arrangement activity; a visual speed controller need not assume that
its BPM changed. [Affective Music Information Retrieval](https://arxiv.org/pdf/1502.05131)
discusses arousal as energy/stimulation and its relationship to multiple musical
features. Here intensity is a transparent visual heuristic, not an emotion model
or a BPM estimate.

The research informed these choices:

- [Synesthesia's audio uniforms](https://app.synesthesia.live/docs/ssf/audio_uniforms.html)
  distinguish hits, band-driven time, broad presence and BPM. Its smooth spectrum
  reduces detail when a cleaner shape is useful. This informed separate clocks
  for immediate accents and phrase-scale movement.
- [Synesthesia's scene guidance](https://app.synesthesia.live/docs/ssf/best_practices.html)
  recommends careful parameter ranges, smooth controls and limiting interacting
  controls that could break a scene. This informed scene-specific bend budgets.
- [Resolume's parameter animation](https://resolume.com/support/en/parameter-animation)
  allows FFT to control a parameter's speed, as well as its value, with selected
  frequency ranges, gain and fall. This informed integrating a changing rate
  instead of snapping the visual position to each instantaneous audio level.
- [Magic's parameter modifiers](https://magicmusicvisuals.com/downloads/Magic_UsersGuide.html)
  expose rate-producing oscillators/increases, smooth and peak envelopes, and
  bounded parameter ranges. This informed easing movement without slowing the
  separate onset response.
- [Ryan Geiss's MilkDrop authoring guide](https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html)
  separates immediate and attenuated frequency readings and exposes warp magnitude
  independently of motion. This reinforced separating movement speed from bending.

`music_pacing.js` owns one fixed 48-bin history, smoothed musical presence,
spectral-change activity, occupied spectral range, brightness and a 24-second
loudness reference. The reference retains verse/chorus contrast in mastered audio.
A bounded intensity estimate eases up and down across passages, driving a
0.25-to-2.05 motion-rate range. `MusicMotion` applies it to sustained spectral
phases; `Journey` applies it to travel, highlights, palette travel and structural
evolution. Real frame time still advances fast envelopes, springs and wave
propagation. The source FPS, polling, FFT and audio playback remain unchanged.

`stage_geometry.js` gives fluid compositions a larger bend budget (up to 13 design
units); recognizable animal and architectural scenes use 3–4 units. Smooth
saturation replaces the old large displacement, strong lateral shear and
signal-dependent global magnification. Identical points still receive identical
motion and all silhouettes continue to morph geometrically.

`node tools/test_spotify_pacing.cjs` compares relaxed and busy passages on the same
120-BPM grid, including equal-loudness arrangements. It checks continuous speed,
relaxation after the peak, silence holds, all 17 deformation budgets and local
orientation under a minute of dense musical stress. Set `SPOTIFY_PACING_REPORT`
to save its complete trajectory. On this machine the relaxed/busy controllers
settled at 0.29/1.04; the equal-loudness case settled at 0.42/0.86. These are fixture
results, not universal genre classifications.

The sustained-response regression now measures a four-second relaxed passage
against each scene's deformation budget: the older fixed one-second large-motion
criterion conflicts with slower quiet passages and tighter animal silhouettes.
The original silent/frozen-clock, independent-register and read-only checks remain.

`tools/build_spotify_energy_study.py <output-directory>` generates original
40-second PCM on a fixed 120-BPM grid with sparse, build, peak and release passages,
then analyzes it with the production DSP. Use the catalog preview with
`SPOTIFY_PREVIEW_DATA`, `SPOTIFY_PREVIEW_START=0`, `SPOTIFY_PREVIEW_SECONDS=40` and
`SPOTIFY_PREVIEW_PACING=1` to export it. Preview labels report the actual controller
speed. The production overlay continues to show the real Spotify title/artist.


Realtime pipeline refinement (October 3, 2026)

The live analyzer uses the newest 2048 stereo samples for bass, 1024 for bands
starting at 350 Hz, and 512 for bands starting at 2500 Hz. Loudness uses the
newest 256 samples, while waveform and broad stereo measurements use 512.
At 44100 Hz these apertures are 46.4, 23.2, 11.6 and 5.8 ms. Each FFT retains
its own Hann window and equal amplitude normalization; no future samples,
track prediction or desktop capture are used. The full-window analysis contract
remains available for existing finite studies with `realtime=False`.

The isolated capture owner publishes each fresh event rather than rounding 10 ms packet
notifications up to a 20 ms publication interval. Backlogs are truncated to the
newest aperture before allocating analysis buffers. Active HTTP clients reuse
one HTTP/1.1 connection with TCP_NODELAY, removing repeated connections and
request-worker creation. The transport owner closes clients during shutdown;
an idle socket has a three-second timeout and client workers are joined.
Successful browser revision requests continue through a microtask rather than
an extra nested timer. Error recovery remains paced. The browser retains one
outstanding request and the service keeps only the latest complete snapshot.

Direct visual attacks now use 100–160 per-second envelope rates; local spectral
voices use 140. Releases, coupled-string propagation, bass mass and phrase-scale
pacing retain their distinct timing. The native browser source is set to 60 fps
using its existing source settings. Its dimensions, URL, transform, filters,
visibility and audio routing are preserved.

[Microsoft's loopback documentation](https://learn.microsoft.com/windows/win32/coreaudio/loopback-recording)
explains the engine-to-capture path; this pipeline cannot remove speaker-device
or display scanout latency.
[OBS's browser implementation](https://github.com/obsproject/obs-browser/blob/master/obs-browser-plugin.cpp)
provides the source's custom FPS control. These changes use those existing
resources rather than introducing a second audio capture or renderer.

`tools.test_spotify_realtime` checks causal aperture response, absolute dynamics,
opposed stereo, quiet-note preservation, recent loudness release, every-packet
publication, persistent connection reuse and bounded shutdown. The finite
`tools/build_spotify_latency_fixture.py <directory>` reads an immutable saved
`before-audio_analysis.py` and generates causal PCM measurements without playing
sound. `node tools/test_spotify_pcm_latency.cjs` uses `SPOTIFY_REALTIME_OUTPUT`
for that fixture and `before-web` assets, comparing original 30-fps and current
60-fps presentation. It measures 90% of the local voice response in a submitted
production paint, checks actual nonblank pixels, and saves `pcm-to-paint.json`.
This models native packet cadence but excludes the device/driver capture delay,
speaker output and display scanout; live capture freshness is verified separately.
The older publication-to-half-amplitude benchmark is already display-frame
limited and is not evidence for the total sound-to-visual improvement.


Capture isolation is owned by `audio_worker.py`. The existing Hub audio thread
starts exactly one child process with a fresh MTA audio thread. This prevents
busy unrelated Hub Python threads from stretching DSP work through interpreter
contention. `audio_channel.py` carries complete frames through a fixed 205-double
mailbox plus status and revision primitives; there is no queued
audio history, playback, extra Spotify capture or growing buffer. The state
owner receives only changed generations and rejects stale publications.

Hub shutdown propagates to the child, joins it for 1.5 seconds and uses bounded
termination/kill fallbacks for a stuck driver before closing the process handle.
Unexpected exits are reported and recovery waits two seconds before starting a
replacement; the old child is cleaned up first. The capture also checks its
parent's process handle, exiting when the Hub is terminated abruptly. The COM
capture remains on its existing MTA contract; the child main thread does not
attempt to change comtypes' importing STA apartment.

The realtime regressions include actual spawned disposable workers, newest-only
mailbox generations, cooperative and forced cleanup, parent-death rejection and
successful MTA initialization on the dedicated thread. The dedicated process is
a modest resource increase intended to reduce delay spikes under Hub load.


The fast HTTP path also lives in the isolated process: `audio_runtime.py`
assembles its existing port 7447 server with the MTA capture thread. HTTP reads
and audio-change notifications use the child-local state directly, avoiding an
extra trip through the Hub interpreter. The Hub remains the Windows media-session
and visibility-policy owner. `presentation_state.py` sends complete, bounded
control generations and original observation times across the channel; stale
media and hide/show retain their existing behavior. The Hub status receives the
latest audio through the mailbox, but that relay is outside the OBS fast path.

The transport owns its active sockets and shuts them down explicitly before
joining request workers, so persistent idle clients do not delay child cleanup.
The runtime checks parent exit even when capture is waiting or recovering.
The isolated HTTP regression uses a spawned production presentation runtime with
silent fixture measurements, asserting current metadata, complete fresh audio,
hide/show delivery, source-independent transport and process cleanup.


A final live trace identified periodic two-second spikes caused by enumerating
all Windows processes in the capture loop. Enumeration now occurs only during
initial discovery or recovery. The active stream retains `psutil.Process(pid)`
and checks that process identity every two seconds; this also detects PID reuse.
A disappearing Spotify process releases the old capture before rediscovery.


The Hub status mailbox is explicitly outside the fast path. Audio publication
into it uses a nonblocking lock and can skip a status update while the Hub is
busy; the browser still sees every newest child-local frame. The Hub observes
this fixed mailbox at 30 Hz. Its control mailbox has a separate lock, and no
per-frame interprocess event is used. A spawned regression holds the Hub's audio
mailbox lock while verifying continued fresh child HTTP frames, preventing
cross-process lock scheduling from reintroducing delay.

`media_notifications.py` owns one manager event and two current-session event
subscriptions. Play/pause and metadata changes wake the existing media loop
immediately, with the old 250 ms heartbeat retained for freshness and recovery.
Session replacement and shutdown release all tokens. This reduces the deliberate
visibility delay on Spotify resume without sending any playback commands.
The bindings follow
[Microsoft's media-session events](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession)
and use the installed Python WinRT add/remove methods. Offline regressions cover
prompt wakeup, session replacement and cleanup after recovery.


Final validation with live Spotify (October 3, 2026): 404 distinct sampled paints
across a 20-second run had sample-age median 10.33 ms, p90 12.67 ms,
p99 18.50 ms and maximum 33.57 ms. Analysis median was 1.31 ms and p99
3.12 ms; paint median was 2.50 ms and p99 5.40 ms. The initial in-Hub trace
had sample-age median 30.28 ms and p99 457 ms. This is capture timestamp
freshness at browser painting, not a speaker-to-screen hardware measurement.
The controlled causal PCM-to-paint benchmark reached 90% local spectral response
in median 44.44 ms at 90 Hz, 30.27 ms at 800 Hz and 31.32 ms at 6000 Hz,
versus 59.77, 85.65 and 84.25 ms using the saved original pipeline. These
measurements preserve the required bass analysis aperture and physical movement.

Architecture checks pass with zero boundary violations. All 35 focused Spotify
offline regressions pass, including spawned-runtime cleanup and independence
from a descheduled Hub mailbox reader. Native OBS CEF renders all 17 scenes
with nonblank pixels and zero graphics errors; its configured frame target is
60 fps, with approximately 50 fps observed during concurrent native QA rendering.
JavaScript motion, pacing, strings, sustain and all 272 directed morph checks
pass. Final input settings, dimensions, filters and the user's exact placement
are preserved except for the authorized 30-to-60 fps source target. Live evidence
and the original comparison assets are saved in the task's `spotify-realtime`
artifact directory; Spotify-specific workflow evidence is stamped separately
from unrelated changes in this shared checkout.


Spatial composition refinement (October 3, 2026)

The 17 scene families remain intact. `music_space.js` retains 96 samples for each
of the eight measured frequency voices (4.8 seconds at 20 Hz), with immediate
current envelopes at each leading edge. The state also follows arrangement
entropy, spectral register focus, stereo width and phrasing. It advances with
musical input, freezes in silence and survives scene changes. These are frequency
registers, not inferred isolated instruments or synthesized beat events.

`stage_depth.js` reads this state to compose eight continuous counterpoint paths.
Signal Architecture receives a circuit floor, waveform families receive separate
near/far ribbons, the phoenix receives swept plumes, and sculptural/spirit families
receive orbital fields. All paths retain matched points and morph geometrically
with the central form. Stereo differences separate individual registers; sustained
notes trace their own relief rather than sharing a single beat pulse.

The architecture now has spectral risers, connected skylines and per-register
placement. Waveform Loom has eight broader, individually folded sheets whose
shape carries recent musical history. Phase Helix has substantial ribbon surfaces
with local frequency and stereo articulation. Orbit Engine has responsive broad
gimbals and a faceted core. Prism Drive has real near/far depth and independent
harmonic contour relief. Curve sampling preserves smoother joined contours.

One existing GPU program provides analytic diffuse/reflection/rim shading on actual
facets, with direct musical material controls. Transparent facets and contour chunks
share a back-to-front order. Two fixed CPU vertex buffers and a fixed miter
workspace keep storage bounded; the GPU still owns one program, one buffer and one VAO.
No blur, bloom, feedback textures, sound playback or additional capture is added.
Canvas uses the same composition and geometry-derived material shading.

The mapping follows the principle of independently bounded musical parameters in
[Synesthesia's scene practices](https://app.synesthesia.live/docs/ssf/best_practices.html)
and preserves frequency detail described by
[TouchDesigner's spectrum owner](https://derivative.ca/UserGuide/Audio_Spectrum_CHOP).
The existing low-latency analysis/transport pipeline and direct attack rates remain
unchanged. `tools/test_spotify_depth.cjs` verifies sustained upper-register independence,
held musical trails with an immediate released head, bounded memory, silence hold,
render purity and continuous endpoints across all 272 directed spatial handoffs.


Final spatial verification: 35 focused Python regressions and the architecture
check pass. Sustained-response, evolution, pacing, palette and string checks pass.
Every directed GPU morph retains endpoint pixels and nonblank coverage. Native
OBS CEF renders all 17 scenes with zero graphics errors and three GPU resources;
60 fps is configured and approximately 58 fps was observed in the final isolated native
study. A temporary owned source projector was required to activate the native
browser independently of the host's nested program graph; it is closed after QA.
The existing Spotify input, filters, dimensions, placement and personal settings
are unchanged. `tools/benchmark_spotify_depth.cjs` measures finite render cost
without playback or settings changes; it confirmed roughly 2–4.3 ms median paint
cost for the sampled resting compositions after removing redundant correspondence
copies. The heavier architecture-to-loom morph measured 18.6 ms median paint cost.
Facet morphs reuse cached alignment without rebuilding arc metrics, and curve
interpolation reuses sample scratch instead of allocating temporary point/color
objects for every lookup. A 32-second live Spotify recording completed this morph
with no inactive samples or JavaScript errors, about 48 painted frames per second,
and median capture timestamp age 30.05 ms. Native rendering has additional
host/CEF overhead; these numbers are
render costs and frame rates, not speaker-to-screen hardware latency.

Definition and visual hierarchy refinement (October 3, 2026)

The scene catalog and full-range signal pipeline remain intact. Continuous main
outlines now retain a visible base intensity instead of breaking into equal-weight
moving highlights. Thin construction lines and the eight background memory paths
are subordinate to the silhouette. Main colors belong to a close evolving harmony;
the complementary color is reserved for authored accents. Facet lighting removes
the moving sheen and restrains sharp reflections.

Signal Architecture uses sixteen towers in two staggered banks rather than
thirty-six overlapping structures. Current registers drive the foreground, recent
phrasing drives the rear bank, and each box has one outer contour rather than
duplicated edges around every face. Waveform Loom retains all eight independent
voices in ordered, narrower sheets with a shared flow and bounded local relief.
Scene-specific deformation budgets keep the authored form readable under dense music.

The morph owner matches primary contours to primary contours and supporting rails
to supporting rails where both compositions provide those roles. Repeated open
curves are partitioned by spatial order, so several old shapes move into distinct
sections of a new curve. Dense incompatible facets reduce their material intensity
during reshaping; the transported main outlines remain visible and musical, and
both authored endpoints preserve their pixels. The regression samples each contour
by arc length to measure bass response inside the scene, where a union bounding box
can miss meaningful internal movement. All 272 directed morphs retain endpoint
continuity, nonblank coverage and current bass response; palette, sustained response,
structural evolution, motion, depth, and pacing checks pass.

Final definition verification: 35 Spotify offline regressions and the architecture
check pass. Native OBS renders all seventeen scenes with no graphics errors and
preserves the existing source, filters, placement and settings. A 32-second actual
Spotify recording crosses architecture into waveforms with no inactive samples or
JavaScript errors, 1,900 painted frames, median paint cost 12.5 ms and median capture
timestamp age 12.82 ms. These are observed browser values, not a hardware latency
guarantee. Evidence and the pre-change code are in the task's `spotify-definition`
artifact directory. The disposable native source projector is closed after QA.

Live transport advances the musical state on each received capture generation,
independently of OBS painting. Capture clock differences determine the step;
repeated/stale generations do not repeat hits. No frame queue accumulates.
The first six audible seconds establish a bounded input reference (gain 1–2.2);
that reference locks for the track. Builds and quiet passages thereafter keep
the same gain. A quiet intro can therefore leave a louder drop at the bounded
ceiling; this is deliberately preferable to short-term automatic gain chasing.
The installed page draws directly into its visible WebGL canvas. Compatibility
previews retain the offscreen draw API and Canvas fallback. A physical bass lift
and damped midrange lean articulate the main sculpture; phrase presence sets
size/depth, while sustained roughness drives fine vibration.

Research: Synesthesia separates levels, hits, presence and audio-integrated time
(https://app.synesthesia.live/docs/ssf/audio_uniforms.html); its performance
guidance requires live input (https://synesthesia.live/docs/faq/). Resolume
exposes frequency selection, gain and independent fall rates
(https://resolume.com/support/en/parameter-animation). projectM's current
Loudness.cpp divides immediate and averaged bands by a long reference; we keep
relative articulation separate and lock the input reference to preserve breaks
(https://github.com/projectM-visualizer/projectm/blob/master/src/libprojectM/Audio/Loudness.cpp).
`tools/test_spotify_feed.cjs` checks between-paint attacks, capture timestamps,
track-gain stability and build/release behavior. Native OBS QA can proxy the
actual Spotify stream with SPOTIFY_NATIVE_LIVE=1, at the installed smaller size.

The installed page begins with Signal architecture. Its current-register towers
grow more decisively, while the rear bank keeps recent musical memory. Scene
selection first considers the least-visited eligible families, then favors
related contours and current musical character. Phrase build/release can invite
a morph after the minimum residence; internal evolution continues throughout.
Quiet main silhouettes retain a small readability floor, with subordinate
support contours. Existing source filters/settings and inner placement are
preserved; the existing Spotify scene was added to Lobbies with a new parent
offset so the whole widget fits the canvas.

Held broadband noise also advances the fine texture carrier, at a smaller weight
than interacting rough partials. This prevents hiss from becoming a static ridge
once its initial attack releases. Clean tones and silence do not invent texture.
The finite native QA probe catches failed reports, bounds simultaneous requests,
stops after a closed server, and clears its timers when the page detaches. Cleanup
unloads the owned browser before removing it and observes the wrapper leaving
the graph before checking the original presentation. Its disconnected-server
regression is `node tools/test_spotify_native_probe.cjs`.

OBS attachment waits for the presentation worker's ready identity. Each new worker
refreshes an existing managed loopback browser once, so a page loaded while the
server was unavailable can recover. Custom URLs, dimensions, filters, transforms
and visibility are preserved. Failed OBS attachment retries; replaced workers
cannot inherit an older attachment result. No extra capture or browser worker
is created. `tools.test_spotify_presentation` covers this readiness handoff.

Three-axis view (October 3, 2026): the spatial owner integrates a continuous
audible orbit and eases yaw, pitch and roll. It never resets that orbit at a hit,
track change or morph. Pure view math reconstructs each authored XYZ position
before rotating it; one fixed focal length and frame scale cover the entire
foreground orbit. Turning the view never triggers automatic zoom.
The GPU's facet normals and Canvas fallback use the same focal length/framing,
so side views retain real relief and coherent shading. Musical springs, voices,
input gain and saved OBS placement retain their existing roles.
`node tools/test_spotify_camera.cjs` checks rigid geometry, all three angle
ranges, silence, cadence and view bounds; `node tools/test_spotify_camera_gpu.cjs`
checks actual pixels for 85 views across all 17 stages.
Native OBS QA also records the changing camera angles and uses the actual live
Spotify feed when `SPOTIFY_NATIVE_LIVE=1`. It waits through silence, observes a
bounded span of each stage and checks quiet contours separately from stronger
passages; it never changes the captured signal to satisfy a visibility check.

Spatial polish: unmatched decorative contours contract around their own XYZ
centroid during morphs, retaining their depth in tilted views. Fine facet grain
uses model coordinates with rational perspective interpolation, preserving its
position inside a face as the camera turns. Focused regressions are
`tools/test_spotify_spatial_polish.cjs` and `tools/test_spotify_material_gpu.cjs`;
the latter reads actual grain crests/troughs at a fixed physical point across
27 viewing angles.

Musical sizing: production attacks use absolute register energy, with the body
accent restricted to 40–178 Hz. A bounded estimate of ordinary fluctuations
adjusts the onset rejection threshold without changing audio gain. Upper-register
notes retain their own articulation. The first bass attack expands the body;
local compression and rebound still provide weight. A separate 1.25-second
presence envelope controls slower body growth and release, rather than individual
FFT fluctuations or the camera angle. Phrase lift gently brightens authored color
accents, and sustained registers give their own supporting trails more definition.

`tools/spotify_rhythm_fixture.py` silently measures known PCM kicks through the
production causal DSP. `tools/test_spotify_rhythm.cjs` checks immediate size crests,
quiet/loud attack contrast, rejection of unrelated timbre pulses, stable camera
framing and phrase color accents. Synthetic timing is a DSP/presentation-model
check, not a measurement of live speaker-to-screen latency.

Temporary WebGL context loss uses a separate Canvas presentation surface while
retaining the original WebGL surface for restoration. Recovery replaces only
the picture and recreates the bounded renderer; audio history, input calibration
and the scene journey remain intact. An unavailable GPU keeps the stable Canvas
fallback. `tools/test_spotify_radiance.cjs` checks both cases using actual pixels,
context loss/restoration and GPU resource cleanup.

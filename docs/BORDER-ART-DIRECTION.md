# Border material and choreography review

The background and gameplay opening are transparent. Foreground artwork remains
readable: opaque characters, metal, stone and painted props are combined with
glass, vapor, reflections and light wakes. Transparency is a material choice,
not a global dimmer. The shared mask feathers only the final strip next to the
gameplay opening, x=240..1679, y=170..839 at 1920×1080.

## Presentation owners

- Soundboard: 89 authored cue treatments covering the 90-stem library, with
  Hooray explicitly retained as original media. Mom Frog now has a photographic
  three-view extraction and a lily-pad concert border lasting its 0.418-second
  croak. Its audio has targeted hiss reduction, no normalization, and a recoverable
  external original backup. Pedro's seven
  dancing raccoons and sad violin's five instruments/tearful cameos were approved
  as design references on 2026-10-03. All 85 renewed cues have distinct focal
  subjects and contextual supporting casts. Cena, muffins and the accelerating
  Deja Vu car remain preserved. Native cue/library owners compile into the
  170 KB module; unused generated raster paintings remain recoverable.
  The audio clock drives one developing sequence. Original audio and personal
  gains remain unchanged. There are no full-screen washes or central captions.
- League: all 58 built-in keys plus saved custom rules. Foreground relics establish
  context: Hextech uses brass and blue glass, Mountain mineral strata, Ocean
  refracting waves, Herald a watchful eye, Grubs segmented little creatures, and
  Baron curling bioluminescent tendrils. Combat, structures, economy, progression
  and lifecycle cues have independent silhouettes and actions. Inferred events
  retain SIGNAL labels and existing opt-in policy.
- League death: four swinging soul lanterns, an hourglass, silk, moths and fine
  silver constellations develop over the observed death interval. Remaining
  time comes from actual state; unknown timers do not receive invented numbers.
- Subscribers/gifts: bear den, turtle terrarium, ram workshop and phoenix hatch,
  with separately composed gift deliveries and supporting perimeter casts.
  Main spirits and text stay in the top 168 pixels. The approved lower-left
  follower renderer remains intact and owns its four recovered original images.
- Raids: harbor flotilla, lantern flight, cosmic express and lily-pad carnival.
- Cheers: pearl chest, amethyst retort, orbital observatory and botanical instrument.
  These use separate timed arrangements and real Bit counts.

Subscriber text is DOM text, supplied by each incoming event. Names are never
baked into images or interpreted as HTML. Three authored variants for every
spirit/new-sub/returning-sub/gift combination give 36 contextual combinations;
each spirit also has an anniversary line. Actual tier, tenure, gift count and
shared resub messages are used only when supplied. Name fitting waits for fonts,
responds to viewport changes and wraps long names within the top strip. Text
reveals with the miniature performance; reduced motion reveals immediately.

## Verification

The isolated Chromium checks cover actual artwork, distinct catalog frames,
solid/glass material layers, evolution through each clip, deterministic pause,
clear gameplay, dynamic usernames, safe literal text, custom media, completion,
replacement and disconnect cleanup. Approved follower fingerprints are checked
without updating their expected values. Render timing is a canvas measurement,
not an OBS/game frame-rate guarantee.

`tools/verify_border_rework_obs.py` uses a finite loopback fixture and uniquely
named temporary OBS browser source/scene. Native OBS renders run in Studio preview;
the tool never writes the program scene, consumes live alerts, instantiates audio,
or changes original sources. Preview ownership is checked before restoring it.
Temporary resources and the fixture are cleaned up. Before/after checks compare
original source settings, levels, mute, audio tracks and filters. This establishes
CEF rendering; real Twitch delivery still requires an actual incoming event.

Review tools accept an external artifact directory. This review uses the task
workspace on C:; `tmp_obs_debug` remains the fallback:

- `sound-border-material-review.png`, `sound-cena-muffins.png`
- `league-all-event-borders.png`, `league-auxiliary-designs.png`
- `subscriber-spirits.png`, `supporter-spirits-motion.webm`
- `raid-worlds-motion.webm`, `cheer-material-worlds.png`
- `border-material-verification.json`, `border-rework-obs-verification.json`
- Focused browser-effects/League/celebration offline checks (59 passing tests)

User audio, profiles, phrases, per-asset placement, gains, OBS filters and saved
settings are preserved. League's saved strength applies once after all native
layers are composed. Static artwork is refreshed through the existing sources;
no competing playback owner or global animation worker is added.

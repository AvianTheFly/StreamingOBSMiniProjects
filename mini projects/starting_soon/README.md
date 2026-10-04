# Starting Soon

Open the Hub's **Starting Soon** module at http://localhost:7420/#projects/starting_soon.
The supported Hub discovers this module automatically.

1. **Clips & playlists**: search saved clips, filter favorites/highlights, privately
   preview them, and select several to add. Import existing compilations or build
   named playlists. Drag or use arrows to reorder; save before playing.
2. **Artwork & placement**: choose and order ten backgrounds, edit the message,
   rotation interval, and clip placement. The monitor previews unsaved designs.
   Save the design to apply it. Each artwork suggests a side that leaves its
   character visible; applying that suggestion is optional.
3. **Open in OBS** to enjoy the rotating scenery. Enable the highlight overlay
   when wanted, then **Play playlist**. The monitor shows current progress,
   pause/resume, skip, stop, upcoming clips and recent history. Preview any library
   clip and choose **Queue next** to play it once. Moving/removing upcoming entries
   affects the running queue; saved playlists remain independent.
   Entry and return use a short fade; the saved OBS transition remains unchanged.
4. **Finish & return** stops clips and returns to the previous scene only while
   this session still owns the scene. Switching away manually stops playback and
   invalidates automatic return.

Loop, shuffle and scenery breaks between clips are configurable. Missing saved
clips remain listed for repair and are skipped at playback. This feature does not
start streaming or recording. Capture clips using Instant Replay and refresh the
library. Private previews are initially muted and do not play through OBS.

Placement choices are Preserve OBS, left, right, cinema, corner, or a custom 16:9
box. Preserve OBS is the default and respects the existing native media transform.
The clip preview dialog can save a placement for one asset; it takes precedence
over the general layout. Returning to an inherited placement restores the base
box. Clip frames disappear between clips, leaving the scenery visible.

OBS sources are `Hub Starting Soon` (browser) and `Hub Starting Soon Clips` (native
media). Installation preserves existing source filters and transforms. Explicit
layout edits move only the dedicated clip source and align the browser frame.
The native source lives inside `Hub Starting Soon Stage`, keeping placement edits
live in Studio Mode. Installation carries the original transform into this stage
and retains the previous top-level item hidden for recovery.
Coordinates use a 1920x1080 design canvas, scaled to OBS's base canvas. Keep the
Hub running for the browser overlay. Audio plays through the native clip source.
The OBS fader edits the actual loaded clip's saved level, initially using its
known Instant Replay level or -6 dB. Other module and microphone levels are untouched.

Personal configuration, named playlists and asset placements live in `settings.json`;
clip levels live in `asset_volumes.json`. Changes use external SettingsBackups
history, atomic transactions and revision checks against stale editor saves.
Replay files remain under `C:\StreamingMedia\Replays` and are never copied here.

Ten paintings live in `art/`: the original fjord, forest and mountain warrior
scenes plus Lantern Tide (turtle harbor), Ember Caravan (desert ram), Jade Refuge
(jungle bear), Starfall Observatory (celestial phoenix), Drowned Cathedral
(immense turtle city), Stormglass Citadel (thunder bear above the clouds), and
Cinder Express (volcanic ram railway and phoenix). They follow the original
game-start image's painted spirit-world style. Prompts are recorded in
`art-prompts.json`, `art-prompts-expansion.json` and `art-prompts-20261003.json`.

## Independent artwork and message

The original PNGs already contain no text. **Artwork & placement** has an
**Open clean PNG** link for every painting, and a **Reuse the art & message**
section with independent OBS Browser Source URLs (1920 × 1080):

- `/starting-soon/overlay.html?layer=artwork`: rotating original artwork only;
  no message, caption, shading or clip frame. Add `&art=lantern-tide.png` (or
  another catalog filename) to keep one background fixed.
- `/starting-soon/overlay.html?layer=message`: the editable heading/subheading
  on a transparent canvas. It follows the message visibility setting.
- `/starting-soon/overlay.html?layer=frame`: the transparent highlight frame,
  visible only during enabled clip playback. The native video remains separate.
- `/starting-soon/overlay.html`: the complete existing waiting-room overlay.

Use **Hide/Show Starting Soon text** at the top of the desk for an immediate saved
change, without publishing other draft edits. The appearance editor also previews
message and scenery-caption visibility before **Save scene design**. Hiding text
preserves its wording and leaves clip playback intact.

Future controllers can call public project actions `show-message` / `hide-message`,
or POST those names under `/api/starting-soon/`. Settings edits use the existing
`POST /api/starting-soon/settings` contract with `show_message`, `show_footer`,
`title`, `subtitle` and the current `revision` from GET `/api/starting-soon`.

## Production controls and saved looks

**What viewers see** provides scenery-only, waiting-room message, and optional
highlight controls. Clips never start just from opening the scene or applying a
look. Disabling highlights cancels the running playlist and parks its source;
saved playlists and files remain. Private clip-window preview works even while
the live highlight overlay is disabled.

**Saved looks** captures the current visual draft: artwork order, editable message,
visibility, clip-window default, motion and transition. Preview stays private;
Apply publishes the look. Looks exclude playlists, asset placement overrides and
audio levels. Opening, break and clean scenery looks are included. Save your own
before adapting them; deletion removes only the named design.

Four artwork reveals are available: dissolve, celestial aperture, stormglass gates
and ember sweep. Gentle drift moves only the scenery. Native footage and message
placement stay fixed; reduced-motion mode skips motion. Two image layers reject
late loads and release replaced animations. These reveals are independent of
native lobby passages and full-scene spirit stingers.

Future controllers use the existing settings endpoint for `saved_looks`,
`highlights_enabled`, `transition_style` (`dissolve`, `portal`, `gates`, `embers`)
and `motion` (`still`, `drift`), with the current revision. Disabling highlights
requests playback cleanup through the feature API; visual edits never play media.

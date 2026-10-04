# League production borders

The Hub's League API page now opens **Production borders**. Direct controls:
http://127.0.0.1:7431/production. The **Clip alerts & media** link opens the existing
editor. Borders have their own `production.json`; `alerts.json` and its personalized
presentation banks are retained. In this setup, borders are enabled and clip
autoplay remains off.

One existing OBS browser input, **League API Alerts**, serves both layers at
http://127.0.0.1:7431/overlay. Keep its **League API** scene above the game capture.
Canvas: 1920 × 1080, 30 fps. Border effects are silent; the existing League module
continues to own kill audio, death/respawn cues and session recording. Mom Frog,
Hooray, soundboard trigger rules and per-asset settings are untouched.

## Auxiliary art direction

All 58 built-in event keys have compositions; the current collection refresh is
tracked in `docs/BORDER-REFRESH-20261002.md`. `web/event-art.js` owns dispatch,
captions and entrances; `art/event-scenes.js` assembles artwork owners. Native
`element-performances.js`, `void-performances.js` and `structure-performances.js`
own renewed objective and structure compositions. Separate combat, vital,
progression, economy, lifecycle and inference performance files complete the
built-in catalog; custom rules use the vital instrument composition, with a
health motif for the existing health-threshold example. `soul-performance.js`
owns continuous death, `event-ink.js` local paint tools, and `event-props.js`
reusable subject silhouettes. Build `web/event-relics.js` with
`py -3.11 tools/build_border_art.py`. The self-contained native bundle is about
67 KB instead of 7.6 MB. Original atlases and sanctuary art remain preserved on
disk and are no longer embedded or decoded by the live presentation.

The renewed elemental casts use a mineral dragon and growing seams, an obsidian
dragon with ember silk, a coiled sea-dragon and water lenses, a feathered wind
dragon, botanical chambers around a segmented Chemtech creature, and a silver
skeletal Elder wing. Hextech retains its approved crystal-wing circuit show.
Baron has a moving jaw, three eyes and serpentine body; Herald blinks inside a
segmented shell; three grubs have independently marching little Voidmites.
A hooked light carries a stolen jewel into a glove. Turret masonry dismantles,
the first turret reveals a reward treasury, and inhibitors have separate
fracture, dormant-clock and reassembly acts. Combat has blade duets, little helmet
banners, clutch-heart stitches and armored support hands. Health has protective
glass, a healing garden and revival gate; progression has books, spell panels and
a mana instrument. Economy uses satchels, drawers, harvest props and a ward lens.
Lifecycle has a minion march, summoning pillars, a victory cup, a torn defeat
standard and closing folio. Each optional inferred cue has contextual props
without upgrading its tentative confidence.

Light trails have a visible head and a continuously fading tail. Solid relics anchor
the composition; selective glass, vapor and soft glints give it depth. The shared
mask preserves solid details and feathers only the boundary toward gameplay. There is
no full-screen flash or opaque title card. Each cue eases in and out relative to its
saved duration. The existing opacity, impact, event enable/cooldown and pacing
settings are retained. Strength applies once to the composed frame so overlapping
layers cannot overpower the saved opacity. The sound-effect borders use the same boundary mechanics
with their own themed scenery, motion and transparent atmospheric fields.

The sustained death presentation has four independently swinging etched soul
lanterns, glass silk, an hourglass using the observed remaining timer, hanging
charms, charged constellations and drifting moths. Particle births use an
absolute serial so successive passages have different positions. Light heads
leave slowly disappearing tails.
The arrangement develops over the death interval rather than resetting a short loop. It remains
only while the local player is actually dead, clears on respawn/disconnect/game
end, and does not rotate videos. A remaining-time caption uses only the API's
actual respawnTimer; missing or invalid timers get a neutral caption. Confirmed
personal payoff softly changes the accent. Reconnection can establish a quiet
border from current isDead evidence without inventing a trade or old death event.
The death event's duration controls its entrance cue; the sustained presentation
follows live player state. Pausing alerts or disabling production borders also hides it. The clip-overlay
toggle remains independent, so clip cards can stay off while borders remain on.

With production enabled, automatic clip cards, rotating death memes, old border
flashes and level sprites yield to the new artwork. The saved clip banks, original
sources, transforms, filters, audio gains and explicit clip previews are retained.
Personal kill audio and kill-streak triangles remain owned by the League module.
The existing inferred recall callback retains its legacy presentation.

Context references: [Riot Live Client Data API](https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api),
[Riot's 2026 objective update](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/),
and [Void ecosystem context](https://www.leagueoflegends.com/en-au/news/game-updates/2024-gameplay-preview/).
These inform art, not new detection claims or assumed buff timers.

For silent review, run `tools/preview_league_art.cjs` with the bundled Playwright
runtime. It uses an isolated service, draws over a schematic game backdrop, and
writes `league-auxiliary-designs.png`, `league-all-event-borders.png`, and
`league-auxiliary-motion.webm` to `tmp_obs_debug`. It never operates live OBS.

## Original implementation and controls

Mountain ambience uses mineral cliffs and narrow fault engravings. An observed friendly
Mountain kill illuminates the mineral paths. Enemy or unresolved kills quietly
release an established border. Infernal uses flames, Ocean tidal caustics, Cloud
wind trails, Hextech circuit geometry, and Chemtech vapor/bubbles. Elder has a short
kill celebration, without a predicted spawn atmosphere.

The catalog covers all **58 built-in detector keys**. The 47 observed keys include
kills, assists, multikills, objectives, structures, health/resource changes,
respawn, levels, abilities, inventory, CS, vision score, game start and endings.
Baron grows curling Void tentacles; Herald opens glowing eyes; Void Grubs march
around the edges. Multikills develop distinct blade, orbit, compass and crown compositions. Towers
crack and collapse, level-ups summon rune rings, purchases scatter gems, and
victory adds gold laurels and stars. Ordinary kills and frequent stat changes
have smaller, shorter cues. Existing personal audio and death behavior remains.

The other 11 keys are optional correlations, such as a possible purchase or
teamfight. Their category is off by default and their titles say **SIGNAL**;
the detector does not know whether those inferred causes actually occurred.
Resource spend, item removal and legacy Atakhan also default off individually.
Custom detector rules receive a rune effect when enabled in their event card.

Only one ambient objective and one short celebration exist at once, alongside a sustained death state when applicable. Defaults:
56 px edge depth, 80% strength, 2.7 second celebrations, four second minimum gap.
Each event also has its own cooldown. Smaller effects respect the global gap;
major plays can interrupt lower-priority cues and multikills upgrade immediately.
Dragon transitions and game endings bypass the gap. Effects last 0.6–5 seconds;
there is no queue that replays old events after a busy moment.
All drawing excludes the central rectangle x=240..1679, y=170..839. There is no
full-screen flash. The title appears near the top edge.

Preview buttons also affect OBS. Use them when appropriate for your live stream.
The seven second Mountain cycle demonstrates the entrance and destruction without
inventing a game event or firing any sound. **Clear current effects** suppresses
the current atmosphere until the next objective cycle; later real events still work.
Disable the top toggle to stop all production borders.

The searchable **Effect library** has a category filter and automatic-play,
impact and duration controls for each event. **Save effect edits** applies those
overrides independently of the master controls. **Reset** removes that event's
overrides when saved. Filtering preserves pending edits. Previews use saved values
and can test an individually disabled effect without enabling its automatic play.
**Impact** adjusts visual energy and particle density; **Strength** adjusts opacity.
The recent-activity line explains which cues were shown or skipped for pacing.
Existing settings files gain new defaults in memory without overwriting user data.

## Spawn evidence and limits

Riot's documented [Live Client Data API](https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api)
exposes cumulative kill events. It does not document a dragon-spawn event. The
observed live match still reported `mapTerrain=Default` after two dragon kills;
Default must never be treated as Mountain.

Spawn atmosphere is an **inference**, not an API spawn notification. On Classic
Summoner's Rift, the repeating element is inferred after at least three observed
elemental kills. Game time must reach last kill time + 300 seconds. The element
comes from a recognized terrain value or the last observed elemental kill. The
border stays until another kill, GameEnd, explicit clear, or API loss. Startup
can restore an already established atmosphere quietly, without replaying old kills.

First/early random dragons stay clear. Unknown modes, unrecognized last dragon,
Elder, a team with four elemental kills, or unresolved ownership near Soul suppress
the prediction. Current Swiftplay has at most two elemental drakes, so the three
kill requirement excludes it even if the client calls its mode CLASSIC. Exact early
type, Soul acquisition and Elder timing are not fabricated.

Timing/rift evidence: Riot's [9.23 elemental-rift notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-9-23-notes/)
and [2026 Swiftplay changes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/).
Recheck `objectives.py` when Riot changes objective rules. The spawn guards favor
missing an uncertain effect over displaying the wrong element.

## Code map

| File | Responsibility |
| --- | --- |
| `lib/league_live_client.py` | Fixed loopback endpoint, 250 ms shared cache, deep copies and scoped TLS handling |
| `league_api/engine.py` | Existing local/team identity, observed events and separate optional clip scheduling |
| `production/objectives.py` | Conservative dragon timer reconstruction from history |
| `production/catalog.py` | All event definitions, category groups, overrides and preview manifest |
| `production/director.py` | One atmosphere, one bounded show, cooldowns, upgrades, endings and previews; no I/O |
| `production/config.py` | Validated independent settings, revision conflicts and atomic persistence |
| `production/obs_source.py` | Existing-source recovery and explicit repair; preserves transforms, filters and audio |
| `web/materials.js` | Deterministic cached stone textures, edge geometry and center clipping |
| `web/terrain.js` | Low-motion objective atmosphere and stone fracture drawing |
| `web/bursts.js` | Small dispatcher for short celebrations |
| `web/primitives.js`, `web/palette.js` | Shared glows, metal crests, rails, captions, particles and colors |
| `web/combat.js` | Blades, winged streaks, links, fractures and health pulses |
| `web/elements.js` | Elemental dragon bursts and healing/respawn wings |
| `web/objectives.js` | Baron, Herald, Grubs, structures and crowned finishes |
| `web/progression.js` | Runes, portals, treasure, harvest, vision and minion march |
| `web/scene.js` | Canvas composition and strength controls |
| `web/event-art.js` | Event dispatch, contextual captions, entrance and death lifetime |
| `web/event-relics.js` | Per-key foreground subjects, selective materials and soul-sanctuary hardware |
| `web/overlay.js` | Poll-state interpolation, bounded RAF, visibility and stale-transport cleanup |
| `web/control.*` | Independent settings, preview, clear, readiness and silent monitor |

To add a show, map an existing detector key in `catalog.py`, add a renderer to the
matching visual module and dispatch it in `bursts.js`, then test ownership/pacing.
Keep uncertain causes labeled and opt-in. To add ambience, keep
its evidence in `objectives.py`; do not make the renderer guess game state. Avoid
duplicating audio or introducing keyboard listeners in this package.

## Review findings addressed

- The original watcher dispatched the whole cumulative event history on startup
  and reconnect, replaying kill audio and streak effects. It now records a baseline,
  accepts only events up to five seconds old, sorts IDs and resets on game-time rewind.
- Two League consumers fetched the same allgamedata endpoint independently. They
  now share a short cache while retaining separate copies of the snapshot.
- TLS warnings were disabled globally by the old watcher. Certificate relaxation
  is now scoped to Riot's fixed localhost endpoint, with proxies disabled.
- OBS setup rewrote existing transforms. Both the Python repair and standalone
  Node command now use the same settings-snapshot boundary without resetting
  transforms, filters, audio routing or faders.
- An OBS browser opened before the server could remain disconnected. The service
  checks its poll heartbeat and refreshes an existing source after transport loss.
- The browser clears production pixels after 2.5 seconds without a fresh state,
  and on visibility loss. The service clears game effects after three seconds of
  failed API polling. Idle has no animation loop; ambience renders at 15 fps and
  celebrations at 30 fps. Cached stone frames measured about 1 ms in isolated Chrome
  on this machine; this is a renderer measurement, not an OBS/game FPS guarantee.
- The Hub status includes borders as well as clips. Clip on/off and production
  on/off remain independent, with the distinction visible in both editors.

This review focused on the League detection/rendering boundary and its downstream
audio/OBS behavior. It did not rewrite unrelated modules or replace user data.

## Validation

Run from the repository root with Python 3.11 and the normal import-path setup:

```python
import unittest
from lib.paths import ensure_import_paths
ensure_import_paths()
unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromNames([
    'league_api.test_production', 'league_api.test_border_catalog', 'league_api.test_engine',
    'league_api.test_editor', 'tools.test_league_live_client',
    'tools.test_league_event_baseline', 'tools.test_stream_regressions']))
```

`tools/test_league_production.cjs` uses Playwright with installed Chrome, muted and
headless. It launches `tools/league_production_fixture.py` with temporary settings,
without live polling, OBS mutations or keyboard listeners. It verifies all seven
ambient themes, center alpha, opacity, all 58 bursts at entrance/midpoint, render
budgets, transport cleanup, per-event edits/filtering/reset, controls and stale
saves. Screenshots go to `LEAGUE_TEST_ARTIFACT_DIR` or a temp directory. The fixture
terminates on parent-pipe closure, including a crashed test runner. No preview is
sent on stream.

Initial deployment verification on 2026-09-29: 74 focused Python checks passed, along with
the actual Chrome rendering/control checks and the existing editor/monitor checks.
The restarted supported Hub listed all ten modules with one keyboard child; ports
7420/7431/7442/7443/7444 belonged to that Hub. OBS reported a healthy League overlay
heartbeat. Its saved transforms, filters, fader, mute and audio routing matched
before/after; the live stream continued. Twitch raids and redemptions remained
connected. No synthetic League preview was sent to the live program. The temporary
continuation plan was removed after this verification.

Expanded-catalog validation: all League Python suites plus shared-fetch, baseline
and stream regression suites passed (81 checks), along with the existing editor
and monitor checks. Isolated Chrome verified all 58 borders and seven atmospheres
with zero alpha in the protected gameplay center. After the authorized hidden
restart, the v2 Hub had one keyboard child and all ten modules ready. Its live
catalog contained 58 built-ins plus the user's existing custom rule. Every new
renderer route returned 200 and the actual controls loaded without browser errors.
Real respawn, damage and low-health cues entered the activity history; no synthetic
preview was sent to the live program. OBS's League source settings, transforms,
filters and audio matched the pre-restart snapshot and the stream continued.
Raids/follows/subs/gifts/cheers and Channel Points both reported connected with
healthy overlay heartbeats. The temporary expansion plan was removed after these
checks. Isolated Chrome's slowest effect averaged 1.97 ms per frame on this machine;
this is a renderer measurement, not an OBS/game FPS guarantee.

The current artwork sources are `art/event-scenes.js` and `art/event-frames.js`.
Each event family owns its silhouette, surface treatment and transition. They
compile with `tools/build_border_art.py` into the existing `web/event-relics.js`
static route. Shared material shading and edge transparency remain in the public
browser-effects mechanics; no event policy or source lifecycle moved.

Hextech uses `elements.js::hextechAtmosphere` for sustained atmosphere and the
capture entrance: oversized translucent hexagonal cells, cyan/violet charges
with fading tails, asymmetric circuit paths and small etched dragon sigils.
The capture opens a faceted crystal and swept dragon wings, then discharges a
sequence of illuminated scales down both sides. Ambient geometry stays on its
own elapsed time during the capture, so the same border is never drawn twice.
Fine branching scale-work, nested facets, diamond inlays and broken crown
circuits add detail within narrow edge margins. The capture charge forks into
smaller satellite scales, preserving the original clear gameplay centre.
Layered luminous trails and travelling glass refractions give the edges more
presence. Open-path heads fade at both endpoints, while the wing spread and
capture envelope ease in and out with smooth tangents.
Open circuit charges leave completely before reentering; their tails never
connect the endpoints with a stray diagonal. Passing glows fade at their wrap.
All positions derive from scene elapsed time, with no additional timer or worker.
The existing scene edge mask preserves the clear gameplay centre, and saved
master opacity still applies once to the composition. The event dispatcher
bypasses relic artwork only for `dragon_hextech`; match-screen precedence is
unchanged.
Finite visual reviews default to four seconds at 60 fps; `BORDER_HEXTECH_SEQUENCE=1`
shows the capture at its actual speed over the continuing ambient clock.

Transient League responses are clamped to 2–5 seconds by the production catalog;
the control input uses the same lower bound. Historical saved overrides below
two seconds remain intact as user data and are clamped only when presented.
Sustained dragon ambience and the actual death-to-respawn lifetime retain their
existing owners. Soundboard borders instead follow the complete audio duration.

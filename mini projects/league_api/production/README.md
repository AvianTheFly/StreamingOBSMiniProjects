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

## Shows and controls

Mountain ambience uses beveled stone tiles around the edges. An observed friendly
Mountain kill breaks the tiles into jagged chips. Enemy or unresolved kills quietly
release an established border. Infernal uses flames, Ocean flowing ribbons, Cloud
wind trails, Hextech circuit geometry, and Chemtech vapor/bubbles. Elder has a short
kill celebration, without a predicted spawn atmosphere.

Friendly Baron, Herald, steals and team aces have corner sigils and edge particles.
Your double/triple/quadra/pentakills upgrade one gold celebration. Friendly tower
and inhibitor kills break stone edges. Ordinary kills, death, low-health heuristics
and inventory changes do not add production effects. Existing personal behavior
for those events is preserved.

Only one ambient objective and one short celebration exist at once. Defaults:
56 px edge depth, 80% strength, 2.7 second celebrations, four second minimum gap.
Higher priority shows can interrupt; increasing multikills can upgrade immediately.
Dragon kill transitions bypass the gap so a border cannot remain after the kill.
All drawing excludes the central rectangle x=240..1679, y=170..839. There is no
full-screen flash. The title appears near the top edge.

Preview buttons also affect OBS. Use them when appropriate for your live stream.
The seven second Mountain cycle demonstrates the entrance and destruction without
inventing a game event or firing any sound. **Clear current effects** suppresses
the current atmosphere until the next objective cycle; later real events still work.
Disable the top toggle to stop all production borders.

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
| `production/catalog.py` | Supported event keys, themes, priorities and category toggles |
| `production/director.py` | One atmosphere, one bounded show, upgrades, clear and previews; no I/O |
| `production/config.py` | Validated independent settings, revision conflicts and atomic persistence |
| `production/obs_source.py` | Existing-source recovery and explicit repair; preserves transforms, filters and audio |
| `web/materials.js` | Deterministic cached stone textures, edge geometry and center clipping |
| `web/terrain.js` | Low-motion objective atmosphere and stone fracture drawing |
| `web/bursts.js` | Short celebrations, titles and edge particles |
| `web/scene.js` | Canvas composition and strength controls |
| `web/overlay.js` | Poll-state interpolation, bounded RAF, visibility and stale-transport cleanup |
| `web/control.*` | Independent settings, preview, clear, readiness and silent monitor |

To add a show, map an existing **observed** engine key in `catalog.py`, add its
renderer in `bursts.js` if needed, and test ownership/pacing. To add ambience, keep
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
    'league_api.test_production', 'league_api.test_engine',
    'league_api.test_editor', 'tools.test_league_live_client',
    'tools.test_league_event_baseline', 'tools.test_stream_regressions']))
```

`tools/test_league_production.cjs` uses Playwright with installed Chrome, muted and
headless. It launches `tools/league_production_fixture.py` with temporary settings,
without live polling, OBS mutations or keyboard listeners. It verifies all seven
ambient themes, center alpha, opacity, selected bursts, transport cleanup, controls
and stale saves. Screenshots go to `LEAGUE_TEST_ARTIFACT_DIR` or a temp directory.
The fixture always terminates after the browser test. No preview is sent on stream.

Deployment verification on 2026-09-29: 74 focused Python checks passed, along with
the actual Chrome rendering/control checks and the existing editor/monitor checks.
The restarted supported Hub listed all ten modules with one keyboard child; ports
7420/7431/7442/7443/7444 belonged to that Hub. OBS reported a healthy League overlay
heartbeat. Its saved transforms, filters, fader, mute and audio routing matched
before/after; the live stream continued. Twitch raids and redemptions remained
connected. No synthetic League preview was sent to the live program. The temporary
continuation plan was removed after this verification.

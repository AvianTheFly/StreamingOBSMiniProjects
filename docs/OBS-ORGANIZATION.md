# OBS organization and rollback

Installed October 3, 2026 in the supported `Streaming Scripts v2` Hub.

The active OBS collection remains `live_duplicate`. Its configured file is
`%APPDATA%/obs-studio/basic/scenes/10326.json`. Other older files have the same
display name; do not select a file by display name alone during maintenance.

## Paired rollback

- GitHub pre-change commit: `51eb0f4`, tagged
  `rollback/obs-organization-2026-10-03`.
- OBS Scene Collection menu: **Rollback - Before Organization - 2026-10-03**.
  Its separate file is `Rollback_Before_Organization_2026_10_03.json` in OBS's
  scenes folder. It contains the complete original 56-scene collection.
- Settings history remains outside Git under
  `%LOCALAPPDATA%/StreamingHub/settings-history/2eb8bc17aa91`.
- Native inventory, exact original collection, screenshots, current faders,
  migration report and verification logs are stored privately under
  `%LOCALAPPDATA%/StreamingHub/obs-organization-2026-10-03`.
  These files can contain private source settings; do not publish them.

To roll back, stop the Hub, snapshot current settings, and select the named
rollback OBS collection while outputs are stopped. Restore code from the tagged
commit in a separate checkout or deliberately restore the needed files, then
restart this checkout's `hub.py`. Preserve current master/per-asset volumes and
personal settings rather than resetting them to an older value. Recording and
root `.env` replay storage must both remain `C:/StreamingMedia/Replays`.
The original code can also operate the old scene-based lobby collection.

## Installed structure

The scene list is reduced from **56 to 32**, with the main destinations first.
Existing names remain valid in configuration and automation.

| Area | Structure and reason |
| --- | --- |
| Main destinations | `Test` (gameplay), `Lobbies`, `Starting Soon`, `InstantReplay`, `League Champion Select World`, `just screen`, `afk` |
| Lobby locations | Twelve groups inside `Lobbies`: Forge, Sanctuary, Sky Harbor, Storm Coast, Phoenix Observatory, Tavern, Future, Reef, Spirit Rail, Arcade, Aurora Camp and Spirit Afterparty. Each retains its painting, live camera/screen, chat, motion, filters and original child IDs. |
| League HUD | `ScreenCaptureMAPHUD` remains the reusable parent scene. `LeagueHUD`, `LeagueHUD2`, `LeagueHUD3`, `LeagueHUD4` and `leagueMAP` are independently filtered groups, with the same parent transforms and per-item crops. |
| Udyr presentation | `LeagueHudUdyrAnimation` is a group in gameplay. The feature still controls its visibility through the original name. |
| Shared resources | Camera, desktop gate/panel, Spotify, recording audio, media playback and gameplay asset scenes remain reusable nested scenes. This preserves shared controls, existing groups and source workers. |
| Champion-select wrappers | The three `LeagueChampSelect` variants and `league client` retain their independent 3D filters. Their parents already contain groups; adding nested groups would violate OBS's supported grouping structure. |
| Cards | Welcome, Intermission, Signoff and the three Court destinations remain selectable production scenes. |
| QA | Six unreferenced `Hub Spirit QA ...` scenes and their exclusive color inputs are archived in the rollback collection. No personal scene is matched by a broad “test” name search. |

New groups start collapsed. Their 1920×1080 canvas is stabilized by retained
full-canvas painting/audio links, so moving a wrapper into a group does not
rescale its masks or reposition its children.

## Capture efficiency

All four portrait crops and the minimap now reference the existing
`teammatehud2` monitor input. Per-item cropping does not require another capture
input, and filters live on the individual groups. The two retired monitor inputs
retain their exact settings and filters in the disabled **Retired HUD captures**
group inside `ScreenCaptureMAPHUD`; both report inactive and not showing.
The separate full-desktop input remains behind the existing visibility gate.
No extra monitor, capture worker or runtime polling service was added.

This reduces independently active HUD capture sources from three to one. It is
not a measured CPU/GPU percentage guarantee: scene references, compositing,
filters, browsers and media decoding still have their own costs. The inactive
legacy sources remain recoverable rather than losing personalized source data.

## Code and maintenance

`obs/containers.py` enumerates scenes and groups through the shared transport.
Lobby layout inspection, accepted repairs and calibration consume that contract.
`SceneDirector` resolves a saved direct lobby location choice to `Lobbies` and
selects its group only after accepting ownership/revision guards. Stale and
deferred requests cannot change group visibility. HTTP remains a public feature
adapter, and `SceneDirector` remains the only program-scene writer.

OBS WebSocket cannot insert children into groups. Layout repairs reject missing
group layers before mutation; structural additions require a finite offline
collection edit. Existing motion/Afterparty installers support complete grouped
reruns and avoid recreating a scene with a group's name.

## Verification

- Full offline suite: **992 tests passed**; architecture: **402 modules, zero
  violations**.
- All twelve lobbies selected through the running Hub and reported ready.
  A saved direct `ForgeLobby` scene choice correctly selected its parent/group.
- Ninety-two migrated child items checked for editable placement, crop,
  visibility, locks and blend mode. Source settings and source/container filters
  matched the baseline; only expected capture references changed.
- HUD screenshots were black both before and after maintenance, so actual
  gameplay pixels could not be verified in this session. Saved geometry and
  independent masks were verified; check the HUD visually when League is running.
- Supported Hub restarted, UI returned HTTP 200, all fourteen configured modules
  became ready, and exactly one Hub keyboard child remained.
- Recording path and `.env` replay path remain synchronized. Soundboard keeps
  its `default` profile and `@` / `hooray` binding.
- Workflow proofs for changed OBS/coordination/lobby/client owners were reviewed
  and refreshed. The workflow checker still reports eleven earlier unreviewed
  owner scopes in Hub/browser/chat-related areas; it reports no outstanding new
  AST proof failure from this migration.

The earlier border-duration regression expected 0.8 seconds despite the existing
documented two-to-five-second presentation contract. Its test now checks the
two-second floor and separately verifies that the saved 0.8-second override is
preserved. No border-duration behavior or personal preference was changed.

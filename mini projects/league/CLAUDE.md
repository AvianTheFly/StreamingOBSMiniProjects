# league — CLAUDE.md

## What this project does

Monitors a live League of Legends game via the Riot Live Client Data API and
reacts by showing/hiding OBS overlays in the `LeagueGameAssets` scene.
Tracks kills, deaths, multikills, level-ups, map events (dragon, baron, herald),
and manages an instant-replay kill log for `instant_replay` to query.

## Scene ownership

**Owns:** `LeagueGameAssets` only.

This project does NOT own `Sound Effects`, `Test`, `Lobbies`, or any other scene.
- To trigger a sound effect: emit `hub_events.emit("sfx.play", source="<stem>")`.
- To switch scenes on game start/end: emit `hub_events.emit("game.connected")` /
  `hub_events.emit("game.disconnected")`. `scene_voice_switcher` handles the switch.

## Key files

| File | Role |
|---|---|
| `main.py` | Hub entry point — starts `LeagueAPIWatcher`, arms `B` recall key |
| `core/league_api.py` | `LeagueAPIWatcher` — polls the Riot API, fires event callbacks |
| `core/game_state_detector.py` | Detects game connected/disconnected from API responses |
| `core/league_events.py` | Event name constants used across the project |
| `handlers/lifecycle.py` | Game start/end handlers — emits `game.connected` / `game.disconnected` |
| `handlers/player_events.py` | Death, respawn, recall, level-up, respawn SFX handlers |
| `handlers/kill_events.py` | Champion kill, assist, kill streak triangle logic |
| `handlers/map_events.py` | Dragon, baron, herald, turret, inhibitor, ace handlers |
| `handlers/champion_kill_handler.py` | Kill + assist tracking for instant_replay |
| `config.py` | All tunable values — overlay sources, durations, enabled flags |
| `interface.py` | `ProjectInterface` — `revert()` hides all overlays |

## How it runs

1. `main.py` creates `LeagueAPIWatcher` and calls `watcher.run()` in a daemon thread.
2. The watcher polls `LEAGUE_API_URL` every `POLL_INTERVAL` seconds.
3. When a game is detected, event callbacks are registered; handlers are called.
4. All overlays use `obs.show_source()` / `obs.hide_source()` on `LeagueGameAssets`.
5. On game end, `hub_events.emit("game.disconnected")` is emitted and all overlays
   are hidden.

## Enabling/disabling overlays

Every overlay event has an `ENABLED` flag in `config.py`.
Set `ENABLED = False` to completely skip that handler — no OBS call is made.
Change `SOURCE` / `SCENE` to remap to a different OBS source without code changes.

## Recall detection hotkey

Press `B` while in-game to arm the recall detector. The watcher will watch for
your mana to drop (indicating a recall started), then show the respawn border if
the recall completes.

## Cross-project coordination

- **Respawn SFX:** `handlers/player_events.py` emits `sfx.play` → `sound_effects`
  handles playback. Do NOT call `obs.show_source` on the Sound Effects scene here.
- **Scene switches:** `handlers/lifecycle.py` emits `game.connected` /
  `game.disconnected` → `scene_voice_switcher` handles the actual `obs.switch_scene`.
- **Kill tracking:** `handlers/champion_kill_handler.py` writes kill timestamps
  accessible via `interface._live["watcher"].kill_tracker` for `instant_replay`.

## Adding a new overlay event

1. Add config constants (`SCENE`, `SOURCE`, `DURATION`, `ENABLED`) in `config.py`.
2. Create a handler function in the appropriate `handlers/*.py` file.
3. Register it in `core/league_api.py` where other handlers are registered.
4. The handler should call `obs.show_source()` / `obs.hide_source()` only on
   `LeagueGameAssets` sources.

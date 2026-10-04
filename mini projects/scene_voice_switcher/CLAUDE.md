# scene_voice_switcher — CLAUDE.md

## What this project does

Voice-controlled lobby/game scene switcher. Pressing `` ` `` (backtick) opens the mic;
saying a lobby name switches to that lobby background. Saying "game" or "test"
switches to the game scene. Also auto-switches when a League game starts/ends
by subscribing to the `game.connected` / `game.disconnected` hub events.

## Scene ownership

**Owns:** `Lobbies`, `Test`

`SceneDirector` is the sole OBS program-scene writer. This feature requests game
and lobby destinations; League's client watcher requests its own phase routes
through the same owner and shared lobby catalog. Features never import peers.

## Key files

| File | Role |
|---|---|
| `main.py` | Hub entry point — lobby discovery, PTT, command dispatch, event subscriptions |
| `config.py` | `GAME_SCENE`, `LOBBIES_SCENE`, `PTT_KEY`, `SOURCE_ALIASES` |
| `routing.py` | Accepted scene transactions, lobby selection and held returns |
| `inventory.py` | Real lobby groups/nested scenes and aliases |
| `api.py` | Public location inventory and manual selection |
| `interface.py` | `ProjectInterface` — `revert()` hides the active lobby source |

## Lobby discovery

At startup, this project queries OBS for sources ending in `Lobby` in `Lobbies`.
Each source name is split into voice aliases automatically:
- `"FutureLobby"` → aliases `["future lobby", "future", "futurelobby"]`
- Extra aliases can be added in `config.py → SOURCE_ALIASES`

New lobby backgrounds added to OBS appear automatically on next hub restart.
No code or config change needed. Say "refresh lobbies" to republish the complete
inventory without restarting. "Next lobby" chooses another available location.

## Hotkey flow

```
Press `  (backtick)
    ├─ If recording  →  stop + send immediately
    └─ Open mic (VoicePTT, auto-sends after 2 s)
         ├─ Say a lobby name  →  switch to Lobbies scene, show that source
         └─ Say "game" / "test"  →  switch to game/test scene
```

Press `C` to send early.

## Hub event subscriptions

Inside `run()`:
```python
hub_events.subscribe("game.connected",    _on_game_connected)
hub_events.subscribe("game.disconnected", _on_game_disconnected)
```

- `game.connected` → request `GAME_SCENE`, respecting temporary ownership.
- `game.disconnected` → fallback lobby return after the shared result hold, only
  when League client automation is disabled. League otherwise owns idle returns.

Events capture the director's manual revision. Delayed returns survive owned
temporary presentation/return, but cannot undo a newer deliberate or external
choice. Automatic lobby entry hides the shared desktop; manual lobby selection
preserves its visibility. Hotkey sequences `*-` / `-*` are Hub-owned and toggle
only the actual input inside `Hub Display Capture`; Test retains direct capture.

Both are unsubscribed in the `finally` block on shutdown.

## Matching algorithm

Voice text is normalized (lowercase, strip punctuation), then matched against
all source aliases using substring checks + `SequenceMatcher` similarity.
Similarity thresholds: 0.82 (normalized) / 0.86 (compact).

`SOURCE_ALIASES` in `config.py` maps OBS source names to extra voice aliases:
```python
SOURCE_ALIASES = {
    "FutureLobby": ["futuristic", "cyber"],
}
```

## `_live` dict

`main.py` populates:
- `_live["active_source"]` — `list[str | None]`, currently-shown lobby source
- `_live["hide_active"]` — callable to hide the active source (used by `revert()`)

# scene_voice_switcher — CLAUDE.md

## What this project does

Voice-controlled lobby/game scene switcher. Pressing `` ` `` (backtick) opens the mic;
saying a lobby name switches to that lobby background. Saying "game" or "test"
switches to the game scene. Also auto-switches when a League game starts/ends
by subscribing to the `game.connected` / `game.disconnected` hub events.

## Scene ownership

**Owns:** `Lobbies`, `Test`

This is the ONLY project that may call `obs.switch_scene("Test")` or
`obs.switch_scene("Lobbies")`. The `league` project does NOT switch scenes
directly — it emits events and this project acts on them.

## Key files

| File | Role |
|---|---|
| `main.py` | Hub entry point — lobby discovery, PTT, command dispatch, event subscriptions |
| `config.py` | `GAME_SCENE`, `LOBBIES_SCENE`, `PTT_KEY`, `SOURCE_ALIASES` |
| `interface.py` | `ProjectInterface` — `revert()` hides the active lobby source |

## Lobby discovery

At startup, this project queries OBS for all sources/groups in the `Lobbies` scene.
Each source name is split into voice aliases automatically:
- `"FutureLobby"` → aliases `["future lobby", "future", "lobby", "futurelobby"]`
- Extra aliases can be added in `config.py → SOURCE_ALIASES`

New lobby backgrounds added to OBS appear automatically on next hub restart.
No code or config change needed — just add the source in OBS and restart.

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

- `game.connected` → hide lobby sources, switch to `GAME_SCENE`
- `game.disconnected` → switch to `LOBBIES_SCENE`

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

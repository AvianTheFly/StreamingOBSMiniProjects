# love_me — CLAUDE.md

## What this project does

Sequential media player triggered by `9 → 8 → 7`. Each trigger plays the next
item in a configured list. Wraps around and resets to item 1 after inactivity
or when the last item finishes. Designed for sequential "reaction" media moments.

## Scene ownership

**Owns:** `LoveMe`

All OBS source interactions (show/hide, restart media) stay within the `LoveMe` scene.

## Key files

| File | Role |
|---|---|
| `main.py` | Hub entry point — keyboard listener, trigger logic, idle reset |
| `player.py` | `SequentialPlayer` — manages index, plays items, abort/advance |
| `trigger.py` | `SequenceTrigger` for `987` sequence |
| `config.py` | `ITEMS` list (the media sequence), trigger sequence, idle reset timing |
| `interface.py` | `ProjectInterface` — `revert()` aborts playback and hides sources |

## Items configuration

Define the sequence in `config.py → ITEMS`:
```python
ITEMS = [
    {"source": "LoveMeSource1", "scene": "LoveMe"},
    {"source": "LoveMeSource2", "scene": "LoveMe"},
]
```
Each item must have `source` (OBS source name) and `scene` (must be `"LoveMe"`).

## Trigger logic

```
Type 9 → 8 → 7  (within TRIGGER_MAX_INTERVAL ms)
    ├─ If last item is currently playing  →  toggle off (stop + reset)
    ├─ If IDLE_RESET_SECONDS have passed since last trigger  →  reset to item 1, then play item 1
    └─ Otherwise  →  play next item in sequence
```

After the last item finishes naturally, the sequence resets to item 1.
`IDLE_RESET_SECONDS` (default 15 s) controls the inactivity reset.

## Cross-project coordination

When a trigger fires, this project calls:
```python
project_registry.pause_all(except_="love_me")
```
This asks all other registered projects to pause (e.g., suspends a song in
`specific_song`). When the item finishes:
```python
project_registry.resume_all(except_="love_me")
```
Do NOT use `music_service.pause()` directly — that only reaches specific_song.
`project_registry.pause_all()` covers any project that implements `pause()`.

## `_live` dict

`main.py` populates:
- `_live["player"]` — `SequentialPlayer` instance

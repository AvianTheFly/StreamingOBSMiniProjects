# sound_effects — CLAUDE.md

## What this project does

Plays short sound effects on demand via hotkey (`989`) or voice, and also via
the `sfx.play` hub event from other projects (e.g. league's Halo Respawn sound).
All sound effect files live in a single assets folder; OBS sources are auto-synced.

## Scene ownership

**Owns:** `Sound Effects`

This is the ONLY project that may touch the `Sound Effects` scene.
Other projects request SFX via the hub event bus, not by touching this scene directly.

## Key files

| File | Role |
|---|---|
| `main.py` | Hub entry point — keyboard listener, hub event subscriber, OBS sync, playback |
| `config.py` | Assets dir, scene name, trigger sequences, manual hotkeys |
| `mishears.json` | Optional: maps Whisper mishearings to canonical SFX names |
| `interface.py` | `ProjectInterface` — `revert()` hides all visible SFX sources |

## Hub event: `sfx.play`

Any project can request an SFX without knowing about this project:
```python
import events as hub_events
hub_events.emit("sfx.play", source="halo respawn sound effect")
```
The `source` value must be the **lowercase file stem** (filename without extension).
`sound_effects/main.py` subscribes to this event and plays the file in a daemon thread.

This is the correct way to request SFX from outside this project. Never call
`obs.show_source()` / `obs.restart_media()` on the `Sound Effects` scene from
another project.

## Hotkey flow

```
Type 9 → 8 → 9  (within 150 ms)
    ├─ If already recording (VoicePTT active)  →  send immediately
    └─ Open MANUAL_TRIGGER_WINDOW (1 s):
         ├─ Press !, @, #, $…  →  play configured SFX instantly
         └─ Wait 1 s  →  open mic (VoicePTT)
              └─ Say SFX name  (auto-sends after 2 s)
                   └─ Matched against file stems + mishears.json
```

Trigger sequences: `989` (primary) and `(*(` (shift variant). Both fire the same action.

## Manual direct-play hotkeys

After `989`, pressing a key within `MANUAL_TRIGGER_WINDOW` (1 s) plays instantly.
Configured in `config.py → MANUAL_TRIGGER_SFXS`:
```python
MANUAL_TRIGGER_SFXS = {
    "!": "hooray",      # 989!
    "#": "mom frog",    # 989#
    "$": "oh no",       # 989$
    "%": "",            # unassigned
}
```
Set a value to `""` to leave the key unassigned.

## Adding sound effects

Drop audio/video files into `SOUND_EFFECTS_DIR` (see `config.py`).
The hub creates / updates OBS sources at startup via `_sync_sources_to_files()`.
No manual OBS config needed.

## Mishear corrections

If Whisper consistently mishears an SFX name, add a correction to `mishears.json`:
```json
{
    "hooray": ["who ray", "who re", "hurray"]
}
```
The canonical name (key) must match a file stem in `SOUND_EFFECTS_DIR`.

## Crash safety

`_visible_sources` tracks all currently-visible OBS sources.
An `atexit` handler calls `_hide_all_sfx()` to ensure nothing is left visible
if the hub crashes or is force-quit.

## `_live` dict

`main.py` populates:
- `_live["visible_sources"]` — `set[str]` of currently-visible source names
- `_live["hide_all"]` — callable to hide all visible sources (used by `revert()`)

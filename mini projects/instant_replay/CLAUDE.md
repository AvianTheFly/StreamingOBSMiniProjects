# instant_replay — CLAUDE.md

## What this project does

League of Legends clip manager. Triggered by the `|` (pipe) key.
Saves the OBS replay buffer, trims it with ffmpeg around a kill/death anchor,
and plays clips back through the `InstantReplay` OBS scene.
Also integrates with the League API watcher to automatically track kill timestamps.

## Directory layout

```
F:\...\Assets\Replays\           ← REPLAY_DIR: OBS raw buffers + trimmed clips
                                    Wiped clean on every hub startup.
F:\...\Assets\Replays\edited\    ← EDITED_DIR: compiled highlight reels (permanent)
                                    Named "Game N YYYY-MM-DD_reel.mkv".
                                    Never touched by the startup wipe.
```

Raw clips are transient — they live in REPLAY_DIR only until the game ends (or 60 s
after startup), at which point cleanup merges them into EDITED_DIR and deletes the raws.

## Scene ownership

**Owns:** `InstantReplay`

Playback happens in the `InstantReplay` scene. Desktop Audio is **muted** (not ducked)
during replay so the viewer hears only the clip audio. Returns to `RETURN_SCENE`
when replay ends.

## Key files

| File | Role |
|---|---|
| `main.py` | Hub entry point — keyboard listener, voice commands, save/play/mark logic |
| `config.py` | OBS scene/source names, clip timing, REPLAY_DIR, EDITED_DIR, hotkey |
| `cleanup.py` | Overlap resolution, merging, startup wipe, persistent game numbering |
| `interface.py` | `ProjectInterface` — `revert()` cancels replay and hides sources |

## Hotkey flow

```
Press |  (pipe)
    ├─ If a single-clip replay is playing  →  cancel immediately
    ├─ If a multi-clip replay is playing
    │    ├─ First press   →  skip to next clip
    │    └─ Second press  →  cancel all remaining clips
    └─ If idle  →  open mic (VoicePTT)
         ├─ Press | again or 'C'  →  send immediately
         └─ Auto-sends after RECORD_TIMEOUT_SECONDS (2 s)
              └─ Transcription → command dispatch
```

## Voice commands

**Save commands** (press `|` first):
- `"save"` — save & trim around kill/death anchor
- `"save win"` / `"save fail"` / `"save escape"` — save with tag
- `"save 30"` / `"save thirty"` — save exactly N seconds from buffer end
- `"save full"` — save entire replay buffer untrimmed
- `"mark"` — plant a manual clip start-point right now

**Play commands** (press `|` first):

| Command | What plays |
|---|---|
| `"play"` / `"play last"` | Most recent saved clip |
| `"play all"` / `"play highlights"` | All clips from current game in order |
| `"play game 3"` | Compiled reel for Game 3 from `edited/` |
| `"play game last"` | Most recently compiled reel from `edited/` |
| `"play win"` | Most recent win-tagged clip |
| `"play win 2"` | 2nd win-tagged clip |

**Play-after-save:** Say `"play"` within `PLAY_AFTER_SAVE_WINDOW` seconds of a save
and it auto-fires once the trim finishes — no need to wait.

## Clip trimming logic (save without a manual mark)

Priority (highest first):
1. `"save full"` → entire buffer
2. `"save 30"` → explicit seconds from end
3. Manual mark → time since mark was set
4. Kill anchor → first kill in streak − KILL_PRE_ROLL_SECONDS
5. Death anchor → last death − DEATH_PRE_ROLL_SECONDS
6. No anchor → entire buffer

## Audio muting

Desktop Audio is **fully muted** via OBS mute (not volume) while replay plays.
Unmuted on: natural end, cancel, `atexit`, `SIGINT`/`SIGTERM`.
`_unmute_desktop()` is idempotent — safe to call even if already unmuted.

## Cleanup / merging workflow

### On startup
`wipe_raw_clips_on_startup()` deletes all files in REPLAY_DIR root (skips `edited/`).
Any leftover clips from a previous session are gone — only compiled reels survive.
A deferred thread then runs 60 s later to catch any clips that survived the wipe
(unlikely, but handles edge cases).

### On game end (30 s delay)
`run_for_game(label)` is called with a persistent label like `"Game 4 2026-04-11"`.
- Resolves overlaps between consecutive clips (trims start of later clip to boundary)
- Merges all clips into `edited/Game 4 2026-04-11_reel.mkv`
- Singletons (one clip) are also moved to `edited/` — nothing left behind
- Deletes `*_ir_trimmed.mkv` source clips from REPLAY_DIR
- Deletes original raw OBS `.mkv`/`.mp4` files from REPLAY_DIR

### Overlap stitching
Clip end time = OBS filename timestamp. Clip start = end − ffprobe duration.
If clip[N].start < clip[N-1].end by more than 1.5 s, the overlap is trimmed from
clip[N]'s start so the two join seamlessly at the exact boundary.
Clips entirely inside a prior clip are dropped entirely.

## Game numbering

Persistent counter stored at `~/.claude/ir_game_counter.json`.
Each game end increments it. "Game 3" is always "Game 3" across hub restarts.
Next game after that is always "Game 4", etc.

## Post-game "play" fallback chain

1. Live clips in `_clip_registry` (current game, in-progress)
2. `_previous_game_clips` (game just ended, registry cleared but clips in memory)
3. Most recent compiled reel in `edited/` (older games)

## Save tags (voice alias matching)

`"save win"` → tag `win`, `"save fail"` → tag `fail`, etc.
Fuzzy matching catches Whisper mishearings. Config: `config.py → SAVE_TAG_ALIASES`.

## Kill/death tracking

`KillTracker` polls the League Live Client Data API in a background thread.
`first_kill_wall_time` = wall-clock start of current kill streak (resets after 20 s gap).
`last_death_wall_time` = most recent death wall-clock time.

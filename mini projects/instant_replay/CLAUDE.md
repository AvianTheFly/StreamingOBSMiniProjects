# instant_replay — CLAUDE.md

## What this project does

League of Legends clip manager. Triggered by the `|` (pipe) key.
Saves the OBS replay buffer, trims it with ffmpeg around a kill/death anchor,
and plays clips back through the `InstantReplay` OBS scene.
Also integrates with the League API watcher to automatically track kill timestamps.

## Directory layout

```
C:\StreamingMedia\Replays\         ← REPLAY_DIR: original buffers and new cuts
C:\StreamingMedia\Replays\clips\   ← Individual cuts, grouped by game
C:\StreamingMedia\Replays\edited\  ← Existing compiled reels, retained for playback
```

Original recordings are retained. Game-end and deferred startup cleanup archive
individual cuts without making new reels or deleting raw recordings. Keep the
root environment and OBS recording paths synchronized; see `RECORDING-STORAGE.md`
before changing storage. Personal library metadata and compilations are user data.

## Scene ownership

**Owns:** `InstantReplay`

Playback happens in the `InstantReplay` scene. Desktop Audio is **muted** (not ducked)
during replay so the viewer hears only the clip audio. Temporary scene ownership
returns to the previous scene when replay ends, unless the user or another
controller has already chosen a different scene.

`presentation.py` owns mode selection, readable titles and exact 16:9 viewports.
`stage.py` publishes stage snapshots and progress from the existing playback
loop. `obs_stage.py` installs `ReplayStudioBackdrop` (native static artwork) and
`ReplayStudioMotion` (transparent 30 fps browser labels, progress, loading cover
and subtle motion). The browser shuts down when the scene is unused. Native
recorded labels remain visible if its HTTP connection fails. Twelve `*-v3.png`
images under `art/` are rendered from `hub_ui/app/replay-stage.html` by
`tools/build_replay_stage_art.cjs`. Original art and old OBS inputs are retained.
This checkout's generated `art/` directory is a junction to
`C:/StreamingMedia/HubReviewArtifacts/replay-stage-art` to free space on F:;
the original asset paths and all 26 file hashes were preserved. Replay media
storage remains `C:/StreamingMedia/Replays`.
The short headings are Replay, Clips and Highlights. Personal titles take
priority; unnamed captures use their recorded date/time. Game IDs, tags, clip
counts and the next actual title supply context without canned captions.
Every presentation keeps a visible recorded label. Quick Replay defaults
to a labeled live companion using a scene-item reference to Test's actual capture
input, with a 320 ms Move both in and out. A 320 ms Luma Wipe, 220 ms Fade and
Cut are also available. Explicit quick replay commands select this mode even
before the game client connects. Showcase defaults to a clip with face
cam and the current OBS scene transition (including installed spirit transitions).
Both modes can independently show the screen and face cam, or expand the clip
when both are off. The camera references the existing FaceCamWithProps scene;
its props, crops, filters, mirrored transforms and capture windows stay intact.
An unavailable camera gets an offline indicator, sampled on the playback loop.
Each mode's screen, camera, scene transition and between-clip transition, plus
motion, are saved in `presentation_settings.json`.
The optional gated desktop references `Hub Display Capture` and respects its
central visibility control. No input, capture filters, global transition, master
volume or Test placement is changed. SceneDirector owns every scene switch and
temporarily scopes the selected transition to entry/owned return, restoring scene
overrides immediately. Do not enable the old logo or duplicate physical inputs.
The replay startup worker prepares the hidden decoder while gameplay stays on
program, waits for the paused seek to settle, shows that first frame during entry, then waits for the chosen transition before
resuming the clip. Every later clip also decodes while hidden and is paused
before being shown, keeping its opening audio behind the handoff until the
reveal finishes. Cancellation or a newer scene choice rejects the handoff.

## Capture intent and review pool

`quick replay` / `replay that` captures and replays the last 15 seconds locally.
`quick replay 30` changes the duration (3–120 seconds). The Hub offers 5, 10, 15,
30 and 60 seconds. These cuts use stream copy with all audio tracks; their start
can include a preceding keyframe. They do not request Twitch clips or consume
a pending manual mark. The original OBS buffer remains intact.

`save`, `save win`, and `save and replay` retain the serious capture path:
anchor-aware encoding, a Twitch clip request, and highlight-candidate status.
All voice capture paths retain the original keypress timestamp for the end cutoff,
including Save & replay; transcription time is excluded. Runtime controls are
published after setup and withdrawn together on shutdown by their own generation.
Older clips retain their eligibility. No existing clip is silently reclassified.

Library metadata `purpose` is `highlight` or `replay_only`. A replay-only cut and
its raw OBS copy are classified together; the cut links `capture_source` so the
library can hide its duplicate. Offline management uses the same inventory
as runtime playback; a missing cut makes its retained original visible again
without changing capture intent. Replay-only cuts live in `REPLAY_DIR/replay-only`
and stay out of game-end archiving, automatic highlights, showcase latest,
shuffle, other presentations' default catalogs and Footage Desk's review pool.
Explicit playback and compilations can still include a deliberately chosen cut.
Trims inherit their source's purpose. The library's purpose control and bulk
Keep for highlights / Replay only actions are reversible and revision checked;
they preserve titles, notes, favorites, volumes and unknown metadata. Promotion
adds the chosen cut to future review without sending a retroactive Twitch clip.
During playback, **Keep this clip** promotes the displayed replay-only cut;
it retains that target even if playback advances during the library read.

`lib/media_review.py` reads the portable `{clips: {id: {path, purpose}}}` catalog
without feature imports. `footage_manager/review_pool.py` composes it with scan,
library, CSV and analysis candidates. Already indexed replay-only items are
filtered, with their existing personal decisions still retained in the database.
Capture snapshots provide saving, ready and error feedback; a failed capture
never falls back to an older clip. Stop cancels its pending replay continuation.

The Hub has off-stream previews, per-mode controls, Save & replay, game highlights,
shuffle, next, pause and Return to live. Save & replay uses the exact successful
capture result; a failed save never plays an older clip. Stop, shutdown or a newer
manual scene choice cancels the bounded save continuation. The playback owner
keeps its final decoded frame through scene return, then parks the physical source.

Between clips, `stage.py` waits for the current browser revision's opaque-cover
acknowledgment before swapping the physical source. ReplayStudioCover provides
a native matte if the browser is missing or slow. The decoder holds its first
frame at zero through the reveal and starts after the reveal acknowledgment.
Both waits are bounded and reject cancelled or revoked scene ownership.
`replay-stage/clip-transition.js` renders the finite sweep/iris/fade/cut effect
only over the recorded viewport; live screen and camera stay visible.
The Hub's Preview transition buttons animate its off-stream iframes only.

On 2026-10-02 the existing Display Capture's stale monitor reference was repaired
and its method changed to Windows Graphics Capture for the same primary monitor.
This restored the live side view while preserving capture filters and placements;
the maintenance record is `output/replay-studio-v2/capture-reference-repair.json`.

## Key files

| File | Role |
|---|---|
| `main.py` | Hub entry point — keyboard listener, voice commands, save/play/mark logic |
| `config.py` | OBS scene/source names, clip timing, REPLAY_DIR, EDITED_DIR, hotkey |
| `cleanup.py` | Individual-cut archival and persistent game numbering |
| `trimming.py` | Bounded conversion, button-press cutoff and original retention |
| `library.py` | Personal labels, compilations, volumes and archive references |
| `commands.py` | Shared voice command and tag parsing |
| `stage.py` | Context label, OBS stage layout and optional desktop companion |
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

Press `|`, then speak one of these short commands:

| Command | Result |
|---|---|
| `mark` | Set the start of the next capture |
| `save` / `save 30` / `save full` | Save the game moment, N seconds, or the whole buffer; `save win` adds a tag |
| `quick replay` / `replay that` | Capture a local replay-only moment and play it |
| `quick replay 30` | Replay the last 30 seconds without a Twitch clip |
| `replay` | Force the latest clip to show as an instant replay |
| `save and replay` | Capture this moment, then replay its successful finished cut |
| `showcase` | Show the latest saved clip in the cinema layout |
| `live view` | Use the actual gameplay capture for the companion |
| `play` | Play the latest clip with an automatic fresh/archive label |
| `play [tag, game N, title, or intro name]` | Select a saved clip or collection |
| `random` | Shuffle saved clips until stopped |
| `screen on` / `screen off` | Prepare the small live desktop companion before playback |

During playback, use the Hub's **Show desktop** button to toggle the companion.
Press `|` to skip within a sequence or stop a single clip; the Hub's **Stop**
button ends the whole sequence.

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
Its previous mute state is restored on natural end, cancel and shutdown.
`_unmute_desktop()` is idempotent — safe to call even if already unmuted.

## Archive workflow

### On startup
A deferred thread waits 60 seconds, then archives leftover saved cuts. It stops
if the Hub shuts down. There is no startup wipe of recordings.

### On game end (30 s delay)
`run_for_game(label)` archives individual cuts under `clips/<game label>/` and
updates their library references, labels and game association. Existing
compilations continue to work. Original raw recordings and existing reels remain.

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

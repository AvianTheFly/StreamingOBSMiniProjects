# OBS Hub — Project Overview for Interview

---

## What It Is

A Python backend that runs concurrently with OBS to automate live-stream
behaviors in real time. The system listens for keyboard hotkeys, voice commands,
and game API events, then drives OBS through its WebSocket API to show overlays,
play media, trigger sound effects, switch scenes, and more — without any manual
clicking during a stream.

The key design constraint: **all of this happens while streaming live**. Every
decision about threading, state, crash safety, and cross-module coordination
exists because the system must remain reliable and non-blocking under real-time
conditions.

---

## High-Level Architecture

```
main.py  (Hub)
│
├── Auto-discovers mini-projects by filesystem convention
├── Launches each project in its own daemon thread
├── Starts shared infrastructure (OBS connection, voice listener)
│
├── obs/             ← OBS WebSocket abstraction layer (singleton)
├── voice/           ← Shared Whisper STT listener
├── events.py        ← Lightweight in-process pub/sub bus
└── shared.py        ← Shared primitives: SequenceTrigger, VoicePTT,
                        ProjectInterface, ProjectRegistry, music_service

mini projects/
├── tik_tok/         ← Media clips, voice-triggered, uses shared_media
├── sound_effects/   ← SFX playback, hub event subscriber
├── specific_song/   ← On-demand music player, fuzzy voice matching
├── league/          ← Riot API integration, game overlays
├── love_me/         ← Sequential media player with pause/resume
├── scene_voice_switcher/   ← Reacts to game.connected / game.disconnected
├── instant_replay/  ← Kill-log integration with league
└── shared_media/    ← Reusable framework for media-type mini-projects
```

---

## Project Discovery: Convention Over Configuration

The hub's `_discover_projects()` scans for folders that satisfy a simple
contract:

1. Has an `__init__.py` (it's a Python package)
2. Has a `main.py` with a callable `run(input_queue, stop_event)` function
3. Is not in the explicit skip list (`obs`, `voice`, `tools`, etc.)

If a folder meets those criteria, it's launched automatically. No registration
file. No config entry. Drop a folder in, and the hub picks it up on next start.

Each project gets its own `queue.Queue` and runs in a dedicated daemon thread.
The hub also imports each project's `interface.py` (if it exists) to trigger
auto-registration with the `ProjectRegistry` before any threads start.

**Why this matters**: Adding a new feature to the stream means creating one
folder. The hub handles the rest.

---

## Cross-Project Communication: The Event Bus

`events.py` is a zero-dependency, thread-safe pub/sub bus (~40 lines).

```python
# Any project can emit without knowing who's listening:
events.emit("sfx.play", source="halo respawn sound effect")

# Any project can subscribe without knowing who emits:
events.subscribe("game.connected", _on_game_connected)
```

This decouples projects entirely. `league` doesn't import `sound_effects`.
`sound_effects` doesn't import `league`. They communicate through named events
with payload dicts.

Documented standard events include `game.connected`, `game.disconnected`, and
`sfx.play` — each with a defined emitter, consumer, and payload contract.

---

## The OBS Abstraction Layer

All OBS WebSocket calls go through `obs/`. Mini-projects never import
`obsws_python` directly.

- `obs/client.py` holds a **lazy singleton** connection. `get_obs()` creates
  it on first call and returns the cached client on all subsequent calls.
  Thread-safe via a lock. `reset_obs()` forces a reconnect.

- `obs/interaction.py` wraps every OBS operation (show/hide sources, switch
  scenes, media playback, filters, audio, transforms, replay buffer, etc.)
  into named Python functions.

- `obs/__init__.py` re-exports the public API. Mini-projects call
  `obs.show_source(scene, source)` — the underlying WebSocket protocol is
  invisible.

**Why this matters**: If the OBS WebSocket API changes, or if we swap the
underlying library, only `obs/interaction.py` changes. Every mini-project
is unaffected.

---

## Shared Infrastructure: `shared.py`

Provides cross-project utilities that would otherwise be duplicated:

### `SequenceTrigger`
Detects when a specific character sequence (e.g. `i→l→i`, `9→8→9`) is typed
within a configurable time window. Thread-safe sliding buffer. Used by every
keyboard-driven project.

### `VoicePTT`
Push-to-talk abstraction over the shared Whisper voice listener. Implements a
three-state machine (`idle → listening → processing`), auto-timeout, double-trigger
stop, lockout window to prevent accidental re-fires, and a 'C' key force-send
listener that arms/disarms dynamically. A generation counter guards against
stale Whisper callbacks clobbering new recording state.

Only one project can own the mic at a time — `start_recording()` is rejected
if another project holds it.

### `music_service`
A **service-locator facade** over `specific_song`'s `SongPlayer`. Registered
at startup; other projects call `music_service.pause()` without importing or
knowing about `specific_song`. Safe to call before registration (all methods
are no-ops until registered).

### `ProjectInterface` + `ProjectRegistry`
Described in the next section.

---

## Conflict Resolution: `ProjectInterface` and `ProjectRegistry`

Every mini-project that touches OBS implements a `ProjectInterface` subclass
in its `interface.py`. The interface declares:

- `name` — the project's canonical identifier
- `controlled_scenes` — list of OBS scenes it may touch
- `get_status()` → `ProjectStatus` snapshot
- `revert()` — stop all activity, restore OBS to clean state
- `pause()` / `resume()` — non-destructive suspension (optional, defaults to no-op)

The `ProjectRegistry` (singleton in `shared.py`) collects all registered
interfaces and exposes:

```python
# Who else is active in scenes I want to touch?
conflicts = project_registry.conflicting_projects("love_me", ["LoveMe"])

# Ask everyone to pause before I take the stage:
project_registry.pause_all(except_="love_me")
player.play_async(src, on_complete=lambda: project_registry.resume_all(except_="love_me"))

# Emergency stop:
project_registry.revert_all()
```

This gives the system **coordinated multi-project state management** without
any project needing to know about any other project's internals.

**Example**: When `love_me` triggers, it calls `pause_all()`. `specific_song`
pauses the current song at its exact playback position. When the `love_me`
media finishes, `resume_all()` brings the song back. Projects that don't
implement `pause()` are silently unaffected.

---

## The `shared_media` Framework: Reusability at the Configuration Level

`shared_media` is the system's growing generalized solution for the class of
projects that: scan an asset folder, sync those assets to OBS, and then trigger
playback via hotkey or voice.

It provides:
- `MediaProjectConfig` — a `@dataclass(slots=True)` defining all project
  parameters (asset dir, OBS scene/prefix, trigger sequences, fuzzy threshold,
  timeout values, etc.)
- `run_media_project()` — the full runtime: asset indexing, OBS sync, keyboard
  listener, VoicePTT integration, concurrent/exclusive playback modes, stop
  logic, visibility tracking, interface registration, and crash-safe cleanup.
- `media_phrase_matcher.match_phrase()` — two-stage voice matching (see below).

With this framework, `tik_tok/main.py` is **14 lines**:

```python
from shared_media.media_project import run_media_project
from .config import CONFIG

_live: dict = {}

def run(input_queue, stop_event):
    run_media_project(cfg=CONFIG, input_queue=input_queue,
                      stop_event=stop_event, live_state=_live)
```

And `tik_tok/config.py` is just a `MediaProjectConfig` data object — no logic.

`sound_effects` predates `shared_media` and hasn't been migrated yet. The
intent is that migrating it would reduce `sound_effects/main.py` to a similarly
thin wrapper, eliminating the duplicated playback, syncing, and state-tracking
logic.

---

## Voice Matching: Two-Stage Fuzzy + TF-IDF

`shared_media/media_phrase_matcher.py` solves the problem of matching noisy
Whisper transcriptions to exact asset file names.

**Stage 1 — Fuzzy matching** (rapidfuzz `WRatio`):
Matches the transcribed text against all asset stems and their configured
phrase aliases. If the top result leads the second by ≥ `semantic_gap` points,
it wins immediately.

**Stage 2 — TF-IDF disambiguation**:
When multiple candidates fall within `semantic_gap` of each other, exact fuzzy
scores don't differentiate well. TF-IDF is applied: each asset's document is its
filename tokens plus alias tokens. Words that appear across many filenames (like
"league" or "stop") get lower IDF weight. Words unique to one file (like
"welcome" or "hooray") get high weight. The query's distinctive words steer
the final pick.

Fast paths: exact stem match and exact alias match are checked before any
fuzzy scoring runs.

This same matcher is used in `tik_tok` for voice-triggered TikTok clips.

---

## League of Legends Integration

`league/` is the most complex mini-project. It polls the Riot Live Client
Data API every `POLL_INTERVAL` seconds and drives a full handler system:

- **Game state detector**: Distinguishes between "no game", "connected", and
  "disconnected" states from raw API responses. Emits `game.connected` /
  `game.disconnected` hub events on transitions.
- **Handler tree**: Separate handler modules for lifecycle, kill events, map
  events (dragon/baron/herald/turret/inhibitor), player events (death, respawn,
  recall, level-up), and multikill/ace detection.
- **Event-driven**: Handlers are registered callbacks, not if-else chains. Each
  handler is a factory function (`make_*_handler`) that closes over config and
  returns a callable. All game logic is isolated in handler modules; the API
  watcher is a pure event dispatcher.
- **Cross-project via events**: The respawn SFX handler emits `sfx.play`;
  `sound_effects` handles it. Scene switches emit `game.connected`; `scene_voice_switcher`
  handles them. League never touches the Sound Effects scene or calls
  `obs.switch_scene` directly.
- **Kill tracking**: Kill timestamps are stored in a `kill_tracker` on the
  watcher object, accessible via `interface._live["watcher"]` — used by
  `instant_replay` to group replay clips by game session.

---

## Crash Safety

Every project that shows OBS sources tracks them in a `_visible_sources` set.
An `atexit` handler calls a `hide_all` function if the process exits
unexpectedly. This prevents sources from being permanently visible on stream
after a crash.

The `ProjectRegistry.revert_all()` path and each `ProjectInterface.revert()`
serve the same purpose at the application level: a controlled teardown that
returns OBS to a known clean state on demand.

---

## Developer Experience

**CLI flags** on the hub:

```
py -3.11 main.py --only tik_tok sound_effects   # isolate two projects for dev
py -3.11 main.py --skip league                  # run everything but league
py -3.11 main.py --debug                        # enable DEBUG log level
```

**Staggered startup**: Projects are launched with a 2-second stagger between
each thread start to avoid race conditions on the shared OBS connection during
initialization.

**UTF-8 everywhere**: `PYTHONUTF8=1` is set before any imports — prevents emoji
and non-ASCII asset names from crashing on Windows (which defaults to cp1252).

---

## Design Philosophy Summary

| Principle | How It's Applied |
|---|---|
| Convention over configuration | Auto-discovery via `__init__.py` + `run()` contract |
| Loose coupling | Projects communicate via events, never direct imports |
| Single responsibility | Each project owns a defined set of OBS scenes; no overlap |
| Layered abstraction | `obs/` wraps WebSocket; `shared.py` wraps hub primitives |
| Reusability by extraction | `shared_media` is the growing generalized media framework |
| Safety by default | Crash-safe visibility tracking; coordinated revert/pause |
| Extensibility | New project = new folder; new event = one emit + one subscribe |

The overall direction of the codebase is toward making new mini-projects
thinner and thinner — pushing all shared logic into `shared_media` and
`shared.py` so that a new streaming automation is just a config object and
a few lines of wiring.

# OBS Hub — Mini-Project Architecture Reference

> **Purpose:** This document is for Claude to read before writing any new mini-project for this codebase. It describes the hub architecture, every reusable piece of infrastructure, the rules that must be followed, and a step-by-step workflow for scaffolding a new project.

---

## 1. Repository Layout

```
streaming_scripts/               ← hub root (always on sys.path)
│
├── main.py                      ← hub entry point — discovers & runs all projects
├── hub_config.py                ← shared mic / Whisper / ASR settings
├── shared.py                    ← (legacy) import lock — no longer needed
│
├── obs/                         ← OBS WebSocket package (shared infrastructure)
│   ├── __init__.py              ← re-exports everything from interaction.py
│   ├── client.py                ← get_obs() singleton
│   ├── interaction.py           ← every OBS action (source, scene, media, audio, text…)
│   └── obs_config.py            ← host / port / password
│
├── voice/                       ← Shared Whisper mic listener (shared infrastructure)
│   ├── __init__.py
│   └── listener.py              ← start(), start_recording(), stop_and_transcribe()
│
├── tools/                       ← Hub-level CLI utilities (not a mini-project)
│   └── mic_test.py
│
├── league/                      ← Mini-project example (no voice, no hotkey sequence)
├── love_me/                     ← Mini-project example (sequence hotkey, sequential player)
├── meme_songs/                  ← Mini-project example (voice + vibe matching)
└── specific_song/               ← Mini-project example (voice + exact matching)
```

---

## 2. How the Hub Works

`main.py` does three things at startup:

1. **Discovers projects** — scans every sub-folder that has both `__init__.py` AND `main.py`. Skips folders in `_SKIP = {"obs", "voice", "__pycache__", "tools"}`.
2. **Imports each project** as a proper package: `importlib.import_module("project_name.main")`. No `sys.path` injection.
3. **Starts each project** in its own daemon thread by calling `run(input_queue, stop_event)`.

After that it starts the shared `voice.listener` (Whisper). Projects access it via `sys.modules.get("voice.listener")` — they never import voice themselves.

A `threading.Event` called `stop_event` is passed to every project. When `Ctrl+C` is pressed, the hub sets it and joins all threads with a 3-second timeout.

---

## 3. The `run()` Contract

Every project's `main.py` must expose exactly this function:

```python
def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    ...
```

| Parameter | Purpose |
|---|---|
| `input_queue` | The project's private command queue. Keyboard callbacks or voice transcriptions push strings here; the main loop reads them. |
| `stop_event` | Set by the hub on shutdown. The main loop must check `stop_event.is_set()` and exit cleanly when it's set. |

A third optional parameter `done_queue` is accepted for backwards compatibility but the hub never reads from it.

---

## 4. Import Rules — Most Important Rule

**Always use package-relative imports inside a project. Never use bare names.**

```python
# ✅ Correct — always finds THIS project's file
from .config  import FOO
from .player  import MyPlayer
from .trigger import SequenceTrigger
from .utils   import helper

# ❌ Wrong — may find another project's file (race condition)
from config import FOO
from player import MyPlayer
import config
```

For files in sub-packages (e.g. `meme_songs/core/feedback.py`), use extra dots to climb up:

```python
from ..config import FOO        # up one level: core → meme_songs
from ..utils.logger import log  # up one level then into utils
```

The hub root is on `sys.path`, so imports of hub-level packages (like `obs`) are always absolute:

```python
import obs                       # ✅ always resolves to obs/ at the hub root
from obs import show_source      # ✅ same
```

---

## 5. Reusable Infrastructure

### 5a. OBS Package (`obs/`)

Import anything from `obs` directly. The `__init__.py` re-exports everything.

```python
import obs

# Source visibility
obs.show_source(scene, source)
obs.hide_source(scene, source)
obs.toggle_source(scene, source, duration=2.0)   # show, wait, hide
obs.hide_sources(scene, [source1, source2])

# Scene switching
obs.switch_scene(scene)
obs.get_current_scene()          # → str
obs.list_scenes()                # → list[str]

# Media
obs.get_media_state(source)      # → "OBS_MEDIA_STATE_PLAYING" | ...
obs.restart_media(source)
obs.wait_for_media_end(source, poll_interval=0.1, start_timeout=5.0, total_timeout=600.0)
                                 # → bool (True = ended cleanly)

# Source management
obs.create_media_source(scene, source_name, filepath, hidden=True)  # → bool
obs.delete_source(scene, source_name)                               # → bool
obs.list_sources(scene)          # → dict[name → scene_item_id]

# Stream / record
obs.start_stream(); obs.stop_stream()
obs.start_record(); obs.stop_record()
obs.get_stream_status()          # → {"active": bool, "bytes": int|None}

# Text sources
obs.set_text(source, text)

# Filters
obs.set_filter_enabled(source, filter_name, enabled)

# Transforms
obs.set_source_transform(scene, source, {"positionX": 0, "positionY": 0, ...})
obs.get_source_transform(scene, source)  # → dict

# Audio
obs.configure_input_audio(source,
    monitor_type="OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT",
    volume_db=-23.0)
obs.set_input_volume_db(source, -23.0)
obs.set_input_volume_mul(source, 0.8)
obs.set_input_audio_monitor_type(source, "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT")
obs.get_input_volume(source)     # → {"mul": float, "db": float}
```

**Monitor type constants:**
- `"OBS_MONITORING_TYPE_NONE"` — no monitoring
- `"OBS_MONITORING_TYPE_MONITOR_ONLY"` — hear it locally, not on stream
- `"OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT"` — hear it AND send to stream

**Media state constants:**
- `"OBS_MEDIA_STATE_PLAYING"`
- `"OBS_MEDIA_STATE_STOPPED"`
- `"OBS_MEDIA_STATE_ENDED"`
- `"OBS_MEDIA_STATE_NONE"`

---

### 5b. Voice / Whisper (`voice/listener.py`)

The hub starts this once. Projects grab the already-loaded module:

```python
voice_mod = sys.modules.get("voice.listener")
if voice_mod is None:
    print("[my_project] ⚠  Voice unavailable.")
```

API:

```python
voice_mod.start_recording()          # open mic, begin buffering audio
voice_mod.stop_and_transcribe(cb)    # close mic, transcribe, call cb(text: str)
                                     # cb is called from a background thread
```

Typical push-to-talk pattern — start on first hotkey press, transcribe on second:

```python
if not _recording[0]:
    _recording[0] = True
    voice_mod.start_recording()
else:
    _recording[0] = False
    voice_mod.stop_and_transcribe(lambda text: input_queue.put(text))
```

---

### 5c. Sequence Trigger (`love_me/trigger.py` and `specific_song/trigger.py`)

Both projects ship an identical `SequenceTrigger` class. If you need one, copy `trigger.py` into your project folder and import it with `from .trigger import SequenceTrigger`.

```python
trigger = SequenceTrigger(["9", "8", "7"], max_interval=0.300)

def on_press(key):
    try:
        char = key.char
    except AttributeError:
        return
    if char and trigger.register_key(char):
        _handle_trigger()          # called only when full sequence fires
```

- `register_key(char)` → returns `True` only when the full sequence completes within `max_interval` seconds.
- `trigger.reset()` → reset the sequence back to the beginning manually.

---

### 5d. `hub_config.py` (Mic / Whisper settings)

Read by `voice/listener.py` automatically. Projects don't need to read this themselves. Documented here for reference:

```python
WHISPER_MODEL    = "large-v3"
WHISPER_DEVICE   = "cuda"
WHISPER_COMPUTE  = "float16"
MIC_DEVICE       = 1             # device index from mic_test.py
MIC_SAMPLE_RATE  = 16_000
RMS_THRESHOLD    = 0.01
```

---

## 6. Common Patterns

### Pattern A — Hotkey-only project (no voice)

See: `league/`, `love_me/`

```
project/
├── __init__.py       (empty)
├── config.py
└── main.py
```

`main.py` skeleton:
```python
from __future__ import annotations
import queue, threading
from pynput import keyboard
from .config import TRIGGER_SEQUENCE, TRIGGER_MAX_INTERVAL
from .trigger import SequenceTrigger
import obs

def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    trigger = SequenceTrigger(TRIGGER_SEQUENCE, TRIGGER_MAX_INTERVAL)

    def on_press(key):
        try:
            char = key.char
        except AttributeError:
            return
        if char and trigger.register_key(char):
            _do_thing()

    def _do_thing():
        obs.show_source("MyScene", "MySource")

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print("[my_project] Armed.")

    while not stop_event.is_set():
        try:
            cmd = input_queue.get(timeout=0.5)
        except queue.Empty:
            continue
        # handle any queue messages if needed

    kb.stop()
    print("[my_project] Stopped.")
```

---

### Pattern B — Voice-triggered project

See: `meme_songs/`, `specific_song/`

```
project/
├── __init__.py       (empty)
├── config.py
├── main.py
└── (matcher.py, player.py, etc.)
```

`main.py` skeleton:
```python
from __future__ import annotations
import queue, sys, threading
from pynput import keyboard
from .config import RECORD_TIMEOUT_SECONDS
import obs

_PTT_KEY = ";"    # or use SequenceTrigger for a multi-key chord

def run(input_queue: queue.Queue, stop_event: threading.Event) -> None:
    voice_mod = sys.modules.get("voice.listener")
    if voice_mod is None:
        print("[my_project] ⚠  No voice module.")

    _recording = [False]
    _timer: list[threading.Timer | None] = [None]
    _lock = threading.Lock()

    def _send(text: str) -> None:
        if text and text.strip():
            input_queue.put(text.strip())

    def _cancel(reason: str) -> None:
        with _lock:
            if not _recording[0]: return
            _recording[0] = False
            t = _timer[0]; _timer[0] = None
        if t: t.cancel()
        if voice_mod: voice_mod.stop_and_transcribe(lambda _: None)
        print(f"[my_project] 🚫 Cancelled ({reason})")

    def _on_ptt():
        if not voice_mod: return
        with _lock:
            if not _recording[0]:
                _recording[0] = True
                t = threading.Timer(RECORD_TIMEOUT_SECONDS, lambda: _cancel("timeout"))
                _timer[0] = t
                t.start()
                voice_mod.start_recording()
                print("[my_project] 🎤 Listening…")
            else:
                _recording[0] = False
                t = _timer[0]; _timer[0] = None
                if t: t.cancel()
                voice_mod.stop_and_transcribe(_send)

    def on_press(key):
        try:
            if key.char == _PTT_KEY: _on_ptt()
        except AttributeError:
            pass

    kb = keyboard.Listener(on_press=on_press)
    kb.start()
    print(f"[my_project] ⌨️  Hotkey '{_PTT_KEY}' armed.")

    while not stop_event.is_set():
        try:
            raw = input_queue.get(timeout=0.5)
        except queue.Empty:
            continue
        if not isinstance(raw, str) or not raw.strip(): continue
        # → match, play, act on raw text here

    kb.stop()
    _cancel("shutdown")
    print("[my_project] Stopped.")
```

---

## 7. Step-by-Step: Creating a New Mini-Project

1. **Create the folder** inside the hub root: `hub_root/my_project/`

2. **Add `__init__.py`** — empty file, required for the hub to discover the project:
   ```
   my_project/__init__.py   (empty)
   ```

3. **Add `config.py`** — all magic numbers and settings in one place. Use `Path(__file__).resolve().parent` for any paths relative to the project folder.

4. **Add `main.py`** — implement `run(input_queue, stop_event)`. Follow Pattern A or B above. Use only package-relative imports (`from .config import ...`).

5. **Add supporting modules** as needed (`player.py`, `matcher.py`, `trigger.py`, etc.). All internal imports use relative syntax.

6. **Test the import** before running the hub:
   ```python
   # From the hub root:
   python -c "import my_project.main; print('OK')"
   ```
   If this fails, fix imports before starting the hub.

7. **Drop it in and restart** — the hub discovers and starts it automatically. No changes to `main.py` or any other file needed.

---

## 8. Config File Conventions

Every project should have a `config.py` that covers:

```python
from pathlib import Path

# Paths
ASSETS_DIR = Path(r"F:\EVERYTHING STREAM RELATED\Assets\...")
_HERE = Path(__file__).resolve().parent   # for files relative to the project

# OBS
SCENE = "MyScene"

# Hotkey
TRIGGER_SEQUENCE     = ["a", "b", "c"]
TRIGGER_MAX_INTERVAL = 0.400   # seconds

# Voice / recording
RECORD_TIMEOUT_SECONDS: float = 15.0

# Media polling
POLL_INTERVAL       = 0.10
MEDIA_START_TIMEOUT = 5.0
MEDIA_TOTAL_TIMEOUT = 600.0

# Audio
MONITOR_TYPE    = "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT"
DEFAULT_VOLUME_DB = -23.0
```

---

## 9. Things to Never Do

| Don't | Do instead |
|---|---|
| `sys.path.insert(0, ...)` inside a project | Use package-relative imports |
| `from config import ...` (bare) | `from .config import ...` |
| `import config` (bare) | `from . import config` |
| `sys.modules.pop("config", None)` | Not needed with relative imports |
| Import `voice.listener` yourself | `sys.modules.get("voice.listener")` |
| Modify `hub_root/main.py` to add a project | Just drop the folder in |
| Use `shared.project_import_lock` | Not needed with relative imports |
| Block the main thread without checking `stop_event` | Always loop on `stop_event.is_set()` |

---

## 10. Checklist Before Handing Code to the User

- [ ] Folder has `__init__.py`
- [ ] `main.py` exposes `run(input_queue, stop_event)`
- [ ] All internal imports are relative (`from .X import ...`)
- [ ] `obs` is imported as `import obs` (absolute, hub root package)
- [ ] Voice module accessed via `sys.modules.get("voice.listener")`, not imported
- [ ] Main loop exits cleanly when `stop_event.is_set()`
- [ ] Keyboard listener is stopped on exit
- [ ] No `sys.path` manipulation anywhere in the project

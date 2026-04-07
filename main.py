"""
main.py  (hub root)
===================
Discovers and runs all mini-projects concurrently.

Each project is a proper Python *package* (folder with __init__.py).
Projects are imported as  `<folder_name>.main`  — never by path injection —
so every internal import inside a project is unambiguous and thread-safe
with no locking, eviction, or sys.path surgery required.

Adding a new project
--------------------
1. Create  <hub_root>/<project_name>/__init__.py   (can be empty)
2. Create  <hub_root>/<project_name>/main.py       exposing  run(q, stop_event)
3. Use ONLY package-relative imports inside the project:
       from .config import FOO          # NOT  from config import FOO
       from .utils  import helper       # NOT  from utils  import helper
4. That's it — the hub discovers and starts it automatically.

Shutdown
--------
  Ctrl+C  →  sets stop_event, joins all project threads, exits.
"""

from __future__ import annotations

import os

# Force unbuffered stdout/stderr so print() output appears immediately
# instead of getting stuck in Python's internal buffer.
os.environ["PYTHONUNBUFFERED"] = "1"

import importlib
import inspect
import queue
import sys
import threading
import time
from pathlib import Path

# ── Hub root is the directory this file lives in ──────────────────────────────
_ROOT = Path(__file__).resolve().parent

# The root must be on sys.path so that  `import meme_songs.main`  works.
# Insert only once; importlib handles everything else.
_ROOT_STR = str(_ROOT)
if _ROOT_STR not in sys.path:
    sys.path.insert(0, _ROOT_STR)

# Folders that are NOT mini-projects (shared hub infrastructure)
_SKIP: set[str] = {"obs", "voice", "__pycache__", "tools"}


# ─────────────────────────────────────────────────────────────────────────────
#  Project discovery
# ─────────────────────────────────────────────────────────────────────────────

def _discover_projects() -> list[dict]:
    """
    Scan _ROOT for sub-folders that look like mini-projects and import them
    as proper packages.

    A folder qualifies when it:
      • is a directory
      • is not in _SKIP and doesn't start with '.' or '_'
      • contains both __init__.py  AND  main.py
      • main.py exposes a callable  run(input_queue, stop_event, ...)
    """
    projects: list[dict] = []

    for folder in sorted(_ROOT.iterdir()):
        if (
            not folder.is_dir()
            or folder.name in _SKIP
            or folder.name.startswith((".", "_"))
        ):
            continue

        # Require both markers of a proper package
        if not (folder / "__init__.py").exists():
            print(f"[hub] Skipping '{folder.name}' — no __init__.py (not a package).")
            continue
        if not (folder / "main.py").exists():
            print(f"[hub] Skipping '{folder.name}' — no main.py.")
            continue

        pkg_name = f"{folder.name}.main"
        try:
            module = importlib.import_module(pkg_name)
        except Exception as exc:
            print(f"[hub] Could not import '{pkg_name}': {exc}")
            continue

        if not callable(getattr(module, "run", None)):
            print(f"[hub] Skipping '{folder.name}' — main.py has no run() function.")
            continue

        projects.append({
            "name"  : folder.name,
            "module": module,
            "queue" : queue.Queue(),
            "thread": None,
        })

    return projects


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("  OBS Hub")
    print("=" * 60)

    # Verify OBS connection before starting anything
    try:
        from obs import get_obs
        get_obs()
    except Exception as exc:
        print(f"\n  ❌  {exc}")
        print("       Fix OBS connection in obs/obs_config.py and try again.")
        return

    projects = _discover_projects()
    if not projects:
        print("\n  ❌  No mini-projects found.")
        print("       Add a sub-folder with __init__.py + main.py exposing run().")
        return

    print(f"\n  Found {len(projects)} project(s):\n")
    for p in projects:
        print(f"    • {p['name']}")
    print()
    print("  Each project manages its own hotkeys.")
    print("  Shutdown: Ctrl+C\n")

    stop_event = threading.Event()

    # done_queue is kept for backwards-compatibility with projects that were
    # written to accept a third positional argument.  The hub itself never
    # reads from it.
    done_queue: queue.Queue[str] = queue.Queue()

    for p in projects:
        run_fn = p["module"].run
        sig    = inspect.signature(run_fn)

        # Count parameters that have no default value (i.e. are required)
        n_required = sum(
            1 for param in sig.parameters.values()
            if param.default is inspect.Parameter.empty
        )

        def _make_target(fn, q: queue.Queue, n: int) -> callable:
            if n >= 3:
                return lambda: fn(q, stop_event, done_queue)
            return lambda: fn(q, stop_event)

        t = threading.Thread(
            target=_make_target(run_fn, p["queue"], n_required),
            name=p["name"],
            daemon=True,
        )
        t.start()
        p["thread"] = t

    print("  All projects running.\n")

    # Start the shared voice listener.
    # Projects that need voice grab  sys.modules["voice.listener"]  directly;
    # they never import the voice package themselves.
    try:
        from voice import listener as voice_mod
        print("  [voice] Listener module imported.")
        voice_mod.start(stop_event)
    except Exception as exc:
        import traceback
        print(f"\n  [voice] Could not start voice listener: {exc}")
        traceback.print_exc()
        print("       Voice input will be unavailable.\n")

    # ── Main thread: tight-ish sleep loop so Ctrl+C is always delivered ───────
    # stop_event.wait() swallows KeyboardInterrupt on Windows.
    try:
        while not stop_event.is_set():
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\n  Ctrl+C received.")

    # ── Graceful shutdown ─────────────────────────────────────────────────────
    print("  Shutting down…")
    stop_event.set()

    for p in projects:
        t = p["thread"]
        if t and t.is_alive():
            t.join(timeout=3)
            if t.is_alive():
                print(f"  [hub] Warning: '{p['name']}' did not stop within 3 s.")

    print("  Goodbye.")


if __name__ == "__main__":
    main()
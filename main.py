"""
main.py  (hub root)
===================
Discovers and runs all mini-projects concurrently.

Now supports CLI filtering:
  py -3.11 main.py --debug
  py -3.11 main.py --only project_a project_b
  py -3.11 main.py --skip project_x
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
#  CLI args (must be parsed before importing log)
# ─────────────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run OBS hub mini-projects.")
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable DEBUG logging.",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="PROJECT",
        help="Run only the specified mini-project(s).",
    )
    parser.add_argument(
        "--skip",
        nargs="+",
        metavar="PROJECT",
        help="Skip the specified mini-project(s).",
    )
    return parser.parse_args()


ARGS = _parse_args()

# UTF-8 everywhere — prevents emoji / non-ASCII crashes on Windows (cp1252 default).
os.environ["PYTHONUTF8"] = "1"
os.environ["PYTHONUNBUFFERED"] = "1"

if ARGS.debug:
    os.environ["LOG_LEVEL"] = "DEBUG"

# Load .env before anything else so OBS_PASSWORD, TWITCH_OAUTH_TOKEN, etc. are available.
from dotenv import load_dotenv
load_dotenv()

# ── Logging must start before any other import so all output goes through the
# queue writer and the Windows console-freeze fix is active from the first line.
import log
log.start()

import importlib
import inspect
import queue
import threading
import time

# ── Hub root on sys.path ─────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent
_ROOT_STR = str(_ROOT)
if _ROOT_STR not in sys.path:
    sys.path.insert(0, _ROOT_STR)

# Projects can also live in "mini projects/".
_MINI_PROJECTS_DIR = _ROOT / "mini projects"
if _MINI_PROJECTS_DIR.is_dir():
    _mp_str = str(_MINI_PROJECTS_DIR)
    if _mp_str not in sys.path:
        sys.path.append(_mp_str)

# Folders that are NOT mini-projects.
_SKIP: set[str] = {"obs", "voice", "__pycache__", "tools", "sandbox_testing", "mini projects"}


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_names(values: list[str] | None) -> set[str]:
    return {v.strip() for v in (values or []) if v and v.strip()}


def _filter_projects(projects: list[dict], only: set[str], skip: set[str]) -> list[dict]:
    available = {p["name"] for p in projects}

    unknown_only = sorted(only - available)
    unknown_skip = sorted(skip - available)

    for name in unknown_only:
        log.warn("hub", f"--only requested unknown project '{name}'")
    for name in unknown_skip:
        log.warn("hub", f"--skip requested unknown project '{name}'")

    filtered = projects

    if only:
        filtered = [p for p in filtered if p["name"] in only]

    if skip:
        filtered = [p for p in filtered if p["name"] not in skip]

    return filtered


# ─────────────────────────────────────────────────────────────────────────────
#  Project discovery
# ─────────────────────────────────────────────────────────────────────────────

def _discover_projects() -> list[dict]:
    """
    Scan for sub-folders that look like mini-projects and import them.

    A folder qualifies when it:
      • is a directory, not in _SKIP, and does not start with '.' or '_'
      • contains both __init__.py  AND  main.py
      • main.py exposes a callable  run(input_queue, stop_event, ...)
    """
    projects: list[dict] = []
    seen_names: set[str] = set()

    scan_dirs = [_ROOT]
    if _MINI_PROJECTS_DIR.is_dir():
        scan_dirs.append(_MINI_PROJECTS_DIR)

    for scan_root in scan_dirs:
        for folder in sorted(scan_root.iterdir()):
            if (
                not folder.is_dir()
                or folder.name in _SKIP
                or folder.name.startswith((".", "_"))
            ):
                continue

            if folder.name in seen_names:
                log.warn("hub", f"Skipping '{folder.name}' in '{scan_root.name}/' — already loaded.")
                continue

            if not (folder / "__init__.py").exists():
                log.debug("hub", f"Skipping '{folder.name}' — no __init__.py")
                continue
            if not (folder / "main.py").exists():
                log.debug("hub", f"Skipping '{folder.name}' — no main.py")
                continue

            pkg_name = f"{folder.name}.main"
            try:
                module = importlib.import_module(pkg_name)
            except Exception as exc:
                log.error("hub", f"Could not import '{pkg_name}': {exc}")
                continue

            if not callable(getattr(module, "run", None)):
                log.warn("hub", f"Skipping '{folder.name}' — main.py has no run() function.")
                continue

            seen_names.add(folder.name)

            # Import interface.py to trigger auto-registration with project_registry.
            try:
                importlib.import_module(f"{folder.name}.interface")
            except ImportError:
                pass
            except Exception as exc:
                log.warn("hub", f"Could not import '{folder.name}.interface': {exc}")

            projects.append({
                "name": folder.name,
                "module": module,
                "queue": queue.Queue(),
                "thread": None,
            })

    return projects


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 62)
    print("  OBS Hub")
    print("=" * 62)

    # Verify OBS connection before starting anything
    try:
        from obs import get_obs
        client = get_obs()
        print("  OBS: Connected")
    except Exception as exc:
        print(f"\n  [ERROR] OBS connection failed: {exc}")
        print("  Fix connection settings in obs/obs_config.py and retry.")
        return

    projects = _discover_projects()

    # Register cross-project coordination rules now that all interfaces are
    # loaded.  hub_rules.py is the single source of truth for which projects
    # pause/resume when another project starts playing.
    import hub_rules  # noqa: F401 — imported for side-effects (rule registration)

    only_names = _normalize_names(ARGS.only)
    skip_names = _normalize_names(ARGS.skip)
    projects = _filter_projects(projects, only_names, skip_names)

    if not projects:
        print("\n  [ERROR] No mini-projects selected.")
        print("  Check your --only / --skip arguments.")
        return

    # ── Scene ownership table ─────────────────────────────────────────────────
    from shared import project_registry

    print(f"\n  {len(projects)} project(s) loaded:\n")
    name_col = max(len(p["name"]) for p in projects) + 2
    scene_col = 40
    divider = f"  {'─' * name_col}┼{'─' * scene_col}"
    print(f"  {'Project':<{name_col}}│ OBS Scenes")
    print(divider)
    for p in projects:
        iface = project_registry.get(p["name"])
        scenes = ", ".join(iface.controlled_scenes) if iface else "(no interface)"
        print(f"  {p['name']:<{name_col}}│ {scenes}")
    print(divider)

    level_name = {
        log.DEBUG: "DEBUG",
        log.INFO: "INFO",
        log.WARN: "WARN",
        log.ERROR: "ERROR",
    }
    print(f"\n  Log level : {level_name.get(log._level, 'INFO')}")
    print(f"  Debug arg : {'ON' if ARGS.debug else 'OFF'}")
    print(f"  Only      : {', '.join(sorted(only_names)) if only_names else '(all)'}")
    print(f"  Skip      : {', '.join(sorted(skip_names)) if skip_names else '(none)'}")
    print("  Shutdown  : Ctrl+C")
    print()

    stop_event = threading.Event()

    # done_queue kept for backward-compat with 3-arg run() signatures.
    done_queue: queue.Queue[str] = queue.Queue()
 ##ORIGINAL
    # for p in projects:
        # run_fn = p["module"].run
        # sig = inspect.signature(run_fn)

        # n_required = sum(
            # 1 for param in sig.parameters.values()
            # if param.default is inspect.Parameter.empty
        # )
        
       
        # def _make_target(fn, q: queue.Queue, n: int):
            # if n >= 3:
                # return lambda: fn(q, stop_event, done_queue)
            # return lambda: fn(q, stop_event)

        # t = threading.Thread(
            # target=_make_target(run_fn, p["queue"], n_required),
            # name=p["name"],
            # daemon=True,
        # )
        # t.start()
        # p["thread"] = t

    # print("  Selected projects running.\n")
    #NOT ORIGINAL
    for p in projects:
        run_fn = p["module"].run
        sig = inspect.signature(run_fn)

        n_required = sum(
            1 for param in sig.parameters.values()
            if param.default is inspect.Parameter.empty
        )

        def _make_target(fn, q, n):
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

        # ⬇️ add this
        time.sleep(2)

    # Start the shared voice listener.
    try:
        from voice import listener as voice_mod
        voice_mod.start(stop_event)
        print("  [voice] Whisper listener started.")
    except Exception as exc:
        import traceback
        print(f"\n  [voice] Could not start voice listener: {exc}")
        traceback.print_exc()
        print("  Voice input will be unavailable.\n")

    try:
        while not stop_event.is_set():
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\n  Ctrl+C received.")

    print("  Shutting down…")
    stop_event.set()

    for p in projects:
        t = p["thread"]
        if t and t.is_alive():
            t.join(timeout=3)
            if t.is_alive():
                log.warn("hub", f"'{p['name']}' did not stop within 3 s.")

    print("  Goodbye.")


if __name__ == "__main__":
    main()
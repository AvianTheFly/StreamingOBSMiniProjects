from __future__ import annotations

import argparse
import inspect
import os
import queue
import threading
import time

from lib.paths import ensure_import_paths, load_project_env
from lib.project_registry import (
    discover_runnable_projects,
    filter_projects,
    normalize_project_names,
)


PROJECT_START_READY_TIMEOUT_SECONDS = 20.0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run OBS hub mini projects.")
    parser.add_argument("--debug", action="store_true", help="Enable DEBUG logging.")
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="PROJECT",
        help="Run only the specified mini project(s).",
    )
    parser.add_argument(
        "--skip",
        nargs="+",
        metavar="PROJECT",
        help="Skip the specified mini project(s).",
    )
    return parser.parse_args()


ARGS = _parse_args()

# Keep Windows consoles and background logs predictable before log.py starts.
os.environ["PYTHONUTF8"] = "1"
os.environ["PYTHONUNBUFFERED"] = "1"
if ARGS.debug:
    os.environ["LOG_LEVEL"] = "DEBUG"

ensure_import_paths()
load_project_env()

import log

log.start()

from lib.process_priority import raise_priority

raise_priority()


def _run_target(
    run_fn,
    project_queue: queue.Queue,
    stop_event: threading.Event,
    done_queue: queue.Queue,
    startup_event: threading.Event,
):
    params = inspect.signature(run_fn).parameters
    kwargs = {}
    if "done_queue" in params:
        kwargs["done_queue"] = done_queue
    if "startup_event" in params:
        kwargs["startup_event"] = startup_event
    return lambda: run_fn(project_queue, stop_event, **kwargs)


def _print_project_table(projects: list) -> None:
    from shared import project_registry

    print(f"\n  {len(projects)} project(s) loaded:\n")
    name_col = max(len(project.name) for project in projects) + 2
    scene_col = 40
    divider = f"  {'-' * name_col}+{'-' * scene_col}"
    print(f"  {'Project':<{name_col}}| OBS Scenes")
    print(divider)
    for project in projects:
        iface = project_registry.get(project.name)
        scenes = ", ".join(iface.controlled_scenes) if iface else "(no interface)"
        print(f"  {project.name:<{name_col}}| {scenes}")
    print(divider)


def _print_runtime_options(only_names: set[str], skip_names: set[str], debug: bool = False) -> None:
    level_name = {
        log.DEBUG: "DEBUG",
        log.INFO: "INFO",
        log.WARN: "WARN",
        log.ERROR: "ERROR",
    }
    print(f"\n  Log level : {level_name.get(log._level, 'INFO')}")
    print(f"  Debug arg : {'ON' if debug else 'OFF'}")
    print(f"  Only      : {', '.join(sorted(only_names)) if only_names else '(all)'}")
    print(f"  Skip      : {', '.join(sorted(skip_names)) if skip_names else '(none)'}")
    print("  Shutdown  : Ctrl+C")
    print()


def _check_obs_connection() -> bool:
    try:
        from obs import get_obs

        get_obs()
        print("  OBS: Connected")
        return True
    except Exception as exc:
        print(f"\n  [ERROR] OBS connection failed: {exc}")
        print("  Fix connection settings in obs/obs_config.py or .env and retry.")
        return False


def _start_projects(projects: list, stop_event: threading.Event) -> None:
    done_queue: queue.Queue[str] = queue.Queue()

    for project in projects:
        startup_event = threading.Event()
        target = _run_target(project.module.run, project.queue, stop_event, done_queue, startup_event)
        thread = threading.Thread(target=target, name=project.name, daemon=True)
        thread.start()
        project.thread = thread
        if startup_event.wait(timeout=PROJECT_START_READY_TIMEOUT_SECONDS):
            print(f"  [{project.name}] Startup ready.")
            continue
        if not thread.is_alive():
            print(f"  [{project.name}] Startup thread exited before ready signal.")
        else:
            print(
                f"  [{project.name}] Startup ready signal timed out after "
                f"{PROJECT_START_READY_TIMEOUT_SECONDS:.0f}s; continuing."
            )

    print("  Selected projects running.\n")


def _start_voice(stop_event: threading.Event) -> None:
    try:
        from voice import listener as voice_mod

        voice_mod.start(stop_event)
        print("  [voice] Whisper listener starting.")
    except Exception as exc:
        import traceback

        print(f"\n  [voice] Could not start voice listener: {exc}")
        traceback.print_exc()
        print("  Voice input will be unavailable.\n")


def _wait_for_shutdown(stop_event: threading.Event) -> None:
    try:
        while not stop_event.is_set():
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\n  Ctrl+C received.")
        stop_event.set()


def _join_projects(projects: list) -> None:
    for project in projects:
        thread = project.thread
        if thread and thread.is_alive():
            thread.join(timeout=3)
            if thread.is_alive():
                log.warn("hub", f"'{project.name}' did not stop within 3 s.")


def run_hub(
    stop_event: threading.Event,
    *,
    only: list[str] | None = None,
    skip: list[str] | None = None,
    debug: bool = False,
) -> list:
    """
    Start all hub mini-project threads and return the list of started projects.

    Unlike main(), this does NOT block — the caller controls the stop_event and
    is responsible for calling _join_projects(projects) on shutdown.
    Used by hub.py to run the hub alongside the UI server.
    """
    if debug:
        os.environ["LOG_LEVEL"] = "DEBUG"

    if not _check_obs_connection():
        return []

    projects = discover_runnable_projects(logger=log)

    import hub_rules  # noqa: F401

    only_names = normalize_project_names(only)
    skip_names = normalize_project_names(skip)
    projects = filter_projects(projects, only=only_names, skip=skip_names, logger=log)

    if not projects:
        print("\n  [ERROR] No mini projects selected.")
        return []

    _print_project_table(projects)
    _print_runtime_options(only_names, skip_names, debug=debug)
    _start_voice(stop_event)
    _start_projects(projects, stop_event)

    return projects


def main() -> None:
    print("=" * 62)
    print("  OBS Hub")
    print("=" * 62)

    if not _check_obs_connection():
        return

    projects = discover_runnable_projects(logger=log)

    # Import after discovery so all project interfaces are registered.
    import hub_rules  # noqa: F401

    only_names = normalize_project_names(ARGS.only)
    skip_names = normalize_project_names(ARGS.skip)
    projects = filter_projects(projects, only=only_names, skip=skip_names, logger=log)

    if not projects:
        print("\n  [ERROR] No mini projects selected.")
        print("  Check your --only / --skip arguments.")
        return

    _print_project_table(projects)
    _print_runtime_options(only_names, skip_names, debug=ARGS.debug)

    stop_event = threading.Event()
    _start_voice(stop_event)
    _start_projects(projects, stop_event)
    _wait_for_shutdown(stop_event)

    print("  Shutting down...")
    stop_event.set()
    _join_projects(projects)
    print("  Goodbye.")


if __name__ == "__main__":
    main()

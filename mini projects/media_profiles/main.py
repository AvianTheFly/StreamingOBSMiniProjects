from __future__ import annotations

import queue
import threading
import time

from lib.shared_media.media_project import run_media_project

from .config import load_configs
from .runtime import live_state_for


def _run_profile(
    cfg,
    stop_event: threading.Event,
    startup_event: threading.Event | None = None,
) -> None:
    run_media_project(
        cfg=cfg,
        input_queue=queue.Queue(),
        stop_event=stop_event,
        live_state=live_state_for(cfg.project_name),
        startup_event=startup_event,
    )


def run(
    input_queue: queue.Queue,
    stop_event: threading.Event,
    *,
    startup_event: threading.Event | None = None,
) -> None:
    configs = load_configs()
    if not configs:
        print("[media_profiles] No enabled media profiles found.")
        if startup_event is not None:
            startup_event.set()
        return

    threads: list[threading.Thread] = []
    profile_startups: list[threading.Event] = []
    for cfg in configs:
        profile_startup = threading.Event()
        thread = threading.Thread(
            target=_run_profile,
            args=(cfg, stop_event, profile_startup),
            daemon=True,
            name=f"media_profiles:{cfg.project_name}",
        )
        thread.start()
        threads.append(thread)
        profile_startups.append(profile_startup)
        if profile_startup.wait(timeout=20.0):
            print(f"[media_profiles] Profile '{cfg.project_name}' ready.")
        elif not thread.is_alive():
            print(f"[media_profiles] Profile '{cfg.project_name}' exited during startup.")
        else:
            print(f"[media_profiles] Profile '{cfg.project_name}' startup timed out; continuing.")

    print(f"[media_profiles] Running {len(threads)} media profile(s).")
    if startup_event is not None:
        startup_event.set()
    try:
        while not stop_event.is_set():
            try:
                input_queue.get(timeout=0.5)
            except queue.Empty:
                continue
    finally:
        stop_event.set()
        for thread in threads:
            thread.join(timeout=3)
        print("[media_profiles] Stopped.")

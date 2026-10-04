"""Start module workers, wait for readiness, and join them on shutdown."""
from __future__ import annotations
import inspect
import queue
import threading
import time
import log

PROJECT_START_READY_TIMEOUT_SECONDS = 20.0


def partition_obs_projects(projects):
    """Features declare OBS dependency; undeclared/invalid metadata stays deferred."""
    independent, dependent = [], []
    for project in projects:
        target = independent if getattr(project.module, 'REQUIRES_OBS', True) is False else dependent
        target.append(project)
    return independent, dependent

class _StartupSignal(threading.Event):
    def __init__(self, notification):
        super().__init__()
        self.notification = notification

    def set(self):
        super().set()
        self.notification.set()

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

def _start_projects(projects: list, stop_event: threading.Event, *, ready_timeout=20.0) -> None:
    done_queue: queue.Queue[str] = queue.Queue()

    for project in projects:
        if stop_event.is_set():
            break
        settled = threading.Event()
        startup_event = _StartupSignal(settled)
        target = _run_target(project.module.run, project.queue, stop_event, done_queue, startup_event)
        def run(target=target, settled=settled):
            try:
                target()
            finally:
                settled.set()
        thread = threading.Thread(target=run, name=project.name, daemon=True)
        thread.start()
        project.thread = thread
        deadline = time.monotonic() + ready_timeout
        while not stop_event.is_set() and not settled.wait(min(.1, max(0, deadline - time.monotonic()))):
            if time.monotonic() >= deadline:
                break
        if stop_event.is_set():
            break
        if startup_event.is_set():
            print(f"  [{project.name}] Startup ready.")
            continue
        if settled.is_set():
            print(f"  [{project.name}] Startup thread exited before ready signal.")
        else:
            print(
                f"  [{project.name}] Startup ready signal timed out after "
                f"{ready_timeout:.0f}s; continuing."
            )

    print("  Selected projects running.\n")

def _join_projects(projects: list) -> None:
    for project in projects:
        thread = project.thread
        if thread and thread.is_alive():
            thread.join(timeout=3)
            if thread.is_alive():
                log.warn("hub", f"'{project.name}' did not stop within 3 s.")

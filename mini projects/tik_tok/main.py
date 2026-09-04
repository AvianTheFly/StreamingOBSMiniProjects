from __future__ import annotations

import queue
import threading

from lib.shared_media.media_project import run_media_project
from .config import CONFIG

_live: dict = {}


def run(
    input_queue: queue.Queue,
    stop_event: threading.Event,
    *,
    startup_event: threading.Event | None = None,
) -> None:
    run_media_project(
        cfg=CONFIG,
        input_queue=input_queue,
        stop_event=stop_event,
        live_state=_live,
        startup_event=startup_event,
    )

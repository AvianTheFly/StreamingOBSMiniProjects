# sound_effects/main.py
"""
Sound Effects mini-project.

Hotkeys
-------
  989  (or (, *, ()  in under 150 ms)
    → After typing, press a manual key (see manual_trigger_map in config.py)
      within manual_trigger_window seconds to play an SFX instantly.
    → Or wait — voice PTT opens automatically after the window expires.
      Say the SFX name; press 989 again (or wait 2 s) to transcribe.

Hub event: "sfx.play"
---------------------
  Other projects (e.g. league) can request an SFX without touching this
  scene directly:
      import events
      events.emit("sfx.play", source="halo respawn sound effect")

  The source value must be the lowercase file stem of an asset in SOUND_EFFECTS_DIR.
  Pass concurrent=True to layer the sound over whatever is currently playing.
"""

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

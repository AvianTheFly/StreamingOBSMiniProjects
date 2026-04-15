"""
coordinator_demo.py
===================
Demonstrates the full activation-conflict-concede lifecycle between
tik_tok and specific_song — no OBS, no real audio, no voice input required.

Run with:
    python coordinator_demo.py

What this shows
---------------
The hub uses a central PlayCoordinator (coordinator.py) and a rule table
(hub_rules.py) to prevent simultaneous playback conflicts.  When a project
wants to play it calls coordinator.request_to_play(), which:

  1. Looks up which other projects must pause first (from hub_rules).
  2. Calls iface.pause() on each of them through the project_registry.
  3. Only calls on_ready() — the "you may now play" callback — once every
     required project has confirmed its pause.
  4. When the requester finishes it calls coordinator.announce_finished(),
     which resumes everything that was paused.

Projects never touch each other directly.  All policy lives in hub_rules.py.
The interfaces in each project are thin wrappers that translate hub commands
("pause", "resume", "revert") into project-specific actions (stopping a song
player, hiding OBS sources, etc).

Two scenarios are shown:
  A — specific_song IS playing when tik_tok triggers  (conflict → pause → concede)
  B — specific_song is IDLE when tik_tok triggers     (no-op pause path)
"""

from __future__ import annotations

import sys
import time
import threading
from pathlib import Path

# Force UTF-8 output on Windows so ANSI/Unicode characters don't crash cp1252.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Hub root must be on sys.path so real coordinator/shared/events import ──────
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Import the real hub infrastructure (no OBS connection needed).
from coordinator import coordinator as real_coordinator, CoordinationRule
from shared import ProjectInterface, ProjectStatus, project_registry
import events as hub_events


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
CYAN   = "\033[96m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
MAGENTA= "\033[95m"
RED    = "\033[91m"
DIM    = "\033[2m"

def banner(title: str, color: str = CYAN) -> None:
    bar = "─" * 62
    print(f"\n{color}{BOLD}{bar}")
    print(f"  {title}")
    print(f"{bar}{RESET}\n")

def log(project: str, msg: str, color: str = RESET) -> None:
    print(f"  {color}[{project}]{RESET} {msg}")

def status_table(label: str) -> None:
    snapshot = project_registry.get_all_status()
    print(f"\n  {DIM}── Status snapshot: {label} {'─' * (40 - len(label))}{RESET}")
    for name, st in snapshot.items():
        active_str = f"{GREEN}ACTIVE{RESET}" if st.is_active else f"{DIM}idle{RESET}"
        activity   = f" → {st.current_activity}" if st.current_activity else ""
        print(f"    {name:<20} {active_str}{activity}")
    print()


# ─────────────────────────────────────────────────────────────────────────────
#  Mock specific_song interface
#  Simulates a SongPlayer that can be paused/resumed mid-song.
# ─────────────────────────────────────────────────────────────────────────────

class MockSpecificSongInterface(ProjectInterface):
    name              = "specific_song"
    controlled_scenes = ["SpecificSongs"]

    def __init__(self) -> None:
        self._playing:    bool       = False
        self._song:       str | None = None
        self._position:   float      = 0.0   # seconds into the song
        self._paused:     bool       = False
        self._lock = threading.Lock()

    # ── Simulation helpers ──────────────────────────────────────────────────

    def start_song(self, title: str) -> None:
        """Called by the test harness to put this interface into PLAYING state."""
        with self._lock:
            self._playing  = True
            self._song     = title
            self._position = 87.4          # arbitrary "mid-song" position
            self._paused   = False
        log(self.name, f"Now playing: {YELLOW}'{title}'{RESET} (position 1:27)")

    def stop_song(self) -> None:
        with self._lock:
            self._playing = False
            self._song    = None

    # ── ProjectInterface contract ───────────────────────────────────────────

    def get_status(self) -> ProjectStatus:
        with self._lock:
            activity = None
            if self._playing and self._song:
                status_str = "paused" if self._paused else "playing"
                activity   = f"{status_str}: {self._song}"
            return ProjectStatus(
                name             = self.name,
                is_active        = self._playing,
                current_activity = activity,
                controlled_scenes= self.controlled_scenes,
                can_revert       = True,
            )

    def pause(self) -> None:
        with self._lock:
            if not self._playing:
                log(self.name, f"pause() called — not playing, no-op", DIM)
                return
            self._paused = True
        log(self.name, f"{YELLOW}Paused{RESET} at position 1:27 of '{self._song}' (ready to resume)")

    def resume(self) -> None:
        with self._lock:
            if not self._playing:
                log(self.name, f"resume() called — was idle, no-op", DIM)
                return
            self._paused = False
        log(self.name, f"{GREEN}Resumed{RESET} '{self._song}' from 1:27")

    def revert(self) -> None:
        with self._lock:
            self._playing = False
            self._paused  = False
            self._song    = None
        log(self.name, f"reverted — OBS scene hidden, playback stopped", DIM)


# ─────────────────────────────────────────────────────────────────────────────
#  Mock tik_tok interface
#  The actual tik_tok project doesn't need rich pause/resume — it's fire-and-
#  forget.  This mock captures the request_to_play / announce_finished cycle.
# ─────────────────────────────────────────────────────────────────────────────

class MockTikTokInterface(ProjectInterface):
    name              = "tik_tok"
    controlled_scenes = ["TikTok"]

    def __init__(self) -> None:
        self._visible: set[str] = set()

    def get_status(self) -> ProjectStatus:
        return ProjectStatus(
            name             = self.name,
            is_active        = bool(self._visible),
            current_activity = f"playing: {', '.join(self._visible)}" if self._visible else None,
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
        )

    def revert(self) -> None:
        self._visible.clear()
        log(self.name, "reverted — all sources hidden", DIM)

    def play_clip(
        self,
        clip_name: str,
        duration: float = 3.0,
    ) -> None:
        """
        Simulate a full clip play via the coordinator:
          1. request_to_play → coordinator pauses specific_song
          2. on_ready fires → we "play" (sleep)
          3. announce_finished → coordinator resumes specific_song
        """
        done = threading.Event()

        def on_ready() -> None:
            self._visible.add(clip_name)
            log(self.name,
                f"{MAGENTA}PLAYING{RESET}: '{clip_name}' "
                f"({duration:.0f}s clip, OBS scene: TikTok)")
            time.sleep(duration)                       # simulate clip duration
            self._visible.discard(clip_name)
            log(self.name, f"clip finished — hiding OBS source '{clip_name}'", DIM)
            real_coordinator.announce_finished(self.name)
            done.set()

        real_coordinator.request_to_play(self.name, on_ready=on_ready)
        done.wait(timeout=duration + 10)               # block until clip ends


# ─────────────────────────────────────────────────────────────────────────────
#  Event bus subscriber — surface coordinator events to the demo output
# ─────────────────────────────────────────────────────────────────────────────

def _on_coordinator_event(data: dict) -> None:
    event = data.get("_event", "?")
    if event == "coordinator.project_paused":
        log("coordinator",
            f"pause confirmed: '{data['paused']}' is ready  ✓  "
            f"(requested by '{data['requester']}')",
            DIM)
    elif event == "coordinator.play_cleared":
        log("coordinator",
            f"{GREEN}PLAY CLEARED{RESET} — "
            f"'{data['requester']}' may activate  "
            f"(paused: {data['paused']})")
    elif event == "coordinator.project_resumed":
        log("coordinator",
            f"resumed '{data['resumed']}' after '{data['requester']}' finished",
            DIM)


# ─────────────────────────────────────────────────────────────────────────────
#  Setup — build the mock system
# ─────────────────────────────────────────────────────────────────────────────

def setup() -> tuple[MockSpecificSongInterface, MockTikTokInterface]:
    banner("System Boot — registering interfaces & rules", CYAN)

    specific_song = MockSpecificSongInterface()
    tik_tok       = MockTikTokInterface()

    project_registry.register(specific_song)
    project_registry.register(tik_tok)
    log("hub", "ProjectInterface registered: specific_song")
    log("hub", "ProjectInterface registered: tik_tok")

    # Mirror hub_rules.py: tik_tok must pause specific_song before playing.
    real_coordinator.add_rule(CoordinationRule(
        requester="tik_tok",
        pause=["specific_song"],
        resume_on_finish=True,
    ))
    log("hub",
        f"Rule loaded: {YELLOW}tik_tok → pause [specific_song]{RESET}, "
        f"resume_on_finish=True")
    print()

    # Subscribe to coordinator bus events for demo output
    for ev in ("coordinator.project_paused",
               "coordinator.play_cleared",
               "coordinator.project_resumed"):
        hub_events.subscribe(ev, _on_coordinator_event)

    return specific_song, tik_tok


# ─────────────────────────────────────────────────────────────────────────────
#  Scenario A — conflict: specific_song IS playing when tik_tok triggers
# ─────────────────────────────────────────────────────────────────────────────

def scenario_a(specific_song: MockSpecificSongInterface,
               tik_tok: MockTikTokInterface) -> None:

    banner("SCENARIO A — tik_tok activates while specific_song is playing", MAGENTA)

    print(f"  {DIM}Setup: a song is already playing in specific_song{RESET}\n")
    specific_song.start_song("MONTAGEM DO ELEFANTE")

    status_table("before activation")

    print(f"  {CYAN}Event: streamer triggers tik_tok (typed '++' hotkey){RESET}\n")

    tik_tok.play_clip("tt__ohio_rizz_clip.mp4", duration=3.0)

    status_table("after clip finishes")


# ─────────────────────────────────────────────────────────────────────────────
#  Scenario B — no conflict: specific_song is idle when tik_tok triggers
# ─────────────────────────────────────────────────────────────────────────────

def scenario_b(specific_song: MockSpecificSongInterface,
               tik_tok: MockTikTokInterface) -> None:

    banner("SCENARIO B — tik_tok activates while specific_song is idle", MAGENTA)

    print(f"  {DIM}Setup: no song playing — specific_song is idle{RESET}\n")
    specific_song.stop_song()

    status_table("before activation")

    print(f"  {CYAN}Event: streamer triggers tik_tok (typed '++' hotkey){RESET}\n")
    print(f"  {DIM}(coordinator still calls pause() per the rule — "
          f"specific_song's pause() is a no-op when idle){RESET}\n")

    tik_tok.play_clip("tt__goofy_ahh_sound.mp4", duration=2.0)

    status_table("after clip finishes")


# ─────────────────────────────────────────────────────────────────────────────
#  Architecture summary printed at the end
# ─────────────────────────────────────────────────────────────────────────────

def architecture_summary() -> None:
    banner("Architecture Summary", CYAN)
    lines = [
        ("coordinator.py",     "Central mediator — request_to_play / announce_finished"),
        ("hub_rules.py",       "Policy: which projects pause when another plays"),
        ("shared.py",          "ProjectInterface base + ProjectStatus + project_registry"),
        ("<project>/interface.py", "Per-project: get_status / pause / resume / revert"),
        ("events.py",          "Pub/sub bus — coordinator emits events for observability"),
    ]
    w = max(len(f) for f, _ in lines)
    for filename, desc in lines:
        print(f"  {YELLOW}{filename:<{w+2}}{RESET}{desc}")

    print(f"""
  {DIM}Flow (Scenario A):

    tik_tok trigger
      └─ coordinator.request_to_play("tik_tok", on_ready)
           └─ [daemon thread] looks up rules → must pause: specific_song
                └─ project_registry.get("specific_song").pause()
                     └─ specific_song pauses at current position
                └─ emit("coordinator.play_cleared", requester="tik_tok")
                └─ on_ready()  ← tik_tok is now playing
                     └─ [clip ends]
                          └─ coordinator.announce_finished("tik_tok")
                               └─ project_registry.get("specific_song").resume()
                                    └─ specific_song resumes from saved position{RESET}
""")


# ─────────────────────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    specific_song, tik_tok = setup()

    scenario_a(specific_song, tik_tok)
    time.sleep(0.5)   # let any background prints flush

    scenario_b(specific_song, tik_tok)
    time.sleep(0.5)

    architecture_summary()

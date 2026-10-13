# instant_replay/kill_tracker.py
"""
Polls the League of Legends Live Client Data API for ChampionKill events
where the KillerName matches the local player's summonerName.

Records the wall-clock time (time.time()) the moment each qualifying kill is
first detected.  The instant_replay main loop reads last_kill_wall_time to
calculate how far back in the replay buffer to reach.

The kill state remains independent of other modules. HTTP snapshots come from
the shared, short-lived League client cache so modules do not duplicate fetches.
"""

from __future__ import annotations

import threading
import time

from lib.league_live_client import LiveClientUnavailable, fetch_snapshot
from lib.league_match import MatchLifecycle
from lib.coordination.game_policy import game_scene_policy

from .config import LEAGUE_POLL_INTERVAL, DEATH_PRE_ROLL_SECONDS, KILL_STREAK_RESET_SECONDS


class KillTracker:
    """
    Background thread that watches for kills by the local player.

    Thread-safe: all public properties acquire the internal lock before reading.
    """

    def __init__(self, stop_event: threading.Event) -> None:
        self._stop_event      = stop_event
        self._lock            = threading.Lock()

        # Wall-clock time of the most recent qualifying kill (or None).
        self._last_kill_wall: float | None = None

        # Wall-clock time of the FIRST kill in the current streak (or None).
        self._first_kill_wall: float | None = None

        # Wall-clock time of the most recent death (or None).
        self._last_death_wall: float | None = None

        # Seconds of inactivity before the next kill starts a new streak.
        self._streak_reset_window: float = KILL_STREAK_RESET_SECONDS

        # The local player's summonerName, filled once the API responds.
        self._summoner_name   = ""

        # EventIDs we have already processed — prevents double-counting on
        # every poll (the API always returns the full event history).
        self._seen_event_ids: set[int] = set()

        self._game_connected  = False
        self._lifecycle = MatchLifecycle()
        self._generation = None

    # ── Public read-only properties ───────────────────────────────────────────

    @property
    def last_kill_wall_time(self) -> float | None:
        """Wall-clock time of the most recent kill, or None if none yet."""
        with self._lock:
            return self._last_kill_wall

    @property
    def first_kill_wall_time(self) -> float | None:
        """Wall-clock time of the first kill in the current streak, or None if none yet."""
        with self._lock:
            return self._first_kill_wall

    @property
    def last_death_wall_time(self) -> float | None:
        """Wall-clock time of the most recent death, or None if none yet."""
        with self._lock:
            return self._last_death_wall

    @property
    def summoner_name(self) -> str:
        """The active player's summonerName (empty string until first API response)."""
        with self._lock:
            return self._summoner_name

    @property
    def game_connected(self) -> bool:
        with self._lock:
            return self._game_connected

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Spawn the background polling thread.  Returns immediately."""
        t = threading.Thread(
            target=self._run,
            name="instant-replay-kill-tracker",
            daemon=True,
        )
        t.start()

    # ── Internal ─────────────────────────────────────────────────────────────

    def _run(self) -> None:
        print("[instant_replay] Kill tracker started — waiting for a League game.")

        while not self._stop_event.is_set():
            try:
                data = fetch_snapshot()

                # riotIdGameName matches KillerName in events exactly and
                # is unambiguous even if two players share the same game name
                # with different taglines.
                summoner = (
                    data.get("activePlayer", {})
                        .get("riotIdGameName", "")
                        .strip()
                )

                with self._lock:
                    self._summoner_name = summoner

                if self._observe_match(data):
                    self._process_events(data.get("events", {}).get("Events", []), summoner)
                self._stop_event.wait(LEAGUE_POLL_INTERVAL)

            except LiveClientUnavailable:
                shared_match = game_scene_policy.match_state()
                if shared_match is None or not shared_match['running']:
                    was_running = self.game_connected
                    self._set_running(False)
                    if was_running:
                        print("[instant_replay] League client disconnected — standing by.")
                self._stop_event.wait(1.0)

            except Exception as exc:
                print(f"[instant_replay] Kill tracker error: {exc}")
                self._stop_event.wait(1.0)

        print("[instant_replay] Kill tracker stopped.")

    def _set_running(self, running):
        with self._lock:
            if self._game_connected and not running:
                self._last_kill_wall = self._first_kill_wall = self._last_death_wall = None
            self._game_connected = running

    def _observe_match(self, data):
        prior_time = self._lifecycle.game_time
        running = self._lifecycle.observe(data)
        rewound = prior_time is not None and self._lifecycle.game_time < prior_time - 2
        shared_match = game_scene_policy.match_state()
        if shared_match is not None:
            running = shared_match['running']
            rewound = rewound or (self._generation is not None and self._generation != shared_match['generation'])
            self._generation = shared_match['generation']
        if rewound:
            with self._lock:
                self._seen_event_ids.clear()
                self._last_kill_wall = self._first_kill_wall = self._last_death_wall = None
        self._set_running(running)
        return running

    def _process_events(self, events: list[dict], summoner: str) -> None:
        """
        Iterate all events from the current API response.
        Only act on EventIDs we haven't seen before, and only on ChampionKill
        events where KillerName matches the local player.
        """
        now = time.time()

        for event in events:
            eid  = event.get("EventID", -1)
            name = event.get("EventName", "")

            if eid in self._seen_event_ids:
                continue
            self._seen_event_ids.add(eid)

            if name != "ChampionKill":
                continue

            killer = event.get("KillerName", "").strip()
            victim = event.get("VictimName", "").strip()

            if summoner and victim.lower() == summoner.lower():
                # ✅ We died — record it
                with self._lock:
                    self._last_death_wall = now
                print(
                    f"[instant_replay] 💀 Death! {killer} → {summoner} "
                    f"(game t={event.get('EventTime', '?'):.1f}s)"
                )
                continue

            if not summoner or killer.lower() != summoner.lower():
                # Kill by a teammate or enemy — not ours
                continue

            # ✅ Qualifying kill — update streak timestamps
            with self._lock:
                # Start a new streak if no prior kill or gap exceeded reset window
                if (
                    self._last_kill_wall is None
                    or (now - self._last_kill_wall) > self._streak_reset_window
                ):
                    self._first_kill_wall = now
                self._last_kill_wall = now

            print(
                f"[instant_replay] 🎯 Kill! {summoner} → {victim} "
                f"(game t={event.get('EventTime', '?'):.1f}s)"
            )

# instant_replay/kill_tracker.py
"""
Polls the League of Legends Live Client Data API for ChampionKill events
where the KillerName matches the local player's summonerName.

Records the wall-clock time (time.time()) the moment each qualifying kill is
first detected.  The instant_replay main loop reads last_kill_wall_time to
calculate how far back in the replay buffer to reach.

This module polls the same endpoint as the league/ mini-project but is
completely independent — no shared state, no cross-project imports.
"""

from __future__ import annotations

import threading
import time

import requests
import urllib3

from .config import LEAGUE_API_URL, LEAGUE_POLL_INTERVAL, LEAGUE_REQUEST_TIMEOUT, DEATH_PRE_ROLL_SECONDS

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


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
        self._streak_reset_window: float = 20.0

        # The local player's summonerName, filled once the API responds.
        self._summoner_name   = ""

        # EventIDs we have already processed — prevents double-counting on
        # every poll (the API always returns the full event history).
        self._seen_event_ids: set[int] = set()

        self._game_connected  = False

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
                resp = requests.get(
                    LEAGUE_API_URL,
                    verify=False,
                    timeout=LEAGUE_REQUEST_TIMEOUT,
                )
                resp.raise_for_status()
                data = resp.json()

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

                if not self._game_connected:
                    self._game_connected = True
                    print(
                        f"[instant_replay] League game detected. "
                        f"Tracking kills for: {summoner!r}"
                    )

                self._process_events(data.get("events", {}).get("Events", []), summoner)
                self._stop_event.wait(LEAGUE_POLL_INTERVAL)

            except requests.exceptions.ConnectionError:
                if self._game_connected:
                    self._game_connected = False
                    with self._lock:
                        # Reset event history so we re-process if a new game starts.
                        self._seen_event_ids.clear()
                        self._last_kill_wall = None
                        self._first_kill_wall = None
                        self._last_death_wall = None
                    print("[instant_replay] League client disconnected — standing by.")
                self._stop_event.wait(1.0)

            except Exception as exc:
                print(f"[instant_replay] Kill tracker error: {exc}")
                self._stop_event.wait(1.0)

        print("[instant_replay] Kill tracker stopped.")

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
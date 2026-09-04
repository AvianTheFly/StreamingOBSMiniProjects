# league/core/game_state_detector.py
#
# Detects state transitions from the polled API data and fires events via
# LeagueEvents.  Two kinds of detection happen here:
#
#   1. State-diff detection  — compares current snapshot to previous
#      (death/respawn, level-up, recall-complete).
#
#   2. Event-feed detection  — the API exposes a cumulative list of game events
#      (Events[]).  We track the highest EventID we've already processed and
#      dispatch every new entry exactly once.

import time

from ..config import RECALL_MIN_WAIT, RECALL_WATCH_WINDOW


class GameStateDetector:
    def __init__(self, events):
        self.events = events
        self.reset()

    def reset(self):
        # ── State-diff trackers ───────────────────────────────────────────
        self.last_is_dead      = None
        self.last_level        = None

        # ── Event-feed tracker ────────────────────────────────────────────
        # Tracks the highest EventID seen so we never fire the same event twice.
        # Starts at -1 so EventID 0 is processed on the very first poll.
        self._last_event_id = -1

        # ── Recall watch state ────────────────────────────────────────────
        self._recall_watching   = False
        self._recall_start_time = 0.0
        self._recall_last_mana  = 0.0
        self._recall_last_time  = 0.0

    # ── Public API ────────────────────────────────────────────────────────────

    def start_recall_watch(self, current_mana: float, active: dict) -> None:
        """Call when the player presses B."""
        stats         = active.get("championStats", {})
        resource_type = stats.get("resourceType", "")

        if resource_type != "MANA":
            print(
                f"[league] Recall watch not armed — resource type is "
                f"'{resource_type}', not 'MANA'."
            )
            return

        self._recall_watching   = True
        self._recall_start_time = time.monotonic()
        self._recall_last_mana  = current_mana
        self._recall_last_time  = time.monotonic()
        print(f"[league] Recall watch armed (mana baseline: {current_mana:.0f})")

    def process(self, me: dict, data: dict, riot_game_name: str = "") -> None:
        """
        me             – matched entry from allPlayers (isDead, level, etc.)
        data           – full API payload
        riot_game_name – short name without #tag (e.g. "UdyrIsABotLaner").
                         This is what KillerName in game events uses, so we
                         compare against it rather than summonerName.
        """
        active = data.get("activePlayer", {})

        # State-diff detectors
        self._detect_death_respawn(me)
        self._detect_level_change(me)
        self._detect_recall_complete(active)

        # Event-feed detector (handles all cumulative game events)
        self._detect_new_events(data, riot_game_name)

    # ── State-diff detectors ──────────────────────────────────────────────────

    def _detect_death_respawn(self, me) -> None:
        is_dead = me.get("isDead", False)
        if self.last_is_dead is None:
            self.last_is_dead = is_dead
            return

        if not self.last_is_dead and is_dead:
            # Just died — set up respawn-timer baseline
            self.events.emit("death", me)
            self._recall_watching = False
        elif self.last_is_dead and not is_dead:
            self.events.emit("respawn", me)
        self.last_is_dead = is_dead

    def _detect_level_change(self, me) -> None:
        level = me.get("level")
        if level is None:
            return

        if self.last_level is None:
            self.last_level = level
            return

        if level != self.last_level:
            print(f"[league] Level up: {self.last_level} → {level}")
            self.events.emit("level_changed", me, self.last_level, level)

        self.last_level = level

    def _detect_recall_complete(self, active: dict) -> None:
        if not self._recall_watching:
            return

        stats        = active.get("championStats", {})
        current_mana = stats.get("resourceValue", 0.0)
        max_mana     = stats.get("resourceMax", 0.0)
        now          = time.monotonic()
        elapsed      = now - self._recall_start_time
        tick_dt      = now - self._recall_last_time

        if elapsed > RECALL_WATCH_WINDOW:
            print("[league] Recall watch expired without detection.")
            self._recall_watching = False
            return

        if elapsed < RECALL_MIN_WAIT:
            self._recall_last_mana = current_mana
            self._recall_last_time = now
            return

        if tick_dt > 0 and max_mana > 0:
            mana_per_second   = (current_mana - self._recall_last_mana) / tick_dt
            threshold_per_sec = max_mana * 0.13

            if mana_per_second >= threshold_per_sec:
                print(
                    f"[league] Recall complete detected "
                    f"({mana_per_second:.0f} mana/s > 13% of {max_mana:.0f} "
                    f"after {elapsed:.1f}s)"
                )
                self._recall_watching = False
                self.events.emit("recall_complete")
                return

        self._recall_last_mana = current_mana
        self._recall_last_time = now

    # ── Event-feed detector ───────────────────────────────────────────────────

    def _detect_new_events(self, data: dict, riot_game_name: str) -> None:
        """
        Walk the cumulative Events[] list and dispatch every entry whose
        EventID is higher than the last one we've already processed.

        riot_game_name is the short name without #tag (e.g. "UdyrIsABotLaner")
        which is exactly what KillerName in game events contains.
        """
        my_name = riot_game_name.strip().lower()
        raw_events = data.get("events", {}).get("Events", [])

        for event in raw_events:
            eid = event.get("EventID", -1)
            if eid <= self._last_event_id:
                continue  # already processed

            self._last_event_id = max(self._last_event_id, eid)
            self._dispatch_event(event, my_name)

    def _dispatch_event(self, event: dict, my_name: str) -> None:
        name = event.get("EventName", "")

        if name == "MinionsSpawning":
            self.events.emit("minions_spawning")

        elif name == "FirstBrick":
            self.events.emit("first_brick", event)

        elif name == "TurretKilled":
            self.events.emit("turret_killed", event)

        elif name == "InhibKilled":
            self.events.emit("inhib_killed", event)

        elif name == "DragonKill":
            self.events.emit("dragon_kill", event)

        elif name == "HeraldKill":
            self.events.emit("herald_kill", event)

        elif name == "BaronKill":
            self.events.emit("baron_kill", event)

        elif name == "ChampionKill":
            # Only fire if the local player is the killer or an assister
            killer = event.get("KillerName", "").strip().lower()
            assisters = [a.strip().lower() for a in event.get("Assisters", [])]
            if killer == my_name:
                self.events.emit("champion_kill", event)
            elif my_name in assisters:
                self.events.emit("assist", event)

        elif name == "Multikill":
            # Only fire for the local player's multikills
            killer = event.get("KillerName", "").strip().lower()
            if killer == my_name:
                self.events.emit("multikill", event)

        elif name == "Ace":
            self.events.emit("ace", event)

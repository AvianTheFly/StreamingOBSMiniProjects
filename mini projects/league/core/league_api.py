# league/core/league_api.py

import json
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
import urllib3

from ..config import (
    LEAGUE_API_URL,
    POLL_INTERVAL,
    DISCONNECTED_INTERVAL,
    REQUEST_TIMEOUT,
    LEAGUE_KILL_AUDIO_DEFAULT_VOLUME_DB,
    LEAGUE_KILL_AUDIO_DIR,
    LEAGUE_KILL_AUDIO_MONITOR,
    LEAGUE_KILL_AUDIO_PREFIX,
    LEAGUE_KILL_AUDIO_SCENE,
)
from .league_events import LeagueEvents
from .game_state_detector import GameStateDetector
from ..kill_audio_player import LeagueKillAudioPlayer

# ── Handlers ──────────────────────────────────────────────────────────────────
from ..handlers.lifecycle import (
    make_game_start_handler, make_game_end_handler,
)
from ..handlers.player_events import (
    make_death_handler, make_respawn_handler, make_recall_complete_handler,
)
from ..handlers.level_up import make_level_up_handler
from ..handlers.map_events import (
    make_minions_spawning_handler, make_first_brick_handler,
    make_turret_killed_handler,   make_inhib_killed_handler,
    make_dragon_kill_handler,     make_herald_kill_handler,
    make_baron_kill_handler,
)
from ..handlers.kill_events       import make_multikill_handler, make_ace_handler
from ..handlers.champion_kill_handler import make_champion_kill_handler

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Shared file that instant_replay/cleanup.py reads to group clips by game.
_SESSIONS_FILE = Path.home() / ".claude" / "game_sessions.json"

# Grace period in seconds after a disconnect during which a reconnect
# still counts as the same game rather than starting a new session.
_RECONNECT_GRACE = 30


def _save_session(start_iso: str, end_iso: str) -> None:
    """Append a completed game session to the shared JSON file."""
    sessions: list[dict] = []
    if _SESSIONS_FILE.exists():
        try:
            data = json.loads(_SESSIONS_FILE.read_text(encoding="utf-8"))
            sessions = data.get("sessions", [])
        except Exception:
            pass
    sessions.append({"start": start_iso, "end": end_iso})
    _SESSIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SESSIONS_FILE.write_text(
        json.dumps({"sessions": sessions}, indent=2), encoding="utf-8"
    )
    print(f"[league] Game session recorded: {start_iso} -> {end_iso}")


class LeagueAPIWatcher:
    def __init__(self, stop_event: threading.Event):
        self.stop_event = stop_event

        self.events = LeagueEvents()
        self.kill_audio_player = LeagueKillAudioPlayer(
            project_dir=Path(__file__).resolve().parents[1],
            asset_dir=LEAGUE_KILL_AUDIO_DIR,
            scene=LEAGUE_KILL_AUDIO_SCENE,
            source_prefix=LEAGUE_KILL_AUDIO_PREFIX,
            default_volume_db=LEAGUE_KILL_AUDIO_DEFAULT_VOLUME_DB,
            monitor=LEAGUE_KILL_AUDIO_MONITOR,
        )
        try:
            self.kill_audio_player.ensure_ready()
        except Exception as exc:
            print(f"[league] Could not initialize kill audio source: {exc}")

        # ── State-diff events ─────────────────────────────────────────────
        self.events.register("death",           make_death_handler())
        self.events.register("respawn",         make_respawn_handler())
        self.events.register("game_end",        make_game_end_handler())
        self.events.register("recall_complete", make_recall_complete_handler())
        self.events.register("level_changed",   make_level_up_handler())

        # ── Event-feed events ─────────────────────────────────────────────
        # Toggle ENABLED flags and set scene/source names in config.py.
        self.events.register("game_start",       make_game_start_handler())
        self.events.register("minions_spawning", make_minions_spawning_handler())
        self.events.register("first_brick",      make_first_brick_handler())
        self.events.register("turret_killed",    make_turret_killed_handler())
        self.events.register("inhib_killed",     make_inhib_killed_handler())
        self.events.register("dragon_kill",      make_dragon_kill_handler())
        self.events.register("herald_kill",      make_herald_kill_handler())
        self.events.register("baron_kill",       make_baron_kill_handler())
        _kill_handler, _assist_handler, _force_streak_reset = make_champion_kill_handler(
            self.kill_audio_player
        )
        self.events.register("champion_kill",    _kill_handler)
        self.events.register("assist",           _assist_handler)
        self.multikill_handler = make_multikill_handler()
        self.events.register("multikill",        self.multikill_handler)
        self.events.register("ace",              make_ace_handler())

        self.detector       = GameStateDetector(self.events)
        self.game_connected = False
        self._game_start_iso: str | None    = None
        self._pending_save: threading.Timer | None = None  # delayed session saver
        self._force_streak_reset = _force_streak_reset  # crash-safe cleanup

        self._last_resource_value: float = 0.0
        self._last_active: dict          = {}

    # ── Public API ────────────────────────────────────────────────────────────

    def on_recall_key(self) -> None:
        """Called from the keyboard listener in main.py when 'B' is pressed."""
        if not self.game_connected:
            return
        self.detector.start_recall_watch(self._last_resource_value, self._last_active)

    def shutdown(self) -> None:
        """
        Crash-safe cleanup — call this from an atexit hook or on forced exit.

        Hides all kill-streak assets immediately and flushes any in-progress
        game session to disk.  Safe to call more than once (idempotent).

        Why this exists: the poll loop runs in a daemon thread.  When the hub
        shuts down it only waits 3 s for cleanup, so the deferred session-save
        timer (30 s grace period) never fires.  The atexit hook in main.py
        calls shutdown() to guarantee the session is persisted.
        """
        self._force_streak_reset()
        self.kill_audio_player.stop()

        if not (self.game_connected or self._pending_save):
            return

        end_iso   = datetime.now(timezone(timedelta())).isoformat()

        if self.game_connected:
            if self._pending_save:
                self._pending_save.cancel()
            start_iso           = self._game_start_iso or end_iso
            self.game_connected = False
        else:
            # Pending timer is still counting down — flush it now.
            start_iso = self._game_start_iso
            if start_iso is None:
                return
            self._pending_save.cancel()

        self._pending_save   = None
        self._game_start_iso = None
        _save_session(start_iso, end_iso)
        print("[league] Session flushed on shutdown.")

    # ── Main poll loop ────────────────────────────────────────────────────────

    def run(self) -> None:
        print("[league] Watcher started — waiting for a game.")

        while not self.stop_event.is_set():
            try:
                data = self._fetch()
                me, riot_game_name = self._find_active_player(data)

                if me is None:
                    print("[league] Active player not found in game data.")
                    self.stop_event.wait(DISCONNECTED_INTERVAL)
                    continue

                active = data.get("activePlayer", {})
                self._last_active         = active
                self._last_resource_value = (
                    active.get("championStats", {}).get("resourceValue", 0.0)
                )

                self._on_connected()
                if not getattr(self, "_name_logged", False):
                    print(f"[league] Tracking as: '{riot_game_name}' (this is what KillerName events will match)")
                    self._name_logged = True
                self.detector.process(me, data, riot_game_name)
                self.stop_event.wait(POLL_INTERVAL)

            except requests.exceptions.ConnectionError:
                self._on_disconnected()
                self.stop_event.wait(DISCONNECTED_INTERVAL)

            except Exception as e:
                print(f"[league] Unexpected error: {e}")
                self.stop_event.wait(DISCONNECTED_INTERVAL)

        print("[league] Stopped.")

    # ── Private ───────────────────────────────────────────────────────────────

    def _fetch(self) -> dict:
        resp = requests.get(LEAGUE_API_URL, verify=False, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def _on_connected(self) -> None:
        if not self.game_connected:
            # Reconnect within grace period → cancel the pending save,
            # same game continues.
            if self._pending_save:
                self._pending_save.cancel()
                self._pending_save = None
                print("[league] Reconnected — continuing same game session.")
                self.game_connected = True
                self.events.emit("game_start")
                return

            self._game_start_iso = datetime.now(timezone(timedelta())).isoformat()
            self.game_connected = True
            print("[league] Game detected — tracking started.")
            self.events.emit("game_start")

    def _on_disconnected(self) -> None:
        if not self.game_connected:
            return
        self.game_connected = False
        self.detector.reset()
        self._force_streak_reset()
        self.kill_audio_player.stop()
        end_iso = datetime.now(timezone(timedelta())).isoformat()
        start_iso = self._game_start_iso or end_iso

        # Delay the session save to tolerate transient disconnects.
        # If a reconnect happens within the grace period the same game
        # continues and the timer gets cancelled in _on_connected().
        def _deferred_save() -> None:
            self._pending_save = None
            _save_session(start_iso, end_iso)
            self._game_start_iso = None

        timer = threading.Timer(_RECONNECT_GRACE, _deferred_save)
        timer.daemon = True
        timer.start()
        self._pending_save = timer
        print("[league] Game ended or client closed.")
        self.events.emit("game_end")

    def _find_active_player(self, data: dict):
        """
        Returns (me, riot_game_name) where:
          me             — matching entry from allPlayers (has isDead, level, etc.)
          riot_game_name — short name WITHOUT the #tag, matches KillerName in events.

        activePlayer.summonerName is "Name#Tag" but KillerName in events is just
        "Name" (riotIdGameName).  We resolve that discrepancy here.
        """
        active = data.get("activePlayer", {})

        # riotIdGameName is the short name without #tag — matches KillerName in events
        riot_game_name = active.get("riotIdGameName", "").strip()

        # Fall back: strip #tag from summonerName for older API versions
        if not riot_game_name:
            raw = active.get("summonerName", "").strip()
            riot_game_name = raw.split("#")[0].strip()

        if not riot_game_name:
            return None, ""

        name_lower = riot_game_name.lower()

        for player in data.get("allPlayers", []):
            # allPlayers may have riotIdGameName; if not, derive from summonerName
            player_game_name = player.get("riotIdGameName", "")
            if not player_game_name:
                raw = player.get("summonerName", "")
                player_game_name = raw.split("#")[0].strip()

            if player_game_name.strip().lower() == name_lower:
                return player, riot_game_name

        return None, riot_game_name

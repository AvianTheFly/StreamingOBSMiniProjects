# league/core/league_events.py


class LeagueEvents:
    def __init__(self):
        self._handlers = {
            # ── Lifecycle ──────────────────────────────────────────────────
            "game_start":        [],
            "game_end":          [],

            # ── Player state ───────────────────────────────────────────────
            "death":             [],
            "respawn":           [],
            "respawn_3s":        [],
            "level_changed":     [],
            "recall_complete":   [],

            # ── Map events (from the events feed) ─────────────────────────
            "minions_spawning":  [],
            "first_brick":       [],
            "turret_killed":     [],
            "inhib_killed":      [],
            "dragon_kill":       [],
            "herald_kill":       [],
            "baron_kill":        [],
            "champion_kill":     [],   # you killed an enemy champion
            "assist":            [],   # you assisted an enemy champion kill
            "multikill":         [],   # double / triple / quadra / penta
            "ace":               [],
        }

    def register(self, event_name: str, handler) -> None:
        if event_name not in self._handlers:
            raise ValueError(f"Unknown event: {event_name!r}")
        self._handlers[event_name].append(handler)

    def emit(self, event_name: str, *args, **kwargs) -> None:
        from events import inspected_dispatch
        handlers = list(self._handlers.get(event_name, []))
        with inspected_dispatch('league:' + event_name, handlers, owner='league') as report:
            for handler in handlers:
                failed = False
                try:
                    handler(*args, **kwargs)
                except Exception as e:
                    failed = True
                    print(f"[league] Handler error ({event_name}): {e}")
                finally:
                    report(handler, failed=failed)

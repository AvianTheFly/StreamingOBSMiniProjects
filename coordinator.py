"""
coordinator.py
==============
Central play coordinator — mediates between mini-projects to prevent
simultaneous playback conflicts.

Workflow
--------
1. A project that wants to play calls request_to_play(requester, on_ready).
2. The coordinator looks up which other projects must pause first (from rules).
3. It calls iface.pause() on each of them and waits for all to return.
4. It emits coordinator.play_cleared and calls on_ready() — the requester plays.
5. When the requester finishes it calls announce_finished(requester).
6. The coordinator calls iface.resume() on the projects it paused.

Projects never touch each other directly.  All policy lives in hub_rules.py.

All coordination runs in a daemon thread so request_to_play() is non-blocking.
announce_finished() runs inline — pause/resume are both synchronous so no
extra thread is needed there.

Standard coordinator events (emitted on events.py bus for observability)
-------------------------------------------------------------------------
  "coordinator.project_paused"   payload: paused=str, requester=str
  "coordinator.play_cleared"     payload: requester=str, paused=list[str]
  "coordinator.project_resumed"  payload: resumed=str, requester=str
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field


@dataclass
class CoordinationRule:
    """
    Defines what must happen before `requester` is allowed to play.

    requester        — project name that wants to play
    pause            — projects that must pause before requester can proceed
    resume_on_finish — if True, paused projects are resumed when requester
                       calls announce_finished(); set to False for fire-and-
                       forget cases where you don't want an auto-resume
    """
    requester:        str
    pause:            list[str] = field(default_factory=list)
    resume_on_finish: bool      = True


class PlayCoordinator:
    """
    Mediates play requests between mini-projects.

    Rules are registered once at startup via hub_rules.py.
    At runtime, projects call request_to_play() and announce_finished().
    The coordinator only calls ProjectInterface.pause() and .resume() through
    the registry — it never reaches into project internals.
    """

    def __init__(self) -> None:
        self._rules: list[CoordinationRule] = []
        self._lock  = threading.Lock()

    # ── Rule management ───────────────────────────────────────────────────────

    def add_rule(self, rule: CoordinationRule) -> None:
        """Register a coordination rule.  Called once at startup from hub_rules.py."""
        with self._lock:
            self._rules.append(rule)

    def _rules_for(self, requester: str) -> list[CoordinationRule]:
        with self._lock:
            return [r for r in self._rules if r.requester == requester]

    def _projects_to_pause(self, requester: str) -> list[str]:
        """Deduplicated ordered list of projects that must pause for requester."""
        seen:   set[str]  = set()
        result: list[str] = []
        for rule in self._rules_for(requester):
            for name in rule.pause:
                if name not in seen:
                    seen.add(name)
                    result.append(name)
        return result

    def _projects_to_resume(self, requester: str) -> list[str]:
        """Deduplicated ordered list of projects to resume after requester finishes."""
        seen:   set[str]  = set()
        result: list[str] = []
        for rule in self._rules_for(requester):
            if rule.resume_on_finish:
                for name in rule.pause:
                    if name not in seen:
                        seen.add(name)
                        result.append(name)
        return result

    # ── Runtime API ───────────────────────────────────────────────────────────

    def request_to_play(
        self,
        requester: str,
        on_ready: callable,
    ) -> None:
        """
        Announce intent to play.

        Non-blocking: all coordination (pause calls + event emissions) runs in
        a daemon thread.  on_ready() is called from that thread once every
        required project has paused.

        If no rules apply to `requester`, on_ready() is called immediately in
        the same daemon thread (no-op coordination path).
        """
        def _coordinate() -> None:
            import events
            from shared import project_registry

            to_pause = self._projects_to_pause(requester)

            if to_pause:
                print(
                    f"[coordinator] '{requester}' requested play — "
                    f"waiting for: {to_pause}"
                )

            for project_name in to_pause:
                iface = project_registry.get(project_name)
                if iface is None:
                    print(
                        f"[coordinator] '{project_name}' not registered "
                        f"— skipping pause request"
                    )
                    continue
                try:
                    iface.pause()
                    print(f"[coordinator] '{project_name}' confirmed paused ✓")
                    events.emit(
                        "coordinator.project_paused",
                        paused=project_name,
                        requester=requester,
                    )
                except Exception as exc:
                    print(
                        f"[coordinator] pause failed for '{project_name}': {exc}"
                    )

            if to_pause:
                events.emit(
                    "coordinator.play_cleared",
                    requester=requester,
                    paused=to_pause,
                )
                print(
                    f"[coordinator] All conditions met — "
                    f"'{requester}' cleared to play."
                )

            on_ready()

        threading.Thread(
            target=_coordinate,
            daemon=True,
            name=f"coordinator:{requester}",
        ).start()

    def clear_rules(self) -> None:
        """Remove all registered rules (called by UI when replacing rule set)."""
        with self._lock:
            self._rules.clear()

    def get_rules(self) -> list[CoordinationRule]:
        """Return a snapshot of all currently registered rules."""
        with self._lock:
            return list(self._rules)

    def announce_finished(self, requester: str) -> None:
        """
        Announce that a play session has ended.

        Resumes every project that was paused for this requester (where
        resume_on_finish=True).  Runs inline — pause() and resume() are both
        synchronous so no extra thread is needed.
        """
        import events
        from shared import project_registry

        to_resume = self._projects_to_resume(requester)

        for project_name in to_resume:
            iface = project_registry.get(project_name)
            if iface is None:
                continue
            try:
                iface.resume()
                print(
                    f"[coordinator] '{project_name}' resumed after "
                    f"'{requester}' finished."
                )
                events.emit(
                    "coordinator.project_resumed",
                    resumed=project_name,
                    requester=requester,
                )
            except Exception as exc:
                print(
                    f"[coordinator] resume failed for '{project_name}': {exc}"
                )


# ── Module-level singleton ────────────────────────────────────────────────────
# Import and use this everywhere:
#     from coordinator import coordinator
coordinator = PlayCoordinator()

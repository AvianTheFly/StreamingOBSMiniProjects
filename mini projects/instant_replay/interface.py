# instant_replay/interface.py
"""
ProjectInterface for instant_replay.

_live is populated by main.py after the replay state and helpers are defined:
    _live["replay_active"] = _replay_active   # list[bool] — True while replay plays
    _live["end_replay"]    = _end_replay      # callable(cancelled=True) — stops replay
"""
from __future__ import annotations

from shared import ProjectInterface, ProjectStatus, project_registry

_live: dict = {}


class _InstantReplayInterface(ProjectInterface):
    name              = "instant_replay"
    controlled_scenes = ["InstantReplay"]

    def get_status(self) -> ProjectStatus:
        replay_active = _live.get("replay_active", [False])
        is_active     = bool(replay_active[0])
        return ProjectStatus(
            name             = self.name,
            is_active        = is_active,
            current_activity = "playing replay" if is_active else None,
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
        )

    def revert(self) -> None:
        end_replay = _live.get("end_replay")
        if end_replay:
            end_replay(cancelled=True)


interface = _InstantReplayInterface()
project_registry.register(interface)

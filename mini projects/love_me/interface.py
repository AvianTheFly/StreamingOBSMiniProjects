# love_me/interface.py
"""
ProjectInterface for love_me.

_live is populated by main.py after the player is created:
    _live["player"] = player   # SequentialPlayer instance
"""
from __future__ import annotations

from shared import ProjectInterface, ProjectStatus, project_registry

_live: dict = {}


class _LoveMeInterface(ProjectInterface):
    name              = "love_me"
    controlled_scenes = ["LoveMe"]
    produces_audio    = True

    def get_status(self) -> ProjectStatus:
        player    = _live.get("player")
        is_active = bool(player and player.is_busy)
        activity  = None
        if is_active and player:
            with player.lock:
                idx   = player.current_index
                total = len(player.items)
            activity = f"playing item {idx}/{total}"
        return ProjectStatus(
            name             = self.name,
            is_active        = is_active,
            current_activity = activity,
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
        )

    def revert(self) -> None:
        player = _live.get("player")
        if player:
            player.abort()


interface = _LoveMeInterface()
project_registry.register(interface)

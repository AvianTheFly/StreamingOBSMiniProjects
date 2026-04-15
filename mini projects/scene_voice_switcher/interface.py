# scene_voice_switcher/interface.py
"""
ProjectInterface for scene_voice_switcher.

_live is populated by main.py after the active-source state is created:
    _live["active_source"] = active_source   # list[str | None]
    _live["hide_active"]   = <callable>      # hides the currently shown lobby source
"""
from __future__ import annotations

from shared import ProjectInterface, ProjectStatus, project_registry

_live: dict = {}


class _SceneVoiceSwitcherInterface(ProjectInterface):
    name              = "scene_voice_switcher"
    controlled_scenes = ["Lobbies", "Test"]

    def get_status(self) -> ProjectStatus:
        active_source = _live.get("active_source", [None])
        src           = active_source[0]
        is_active     = src is not None
        return ProjectStatus(
            name             = self.name,
            is_active        = is_active,
            current_activity = f"showing: {src}" if is_active else None,
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
        )

    def revert(self) -> None:
        hide_active = _live.get("hide_active")
        if hide_active:
            hide_active()


interface = _SceneVoiceSwitcherInterface()
project_registry.register(interface)

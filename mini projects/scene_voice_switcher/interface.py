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
        # Queue routing and OBS buttons can select a location independently of
        # voice commands. Report the actual scene instead of stale command data.
        src = None
        try:
            from obs.client import get_obs
            from lib.coordination.lobbies import lobby_catalog
            client = get_obs()
            program = client.get_current_program_scene().current_program_scene_name
            candidates, exclusions = lobby_catalog.snapshot('Lobbies')
            locations = (*candidates, *(n for n in exclusions if n.lower().endswith('lobby') or n=='Spirit Afterparty'))
            if program in locations:
                src = program
            elif program == 'Lobbies':
                src = next((i['sourceName'] for i in client.get_scene_item_list('Lobbies').scene_items
                            if i['sourceName'] in locations and i['sceneItemEnabled']), None)
        except Exception:
            pass
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

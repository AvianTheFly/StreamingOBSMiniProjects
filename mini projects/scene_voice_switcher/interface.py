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

    def workflow_state(self):
        controls = _live.get('session_controls')
        return {'session': controls.snapshot()} if controls else {}

    def present_lobby(self, *, expected_manual_revision=None):
        """Public handoff for an opening; stale manual intent cannot change the scene."""
        from .api import select_lobby
        controls = _live.get('session_controls')
        if controls is None:
            raise ValueError('Scene controls are still starting')
        return controls.present('lobby', lambda: select_lobby(screen_visible=False,
            expected_manual_revision=expected_manual_revision))

    def action_catalog(self):
        return [*super().action_catalog(),
                {'key': 'hold_scene', 'label': 'Hold this view'},
                {'key': 'follow_scenes', 'label': 'Follow automatic scenes'}]

    def run_action(self, action, **kwargs):
        controls = _live.get('session_controls')
        if action in {'hold_scene', 'follow_scenes'}:
            if controls is None:
                return {'ok': False, 'error': 'Scene controls are still starting'}
            result = controls.hold() if action == 'hold_scene' else controls.follow()
            return {'ok': True, 'session': result}
        return super().run_action(action, **kwargs)

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

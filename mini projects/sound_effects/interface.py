# sound_effects/interface.py
"""
ProjectInterface for sound_effects.

_live is populated by main.py after the hide helper is defined:
    _live["visible_sources"] = _visible_sources   # module-level set[str]
    _live["hide_all"]        = _hide_all_sfx      # callable — hides & clears the set
"""
from __future__ import annotations

from shared import ProjectInterface, ProjectStatus, project_registry

_live: dict = {}


class _SoundEffectsInterface(ProjectInterface):
    name              = "sound_effects"
    controlled_scenes = ["Sound Effects"]

    def get_status(self) -> ProjectStatus:
        visible   = _live.get("visible_sources") or set()
        is_active = bool(visible)
        activity  = f"playing: {', '.join(sorted(visible))}" if visible else None
        return ProjectStatus(
            name             = self.name,
            is_active        = is_active,
            current_activity = activity,
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
        )

    def revert(self) -> None:
        hide_all = _live.get("hide_all")
        if hide_all:
            hide_all()


interface = _SoundEffectsInterface()
project_registry.register(interface)

from __future__ import annotations

from lib.shared_media.media_project import create_project_interface
from shared import ProjectInterface, ProjectStatus, project_registry

from .runtime import enabled_profiles, live_state_for


for _profile in enabled_profiles():
    create_project_interface(
        project_name=_profile.key,
        controlled_scenes=[str(_profile.config_defaults().get("scene") or _profile.name)],
        live_state=live_state_for(_profile.key),
    )


class _MediaProfilesInterface(ProjectInterface):
    name = "media_profiles"
    controlled_scenes = [
        str(profile.config_defaults().get("scene") or profile.name)
        for profile in enabled_profiles()
    ]
    produces_audio = False

    def get_status(self) -> ProjectStatus:
        active = []
        for profile in enabled_profiles():
            visible = live_state_for(profile.key).get("visible_sources") or set()
            if visible:
                active.append(f"{profile.name}: {', '.join(sorted(visible))}")
        return ProjectStatus(
            name=self.name,
            is_active=bool(active),
            current_activity="; ".join(active) if active else None,
            controlled_scenes=self.controlled_scenes,
            can_revert=True,
        )

    def revert(self) -> None:
        for profile in enabled_profiles():
            hide_all = live_state_for(profile.key).get("hide_all")
            if hide_all:
                hide_all()


interface = _MediaProfilesInterface()
project_registry.register(interface)

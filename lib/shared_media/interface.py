"""Generic media adapter for the live project registry and Hub controls."""
from __future__ import annotations
import obs
from contextlib import nullcontext
from .controls import action_catalog


def create_project_interface(
    *,
    project_name: str,
    controlled_scenes: list[str],
    live_state: dict,
):
    from shared import ProjectInterface, ProjectStatus, project_registry

    _controlled_scenes = controlled_scenes

    class _GenericMediaInterface(ProjectInterface):
        name = project_name
        controlled_scenes = _controlled_scenes
        produces_audio = True

        def get_status(self) -> ProjectStatus:
            with live_state.get("visible_lock") or nullcontext():
                visible = set(live_state.get("visible_sources") or ())
            is_active = bool(visible)
            activity = f"playing: {', '.join(sorted(visible))}" if visible else None
            return ProjectStatus(
                name=self.name,
                is_active=is_active,
                current_activity=activity,
                controlled_scenes=self.controlled_scenes,
                can_revert=True,
                is_paused=bool(visible) and all(
                    obs.get_media_state(source) == "OBS_MEDIA_STATE_PAUSED" for source in tuple(visible)),
            )

        def revert(self) -> None:
            hide_all = live_state.get("hide_all")
            if hide_all:
                hide_all()

        def pause(self) -> None:
            action = live_state.get("run_action")
            if action:
                action("pause")

        def resume(self) -> None:
            action = live_state.get("run_action")
            if action:
                action("resume")

        def action_catalog(self) -> list[dict]:
            return action_catalog()

        def run_action(self, action: str, **kwargs) -> dict:
            runner = live_state.get("run_action")
            if not runner:
                return {"ok": False, "error": f"{self.name} is not running yet"}
            return runner(action, **kwargs)

        def volume_state(self) -> dict:
            getter = live_state.get("volume_state")
            return getter() if getter else {}

    interface = _GenericMediaInterface()
    project_registry.register(interface)
    return interface

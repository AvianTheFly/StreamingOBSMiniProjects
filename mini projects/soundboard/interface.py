from __future__ import annotations

from shared import ProjectInterface, ProjectStatus, project_registry

from .config import CONFIG
from .main import _live
from .player import SINGLE_SOURCE_NAME


class _SoundboardInterface(ProjectInterface):
    name = CONFIG.project_name
    controlled_scenes = [CONFIG.scene]
    produces_audio = True

    def get_status(self) -> ProjectStatus:
        player = _live.get("player")
        random_state = _live.get("rand_active", [False])
        playing = bool(player and player.is_busy)
        in_random = bool(random_state[0])
        activity = None
        if playing and player:
            stem = player.current_stem or ""
            activity = f"playing: {stem}"
            if in_random:
                activity += " [random]"
        elif in_random:
            activity = "random mode (idle between clips)"
        return ProjectStatus(
            name=self.name,
            is_active=playing or in_random,
            current_activity=activity,
            controlled_scenes=self.controlled_scenes,
            can_revert=True,
        )

    def revert(self) -> None:
        stop_random = _live.get("stop_random")
        if stop_random:
            stop_random()
        player = _live.get("player")
        if player:
            player.abort()

    def pause(self) -> None:
        player = _live.get("player")
        if player:
            player.pause()

    def resume(self) -> None:
        player = _live.get("player")
        if player:
            player.resume()

    def action_catalog(self) -> list[dict]:
        getter = _live.get("action_catalog")
        return getter() if getter else super().action_catalog()

    def run_action(self, action: str, **kwargs) -> dict:
        runner = _live.get("run_action")
        if not runner:
            return {"ok": False, "error": f"{self.name} is not running yet"}
        return runner(action, **kwargs)

    def volume_state(self) -> dict:
        getter = _live.get("volume_state")
        if getter:
            return getter()
        return {
            "profile": "default",
            "current_stem": None,
            "source_name": SINGLE_SOURCE_NAME,
        }


interface = _SoundboardInterface()
project_registry.register(interface)

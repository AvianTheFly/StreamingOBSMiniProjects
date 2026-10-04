from __future__ import annotations

from lib.project_runtime import project_registry
from lib.shared_media.player_interface import PlayerInterface

from .config import CONFIG
from .main import _live
from .player import SINGLE_SOURCE_NAME


class _SoundboardInterface(PlayerInterface):
    name = CONFIG.project_name
    controlled_scenes = [CONFIG.scene]

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

    def asset_catalog(self) -> list[dict]:
        getter = _live.get('asset_catalog')
        return getter() if getter else []

    def play_asset(self, source: str) -> dict:
        runner = _live.get('play_asset')
        if not runner:
            return {'ok': False, 'error': 'Soundboard is not ready.'}
        return runner(source)


interface = _SoundboardInterface(_live)
project_registry.register(interface)

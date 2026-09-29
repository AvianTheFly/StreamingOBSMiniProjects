# specific_song/interface.py
"""
ProjectInterface for specific_song.

_live is populated by main.py after the player and random-mode state are created:
    _live["player"]       = player           # SongPlayer instance
    _live["rand_active"]  = _rand_active     # list[bool] — True while random loop runs
    _live["stop_random"]  = _stop_random_mode  # callable — exits the random loop
"""
from __future__ import annotations

from lib.project_runtime import project_registry
from lib.shared_media.player_interface import PlayerInterface
from .player import SINGLE_SOURCE_NAME

_live: dict = {}


class _SpecificSongInterface(PlayerInterface):
    name              = "specific_song"
    controlled_scenes = ["SpecificSongs"]
    playing_attribute = "current_source"
    random_idle_activity = "random mode (idle between songs)"

    def volume_state(self) -> dict:
        player = _live.get("player")
        if not player:
            return {"profile": "default"}
        return {
            "profile": "default",
            "current_stem": player.current_stem or player.loaded_stem,
            "source_name": SINGLE_SOURCE_NAME,
            "shared_volume": True,
        }


interface = _SpecificSongInterface(_live)
project_registry.register(interface)

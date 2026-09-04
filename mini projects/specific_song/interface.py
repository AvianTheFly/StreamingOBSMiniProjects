# specific_song/interface.py
"""
ProjectInterface for specific_song.

_live is populated by main.py after the player and random-mode state are created:
    _live["player"]       = player           # SongPlayer instance
    _live["rand_active"]  = _rand_active     # list[bool] — True while random loop runs
    _live["stop_random"]  = _stop_random_mode  # callable — exits the random loop
"""
from __future__ import annotations

from shared import ProjectInterface, ProjectStatus, project_registry
from .player import SINGLE_SOURCE_NAME

_live: dict = {}


class _SpecificSongInterface(ProjectInterface):
    name              = "specific_song"
    controlled_scenes = ["SpecificSongs"]
    produces_audio    = True

    def get_status(self) -> ProjectStatus:
        player      = _live.get("player")
        rand_active = _live.get("rand_active", [False])
        playing     = bool(player and player.is_busy)
        in_random   = bool(rand_active[0])
        is_active   = playing or in_random

        activity = None
        if playing and player:
            src      = player.current_source or ""
            activity = f"playing: {src}"
            if in_random:
                activity += " [random]"
        elif in_random:
            activity = "random mode (idle between songs)"

        return ProjectStatus(
            name             = self.name,
            is_active        = is_active,
            current_activity = activity,
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
        )

    def revert(self) -> None:
        stop_random = _live.get("stop_random")
        if stop_random:
            stop_random()
        player = _live.get("player")
        if player:
            player.abort()

    def pause(self) -> None:
        """Pause playback at the current position (preserves song state for resume)."""
        player = _live.get("player")
        if player:
            player.pause()

    def resume(self) -> None:
        """Resume a paused song. No-op if not paused or idle."""
        player = _live.get("player")
        if player:
            player.resume()

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


interface = _SpecificSongInterface()
project_registry.register(interface)

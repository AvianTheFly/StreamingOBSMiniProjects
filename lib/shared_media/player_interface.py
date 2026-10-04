"""Shared Hub controls for modules with a player and optional random mode."""
from lib.project_runtime import ProjectInterface, ProjectStatus


class PlayerInterface(ProjectInterface):
    produces_audio = True
    playing_attribute = "current_stem"
    random_idle_activity = "random mode (idle between clips)"

    def __init__(self, live_state: dict):
        # Keep the dictionary itself: modules populate/replace players after import.
        self._live = live_state

    def get_status(self) -> ProjectStatus:
        player = self._live.get("player")
        playing = bool(player and player.is_busy)
        in_random = bool(self._live.get("rand_active", [False])[0])
        activity = None
        if playing and player:
            activity = f"playing: {getattr(player, self.playing_attribute) or ''}"
            if in_random:
                activity += " [random]"
        elif in_random:
            activity = self.random_idle_activity
        return ProjectStatus(
            name=self.name,
            is_active=playing or in_random,
            current_activity=activity,
            controlled_scenes=self.controlled_scenes,
            can_revert=True,
            is_paused=bool(player and player.is_paused),
        )

    def revert(self) -> None:
        stop_random = self._live.get("stop_random")
        if stop_random:
            stop_random()
        player = self._live.get("player")
        if player:
            player.abort()

    def pause(self) -> None:
        player = self._live.get("player")
        if player:
            player.pause()

    def resume(self) -> None:
        player = self._live.get("player")
        if player:
            player.resume()

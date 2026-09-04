# league/interface.py
"""
ProjectInterface for league.

_live is populated by main.py after the watcher is created:
    _live["watcher"] = watcher   # LeagueAPIWatcher instance

revert() hides all overlay sources defined in config.  It does not stop the
watcher (which is passive — it just reads the League API and reacts).

Scene ownership
---------------
league owns the "LeagueGameAssets" scene and one dedicated audio source in
"Sound Effects" for kill/assist callouts.
  - Scene switching ("Test" / "Lobbies") is owned by scene_voice_switcher.
    league triggers it via  events.emit("game.connected") / events.emit("game.disconnected")
"""
from __future__ import annotations

import obs
from shared import ProjectInterface, ProjectStatus, project_registry

_live: dict = {}

# All (scene, source) pairs that league may show during a game.
# Only includes sources in scenes that league controls directly.
_OVERLAY_SOURCES: list[tuple[str, str]] = [
    ("LeagueGameAssets", "DeathBorder"),
    ("LeagueGameAssets", "RespawnBorder"),
    ("LeagueGameAssets", "levelupSprite1"),
    ("LeagueGameAssets", "levelupSprite2"),
    ("LeagueGameAssets", "ChampionKillOverlay"),
    ("LeagueGameAssets", "DoubleKillOverlay"),
    ("LeagueGameAssets", "TripleKillOverlay"),
    ("LeagueGameAssets", "QuadraKillOverlay"),
    ("LeagueGameAssets", "PentaKillOverlay"),
    ("LeagueGameAssets", "AceOverlay"),
    ("LeagueGameAssets", "DragonKillOverlay"),
    ("LeagueGameAssets", "HeraldKillOverlay"),
    ("LeagueGameAssets", "BaronKillOverlay"),
    ("LeagueGameAssets", "TurretKilledOverlay"),
    ("LeagueGameAssets", "InhibKilledOverlay"),
    ("LeagueGameAssets", "FirstBrickOverlay"),
    ("LeagueGameAssets", "MinionsSpawningOverlay"),
    ("LeagueGameAssets", "GameStartOverlay"),
    ("LeagueGameAssets", "KillStreakLogo"),
    ("LeagueGameAssets", "BearTriangle"),
    ("LeagueGameAssets", "TurtleTriangle"),
    ("LeagueGameAssets", "RamTriangle"),
    ("LeagueGameAssets", "PhoenixTriangle"),
    ("Test", "LeagueHudUdyrAnimation"),
]


class _LeagueInterface(ProjectInterface):
    name              = "league"
    controlled_scenes = ["LeagueGameAssets", "Sound Effects"]
    produces_audio    = True

    def get_status(self) -> ProjectStatus:
        watcher   = _live.get("watcher")
        is_active = bool(watcher and getattr(watcher, "game_connected", False))
        return ProjectStatus(
            name             = self.name,
            is_active        = is_active,
            current_activity = "game in progress" if is_active else None,
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
        )

    def revert(self) -> None:
        """Hide every overlay source in LeagueGameAssets — best-effort sweep."""
        for scene, source in _OVERLAY_SOURCES:
            try:
                obs.hide_source(scene, source)
            except Exception:
                pass
        player = _live.get("kill_audio_player")
        if player:
            player.stop()

    def volume_state(self) -> dict:
        player = _live.get("kill_audio_player")
        if not player:
            return {"profile": "default"}
        return player.volume_state()


interface = _LeagueInterface()
project_registry.register(interface)

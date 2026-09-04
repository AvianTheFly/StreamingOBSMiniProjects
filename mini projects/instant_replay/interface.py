# instant_replay/interface.py
"""
ProjectInterface for instant_replay.

_live is populated by main.py after the replay state and helpers are defined:
    _live["replay_active"] = _replay_active   # list[bool] — True while replay plays
    _live["end_replay"]    = _end_replay      # callable(cancelled=True) — stops replay
"""
from __future__ import annotations

import threading

from shared import ProjectInterface, ProjectStatus, project_registry

_live: dict = {}


class _InstantReplayInterface(ProjectInterface):
    name              = "instant_replay"
    controlled_scenes = ["InstantReplay"]
    produces_audio    = True

    def get_status(self) -> ProjectStatus:
        replay_active = _live.get("replay_active", [False])
        replay_paused = _live.get("replay_paused", [False])
        is_active     = bool(replay_active[0])
        is_paused     = bool(replay_paused[0]) if is_active else False
        return ProjectStatus(
            name             = self.name,
            is_active        = is_active,
            current_activity = "paused replay" if is_paused else ("playing replay" if is_active else None),
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
        )

    def revert(self) -> None:
        end_replay = _live.get("end_replay")
        if end_replay:
            end_replay(cancelled=True)

    def pause(self) -> None:
        pause_replay = _live.get("pause_replay")
        if pause_replay:
            pause_replay()

    def resume(self) -> None:
        resume_replay = _live.get("resume_replay")
        if resume_replay:
            resume_replay()

    def action_catalog(self) -> list[dict]:
        return [
            {"key": "play_latest", "label": "Play Latest", "description": "Play the newest saved clip."},
            {"key": "play_random", "label": "Play Random", "description": "Play any saved clip at random."},
            {"key": "play_highlights", "label": "Play Highlights", "description": "Play clips from the current or previous game."},
            {"key": "save", "label": "Save Replay", "description": "Save the current OBS replay buffer."},
            {"key": "mark", "label": "Mark Start", "description": "Mark the start point for the next saved clip."},
            {"key": "pause", "label": "Pause", "description": "Pause the current replay."},
            {"key": "resume", "label": "Resume", "description": "Resume the current replay."},
            {"key": "revert", "label": "Stop Replay", "description": "Stop replay and return to the normal scene."},
        ]

    def run_action(self, action: str, **kwargs) -> dict:
        if action in {"pause", "resume", "revert"}:
            return super().run_action(action, **kwargs)
        if action == "mark":
            handler = _live.get("mark")
            if handler:
                handler()
                return {"ok": True, "action": action}
        elif action == "save":
            handler = _live.get("save_clip")
            if handler:
                handler()
                return {"ok": True, "action": action}
        elif action in {"play_latest", "play_random", "play_highlights"}:
            handler = _live.get("play_spec")
            if handler:
                spec = {
                    "play_latest": "last",
                    "play_random": "random",
                    "play_highlights": "highlights",
                }[action]
                threading.Thread(
                    target=handler,
                    args=(spec,),
                    daemon=True,
                    name=f"instant_replay:{action}",
                ).start()
                return {"ok": True, "action": action}
        return {"ok": False, "error": "Instant Replay is not ready yet."}


interface = _InstantReplayInterface()
project_registry.register(interface)

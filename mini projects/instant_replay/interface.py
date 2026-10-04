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

    def clip_catalog(self):
        """Public saved-media contract for other presentations; no playback state."""
        from .api import clips
        return clips(purpose='highlight')

    def clip_selection(self, paths):
        """Validate every requested file through the replay library owner."""
        from . import library
        from .config import REPLAY_DIR
        labels = library.read()['clips']
        from lib.asset_fader import AssetFader
        from pathlib import Path
        levels = AssetFader('InstantReplayMedia', Path(__file__).with_name('asset_volumes.json')).values()
        rows = []
        for path in paths:
            resolved = library.resolve(str(path), REPLAY_DIR)
            volume_source = library.volume_source(resolved, labels, levels)
            level_key = str(Path(volume_source).resolve()).casefold() if volume_source else ''
            rows.append(dict(path=str(resolved), title=labels.get(library.clip_id(resolved), {}).get('title')
                             or resolved.name, volume_db=levels.get(str(resolved).casefold(), levels.get(level_key))))
        return rows

    def get_status(self) -> ProjectStatus:
        from .stage import state as stage_state
        replay_active = _live.get("replay_active", [False])
        replay_paused = _live.get("replay_paused", [False])
        is_active     = bool(replay_active[0])
        is_paused     = bool(replay_paused[0]) if is_active else False
        detail = _live.get("playback_detail", {})
        stage = stage_state()
        kind = stage.get("kind", "clip")
        noun = {"replay": "replay", "highlights": "highlights", "clip": "recorded clip"}.get(kind, "clips")
        activity = f"{'paused' if is_paused else 'playing'} {noun}"
        if is_active and detail:
            activity += f" · {detail['index']}/{detail['total']} · {detail['name']}"
        return ProjectStatus(
            name             = self.name,
            is_active        = is_active,
            current_activity = activity if is_active else 'saving for replay' if stage.get('pending') else None,
            controlled_scenes= self.controlled_scenes,
            can_revert       = True,
            is_paused        = is_paused,
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
            {"key": "quick_replay", "label": "Replay This Moment", "description": "Replay the last 15 seconds locally. No Twitch clip or highlight candidate."},
            {"key": "play_replay", "label": "Replay Latest", "description": "Show the latest capture as an instant replay."},
            {"key": "save_replay", "label": "Save & Replay", "description": "Save this moment and replay the finished cut with the live view."},
            {"key": "play_showcase", "label": "Showcase Latest", "description": "Show the newest saved clip in the showcase layout."},
            {"key": "play_latest", "label": "Play Latest Clip", "description": "Play the newest clip with a fresh or archive label."},
            {"key": "play_random", "label": "Shuffle Clips", "description": "Keep playing saved clips at random until stopped."},
            {"key": "play_highlights", "label": "Play Highlights", "description": "Play clips from the current or previous game."},
            {"key": "save", "label": "Save Replay", "description": "Save the OBS replay buffer and request a Twitch clip."},
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
        elif action in ('save_replay', 'quick_replay'):
            handler = _live.get(action)
            if handler:
                accepted = handler()
                return {'ok': bool(accepted), 'action': action,
                        **({} if accepted else {'error': 'A save or replay is already in progress.'})}
        elif action == "save":
            handler = _live.get("save_clip")
            if handler:
                accepted = handler()
                return {"ok": bool(accepted), "action": action,
                        **({} if accepted else {'error': 'A capture is already saving.'})}
        elif action in {"play_replay", "play_latest", "play_random", "play_highlights", "play_showcase"}:
            handler = _live.get("play_spec")
            if handler:
                spec = {
                    "play_replay": "replay",
                    "play_showcase": "showcase",
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

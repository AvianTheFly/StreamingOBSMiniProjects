# league/handlers/lifecycle.py
#
# Handlers for game-level lifecycle events: game detected and game ended.
#
# Scene switching is intentionally NOT done here.  When a game starts or ends,
# this module emits hub events ("game.connected" / "game.disconnected") and
# scene_voice_switcher subscribes to those events and performs the actual switch.
# This keeps each project responsible for its own scenes.

import obs
import events as hub_events

from ..config import (
    GAME_START_SCENE, GAME_START_SOURCE, GAME_START_DURATION, GAME_START_ENABLED,
    DEATH_SCENE, DEATH_SOURCE,
    RESPAWN_SCENE, RESPAWN_SOURCE,
    CHAMPION_KILL_BORDER_SCENE, CHAMPION_KILL_BORDER_SOURCE,
    UDYR_ANIMATION_SCENE, UDYR_ANIMATION_SOURCE,
)
from ..utils import show_overlay


def make_game_start_handler():
    def handle_game_start():
        print("[league] Game detected — notifying hub.")
        # Notify other projects (scene_voice_switcher will switch to game scene).
        hub_events.emit("game.connected")

        try:
            obs.show_source(UDYR_ANIMATION_SCENE, UDYR_ANIMATION_SOURCE)
        except Exception as e:
            print(f"[league] Game start error (Udyr animation): {e}")

        if not GAME_START_ENABLED or GAME_START_SOURCE is None:
            return
        try:
            show_overlay(GAME_START_SCENE, GAME_START_SOURCE, GAME_START_DURATION)
        except Exception as e:
            print(f"[league] Game start overlay error: {e}")

    return handle_game_start


def make_game_end_handler():
    def handle_game_end():
        print("[league] Game ended — hiding overlays, notifying hub.")

        # Hide all border overlays that league owns.
        for source in (DEATH_SOURCE, RESPAWN_SOURCE, CHAMPION_KILL_BORDER_SOURCE):
            try:
                obs.hide_source(DEATH_SCENE, source)
            except Exception as e:
                print(f"[league] Failed to hide {source}: {e}")

        try:
            obs.hide_source(UDYR_ANIMATION_SCENE, UDYR_ANIMATION_SOURCE)
        except Exception as e:
            print(f"[league] Game end error (Udyr animation): {e}")

        # Notify other projects (scene_voice_switcher will switch back to lobby).
        hub_events.emit("game.disconnected")

    return handle_game_end

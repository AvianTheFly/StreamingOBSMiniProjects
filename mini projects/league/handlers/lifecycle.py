# league/handlers/lifecycle.py
#
# Handlers for game-level lifecycle events: game detected and game ended.
#
# Scene switching is intentionally NOT done here.  When a game starts or ends,
# league_api publishes the artwork-clock boundaries through the shared contract.
# Standalone League falls back to emitting the same hub lifecycle events.
# This keeps each project responsible for its own scenes.

import obs
import events as hub_events
from lib.coordination.game_policy import game_scene_policy

from ..config import (
    GAME_START_SCENE, GAME_START_SOURCE, GAME_START_DURATION, GAME_START_ENABLED,
    DEATH_SCENE, DEATH_SOURCE,
    RESPAWN_SCENE, RESPAWN_SOURCE,
    CHAMPION_KILL_BORDER_SCENE, CHAMPION_KILL_BORDER_SOURCE,
)
from ..utils import show_overlay


def make_game_start_handler():
    def handle_game_start():
        print("[league] Game detected — notifying hub.")
        # In the Hub the image owner already published this boundary.
        if game_scene_policy.match_state() is None:
            hub_events.emit("game.connected")

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

        # Notify other projects (scene_voice_switcher will switch back to lobby).
        if game_scene_policy.match_state() is None:
            hub_events.emit("game.disconnected")

    return handle_game_end

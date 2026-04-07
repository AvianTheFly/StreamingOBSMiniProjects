# league/game_start_handler.py
# Triggered once when the API first becomes reachable (game detected).

import threading
import obs
from .config import (
    GAME_START_SCENE, GAME_START_SOURCE,
    GAME_START_DURATION, GAME_START_ENABLED,
)


def make_game_start_handler():
    def handle_game_start():
        print("[league] Game start detected — switching to 'Test'.")
        try:
            obs.switch_scene("Test")
        except Exception as e:
            print(f"[league] Scene switch on game start failed: {e}")

        # Existing overlay toggle (separate from scene switch)
        if not GAME_START_ENABLED or GAME_START_SOURCE is None:
            return
        try:
            if GAME_START_DURATION is None:
                obs.show_source(GAME_START_SCENE, GAME_START_SOURCE)
            else:
                threading.Thread(
                    target=obs.toggle_source,
                    args=(GAME_START_SCENE, GAME_START_SOURCE, GAME_START_DURATION),
                    daemon=True,
                ).start()
        except Exception as e:
            print(f"[league] Game start overlay error: {e}")

    return handle_game_start

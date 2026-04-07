# league/respawn_sfx_handler.py
# Play "Halo Respawn" sound via OBS "Sound Effects" scene when respawnTimer hits 3 seconds.

import threading

import obs
from .config import RESPAWN_SFX_SCENE, RESPAWN_SFX_SOURCE


def _play_respawn_sfx() -> None:
    try:
        # Show the source first (audio won't play if it's hidden)
        obs.show_source(RESPAWN_SFX_SCENE, RESPAWN_SFX_SOURCE)
        obs.restart_media(RESPAWN_SFX_SOURCE)
        # Hide it once the audio file finishes
        obs.wait_for_media_end(RESPAWN_SFX_SOURCE, start_timeout=5.0, total_timeout=30.0)
        obs.hide_source(RESPAWN_SFX_SCENE, RESPAWN_SFX_SOURCE)
    except Exception as e:
        print(f"[league] Respawn SFX error: {e}")


def make_respawn_sfx_handler():
    def handle_respawn_sfx(player_data):
        print("[league] Respawn in 3 seconds — playing Halo Respawn SFX.")
        threading.Thread(target=_play_respawn_sfx, daemon=True).start()

    return handle_respawn_sfx

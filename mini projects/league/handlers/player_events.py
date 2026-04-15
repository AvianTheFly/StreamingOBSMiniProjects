# league/handlers/player_events.py
#
# Handlers for player state changes: death, respawn, respawn SFX, recall.
#
# The Halo Respawn SFX is played via the "sfx.play" hub event rather than
# directly touching the Sound Effects OBS scene.  sound_effects subscribes to
# that event and owns all interaction with that scene.

import threading

import obs
import events as hub_events

from ..config import (
    DEATH_SCENE, DEATH_SOURCE,
    RESPAWN_SCENE, RESPAWN_SOURCE, RESPAWN_DISPLAY_DURATION,
    RESPAWN_SFX_SOURCE,
    UDYR_ANIMATION_SCENE, UDYR_ANIMATION_SOURCE,
)
from ..utils import show_overlay


def make_death_handler():
    def handle_death(player_data):
        print("[league] Died — showing death border, hiding Udyr animation.")
        try:
            obs.show_source(DEATH_SCENE, DEATH_SOURCE)
        except Exception as e:
            print(f"[league] Death handler error: {e}")
        try:
            obs.hide_source(UDYR_ANIMATION_SCENE, UDYR_ANIMATION_SOURCE)
        except Exception as e:
            print(f"[league] Death handler error (Udyr animation): {e}")
    return handle_death


def make_respawn_handler():
    def handle_respawn(player_data):
        print("[league] Respawned — hiding death border, showing respawn border, restoring Udyr animation.")
        try:
            obs.hide_source(DEATH_SCENE, DEATH_SOURCE)
        except Exception as e:
            print(f"[league] Respawn handler error (hide death border): {e}")
        try:
            show_overlay(RESPAWN_SCENE, RESPAWN_SOURCE, RESPAWN_DISPLAY_DURATION)
        except Exception as e:
            print(f"[league] Respawn handler error (show respawn border): {e}")
        try:
            obs.show_source(UDYR_ANIMATION_SCENE, UDYR_ANIMATION_SOURCE)
        except Exception as e:
            print(f"[league] Respawn handler error (Udyr animation): {e}")
    return handle_respawn


def make_respawn_sfx_handler():
    def handle_respawn_sfx(player_data):
        print("[league] Respawn in 3 s — requesting Halo Respawn SFX.")
        # Delegate to sound_effects via the hub event bus.
        # concurrent=True so the respawn sound layers over any SFX that is already
        # playing rather than interrupting it.
        hub_events.emit("sfx.play", source=RESPAWN_SFX_SOURCE.lower(), concurrent=True)
    return handle_respawn_sfx


def make_recall_complete_handler():
    def handle_recall_complete():
        print("[league] Recall complete — showing respawn border.")
        try:
            show_overlay(RESPAWN_SCENE, RESPAWN_SOURCE, RESPAWN_DISPLAY_DURATION)
        except Exception as e:
            print(f"[league] Recall complete handler error: {e}")
    return handle_recall_complete

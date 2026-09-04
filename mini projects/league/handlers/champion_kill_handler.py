# league/handlers/champion_kill_handler.py
#
# Triggered when the local player kills an enemy champion.
# (Filtering by KillerName == active player is done in game_state_detector.)
#
# On each kill two things happen:
#   1. The RespawnBorder flashes briefly (CHAMPION_KILL_BORDER_DURATION seconds).
#   2. A random unrevealed triangle from KILL_STREAK_SOURCES is shown.
#
# Kill streak triangle rules:
#   - Each kill reveals one random triangle that hasn't been shown yet.
#   - If KILL_STREAK_TIMEOUT seconds pass without another kill, all triangles
#     are hidden and the streak resets.
#   - Once all 4 triangles are revealed the timer stops — they stay visible
#     until the next kill resets the whole thing (which immediately starts
#     revealing again from zero).

import random
import threading

import obs
from ..config import (
    CHAMPION_KILL_ENABLED, ASSIST_KILL_ENABLED,
    CHAMPION_KILL_BORDER_SCENE, CHAMPION_KILL_BORDER_SOURCE,
    CHAMPION_KILL_BORDER_DURATION,
    KILL_STREAK_SCENE, KILL_STREAK_SOURCES, KILL_STREAK_TIMEOUT, KILL_STREAK_LOGO,
)


def make_champion_kill_handler(kill_audio_player=None):
    # ── Streak state (lives inside the closure, protected by _lock) ───────────
    _lock              = threading.Lock()
    _revealed: list    = []      # sources currently visible
    _pool: list        = []      # sources not yet revealed this streak
    _expire_timer: list = [None] # one-element list so inner funcs can mutate it

    # ── Timer helpers ─────────────────────────────────────────────────────────

    def _cancel_timer():
        """Cancel pending expiry timer. Must be called while holding _lock."""
        t = _expire_timer[0]
        if t is not None:
            t.cancel()
            _expire_timer[0] = None

    def _arm_timer():
        """(Re)start the expiry countdown. Must be called while holding _lock."""
        _cancel_timer()
        t = threading.Timer(KILL_STREAK_TIMEOUT, _on_streak_expired)
        t.daemon = True
        t.start()
        _expire_timer[0] = t

    # ── Streak expiry ─────────────────────────────────────────────────────────

    def _on_streak_expired():
        """Called from a timer thread when KILL_STREAK_TIMEOUT elapses."""
        with _lock:
            to_hide = list(_revealed)
            _revealed.clear()
            _pool.clear()
            _expire_timer[0] = None

        if not to_hide:
            return

        print(f"[league] Kill streak expired — hiding {len(to_hide)} triangle(s).")
        for source in to_hide:
            try:
                obs.hide_source(KILL_STREAK_SCENE, source)
            except Exception as e:
                print(f"[league] Error hiding {source}: {e}")

        if KILL_STREAK_LOGO is not None:
            try:
                obs.hide_source(KILL_STREAK_SCENE, KILL_STREAK_LOGO)
                print(f"[league] Hidden KillStreakLogo")
            except Exception as e:
                print(f"[league] Error hiding {KILL_STREAK_LOGO}: {e}")

    # ── OBS actions ───────────────────────────────────────────────────────────

    def _flash_border():
        try:
            obs.toggle_source(
                CHAMPION_KILL_BORDER_SCENE,
                CHAMPION_KILL_BORDER_SOURCE,
                CHAMPION_KILL_BORDER_DURATION,
            )
        except Exception as e:
            print(f"[league] Border flash error: {e}")

    def _reveal_next_triangle():
        """
        Pick and show one random unrevealed triangle.
        If all 4 were already revealed, reset the streak first then reveal one.
        """
        with _lock:
            all_revealed = not _pool and len(_revealed) == len(KILL_STREAK_SOURCES)

            if all_revealed:
                # Previous streak completed — hide everything, start fresh
                to_hide = list(_revealed)
                _revealed.clear()
                _pool.extend(KILL_STREAK_SOURCES)
            else:
                to_hide = []

            if not _pool:
                # First call ever (pool not yet seeded)
                _pool.extend(KILL_STREAK_SOURCES)

            chosen = random.choice(_pool)
            _pool.remove(chosen)
            _revealed.append(chosen)

            # Stop the timer only when all 4 are now showing
            if not _pool:
                _cancel_timer()
            else:
                _arm_timer()

            reveal_count = len(_revealed)
            total        = len(KILL_STREAK_SOURCES)

        # Do OBS calls outside the lock
        for source in to_hide:
            try:
                obs.hide_source(KILL_STREAK_SCENE, source)
            except Exception as e:
                print(f"[league] Error hiding {source} on streak reset: {e}")

        print(f"[league] Revealing triangle: {chosen} ({reveal_count}/{total})")
        try:
            try:
                obs.show_source_animated(KILL_STREAK_SCENE, chosen)
            except Exception as e:
                print(f"[league] Animated show failed, falling back: {e}")
                obs.show_source(KILL_STREAK_SCENE, chosen)
        except Exception as e:
            print(f"[league] Error showing {chosen}: {e}")

        if KILL_STREAK_LOGO is not None:
            try:
                obs.show_source(KILL_STREAK_SCENE, KILL_STREAK_LOGO)
            except Exception as e:
                print(f"[league] Error showing {KILL_STREAK_LOGO}: {e}")

    # ── Public handlers ───────────────────────────────────────────────────────

    def handle_champion_kill(event: dict):
        if not CHAMPION_KILL_ENABLED:
            return
        victim = event.get("VictimName", "unknown")
        print(f"[league] You killed {victim}!")
        threading.Thread(target=_flash_border,         daemon=True).start()
        threading.Thread(target=_reveal_next_triangle, daemon=True).start()
        if kill_audio_player is not None:
            threading.Thread(target=kill_audio_player.play_random, daemon=True).start()

    def handle_assist(event: dict):
        if not ASSIST_KILL_ENABLED:
            return
        victim = event.get("VictimName", "unknown")
        print(f"[league] You assisted on {victim}!")
        threading.Thread(target=_flash_border,         daemon=True).start()
        threading.Thread(target=_reveal_next_triangle, daemon=True).start()
        if kill_audio_player is not None:
            threading.Thread(target=kill_audio_player.play_random, daemon=True).start()

    def force_streak_reset():
        """
        Immediately hide all triangles and the KillStreakLogo.
        Called when the game ends, on shutdown, or on disconnect so nothing
        is left visible.
        """
        with _lock:
            to_hide = list(_revealed)
            _revealed.clear()
            _pool.clear()
            _cancel_timer()

        for source in to_hide:
            try:
                obs.hide_source(KILL_STREAK_SCENE, source)
            except Exception as e:
                print(f"[league] Error hiding {source} on game end: {e}")

        if KILL_STREAK_LOGO is not None:
            try:
                obs.hide_source(KILL_STREAK_SCENE, KILL_STREAK_LOGO)
            except Exception as e:
                print(f"[league] Error hiding {KILL_STREAK_LOGO} on game end: {e}")

        print(f"[league] Kill streak assets cleared ({len(to_hide)} triangle(s) hidden).")

    return handle_champion_kill, handle_assist, force_streak_reset

from .level_up_effect import play_level_up_effect


def make_level_up_handler():
    def handle_level_up(player_data, old_level, new_level):
        print(f"[league] Level up detected — {old_level} -> {new_level}.")
        try:
            play_level_up_effect(new_level)
        except Exception as e:
            print(f"[league] Level up handler error: {e}")

    return handle_level_up
# love_me/player.py

import threading

from .config import (
    SCENE,
    ITEMS,
    POLL_INTERVAL,
    MEDIA_START_TIMEOUT,
    MEDIA_TOTAL_TIMEOUT,
)

import obs


class SequentialPlayer:
    def __init__(self):
        self.lock          = threading.Lock()
        self.is_busy       = False
        self.current_index = 0
        self.items         = ITEMS          # exposed so main.py can check length
        self._abort_flag   = False

    def hide_all_sources(self):
        obs.hide_sources(SCENE, [item["display_name"] for item in ITEMS])

    def play_next_item(self):
        with self.lock:
            if self.is_busy:
                return
            if self.current_index >= len(ITEMS):
                print("[love_me] Sequence complete — no more items.")
                return
            self.is_busy     = True
            self._abort_flag = False
            item             = ITEMS[self.current_index]

        display_name = item["display_name"]
        monitor_name = item["monitor_name"]

        try:
            print(
                f"[love_me] Playing {self.current_index + 1}/{len(ITEMS)}: "
                f"display='{display_name}'  monitor='{monitor_name}'"
            )

            self.hide_all_sources()
            obs.show_source(SCENE, display_name)

            finished = obs.wait_for_media_end(
                source        = monitor_name,
                poll_interval = POLL_INTERVAL,
                start_timeout = MEDIA_START_TIMEOUT,
                total_timeout = MEDIA_TOTAL_TIMEOUT,
            )

            obs.hide_source(SCENE, display_name)

            if self._abort_flag:
                print(f"[love_me] Aborted during: '{display_name}'")
            elif finished:
                print(f"[love_me] Finished: '{display_name}'")
            else:
                print(f"[love_me] Timeout/fallback: '{display_name}'")

            with self.lock:
                if not self._abort_flag:
                    self.current_index += 1

        except Exception as e:
            print(f"[love_me] Error playing '{display_name}': {e}")
        finally:
            with self.lock:
                self.is_busy = False

    def play_next_async(self):
        threading.Thread(target=self.play_next_item, daemon=True).start()

    def can_accept_trigger(self) -> bool:
        with self.lock:
            return not self.is_busy

    def abort(self):
        """
        Signal any in-progress playback to stop, hide all sources, reset index.
        Safe to call from any thread.
        """
        with self.lock:
            self._abort_flag   = True
            self.current_index = 0
        self.hide_all_sources()
        print("[love_me] Abort complete.")

    def abort_and_advance(self):
        """
        Stop current playback and immediately play the next item.
        Does NOT reset the index — advances it by one before playing.
        Safe to call from any thread.
        """
        with self.lock:
            self._abort_flag = True
            # Advance past the current item so play_next_item picks the right one.
            # play_next_item will increment again on finish, so we pre-set the
            # target index here and let the running thread's finally-block see
            # _abort_flag and skip its own increment.
            self.current_index += 1

        self.hide_all_sources()

        # Brief yield so the in-flight play_next_item thread can exit its loop
        # and release is_busy before we start the next item.
        import time
        deadline = time.monotonic() + 2.0
        while True:
            with self.lock:
                if not self.is_busy:
                    break
            if time.monotonic() > deadline:
                # Safety valve: force-clear and proceed anyway
                with self.lock:
                    self.is_busy = False
                break
            time.sleep(0.02)

        with self.lock:
            if self.current_index >= len(self.items):
                print("[love_me] Skip past end — resetting to item 1.")
                self.current_index = 0

        print("[love_me] Abort-and-advance complete, starting next item.")
        self.play_next_async()

    def print_config(self):
        print("[love_me] Items:")
        for i, item in enumerate(ITEMS, 1):
            print(f"  {i}. display='{item['display_name']}'  monitor='{item['monitor_name']}'")
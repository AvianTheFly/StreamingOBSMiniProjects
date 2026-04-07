# specific_song/trigger.py
#
# Local copy of the SequenceTrigger so this project is fully self-contained.
# Identical logic to love_me/trigger.py.

import time


class SequenceTrigger:
    """
    Fires when a specific sequence of characters is typed within max_interval seconds.

    Usage:
        t = SequenceTrigger(["i", "l", "i"], 0.6)
        if t.register_key(char):   # returns True exactly once per completed sequence
            handle_trigger()
    """

    def __init__(self, sequence: list[str], max_interval: float) -> None:
        self.sequence     = [str(k) for k in sequence]
        self.max_interval = float(max_interval)
        self._buffer: list[str]  = []
        self._times:  list[float] = []

    def reset(self) -> None:
        self._buffer.clear()
        self._times.clear()

    def register_key(self, key: str) -> bool:
        """Feed one character. Returns True if the full sequence just completed."""
        now = time.time()
        self._buffer.append(str(key))
        self._times.append(now)

        # Keep buffer trimmed to sequence length
        if len(self._buffer) > len(self.sequence):
            self._buffer.pop(0)
            self._times.pop(0)

        if self._buffer == self.sequence:
            elapsed = self._times[-1] - self._times[0]
            if elapsed <= self.max_interval:
                self.reset()
                return True

        return False

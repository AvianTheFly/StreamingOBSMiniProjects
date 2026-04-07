# sound_effects/trigger.py

import time


class SequenceTrigger:
    """
    Fires when a specific sequence of characters is typed within max_interval seconds.
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
        now = time.time()
        self._buffer.append(str(key))
        self._times.append(now)

        if len(self._buffer) > len(self.sequence):
            self._buffer.pop(0)
            self._times.pop(0)

        if self._buffer == self.sequence:
            elapsed = self._times[-1] - self._times[0]
            if elapsed <= self.max_interval:
                self.reset()
                return True

        return False

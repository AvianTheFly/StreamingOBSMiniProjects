# love_me/trigger.py  (unchanged from original)

import time


class SequenceTrigger:
    def __init__(self, sequence, max_interval):
        self.sequence     = [str(x) for x in sequence]
        self.max_interval = float(max_interval)
        self.buffer       = []
        self.timestamps   = []

    def reset(self):
        self.buffer.clear()
        self.timestamps.clear()

    def register_key(self, key):
        key = str(key)
        now = time.time()

        self.buffer.append(key)
        self.timestamps.append(now)

        if len(self.buffer) > len(self.sequence):
            self.buffer.pop(0)
            self.timestamps.pop(0)

        if self.buffer == self.sequence:
            if self.timestamps[-1] - self.timestamps[0] <= self.max_interval:
                self.reset()
                return True

        return False

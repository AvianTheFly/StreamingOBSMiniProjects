"""Character-sequence matching only; no keyboard hooks or configuration I/O.

Keyboard capture belongs to lib.keyboard_worker/lib.global_hotkeys. Saved asset
bindings belong to lib.hotkeys. shared.SequenceTrigger remains a compatibility
export of the class defined here.
"""
import time


# ── Hotkey sequence trigger ───────────────────────────────────────────────────
#
# Any project that needs a typed key-sequence hotkey can use this directly:
#
#     from shared import SequenceTrigger
#     t = SequenceTrigger(["i", "l", "i"], 0.6)
#     if t.register_key(char):
#         handle_trigger()

class SequenceTrigger:
    """
    Fires when a specific sequence of characters is typed within
    max_interval seconds.  Returns True exactly once per completed sequence.
    """

    _SHIFT_EQUIV = {
        "~": "`",
        "!": "1",
        "@": "2",
        "#": "3",
        "$": "4",
        "%": "5",
        "^": "6",
        "&": "7",
        "*": "8",
        "(": "9",
        ")": "0",
        "_": "-",
        "+": "=",
        "{": "[",
        "}": "]",
        "|": "\\",
        ":": ";",
        "\"": "'",
        "<": ",",
        ">": ".",
        "?": "/",
    }

    def __init__(
        self,
        sequence: list,
        max_interval: float,
        *,
        strict_first_char: bool = True,
        shift_agnostic_tail: bool = True,
    ) -> None:
        self.sequence     = [str(k) for k in sequence]
        self.max_interval = float(max_interval)
        self.strict_first_char = bool(strict_first_char)
        self.shift_agnostic_tail = bool(shift_agnostic_tail)
        self._buffer: list = []
        self._times:  list = []

    def reset(self) -> None:
        self._buffer.clear()
        self._times.clear()

    def register_key(self, key: str) -> bool:
        """Feed one character. Returns True if the full sequence just completed."""
        now = time.time()
        self._buffer.append(str(key))
        self._times.append(now)

        if len(self._buffer) > len(self.sequence):
            self._buffer.pop(0)
            self._times.pop(0)

        if self._matches_buffer():
            elapsed = self._times[-1] - self._times[0]
            if elapsed <= self.max_interval:
                self.reset()
                return True

        return False

    @classmethod
    def _normalize_shift_agnostic(cls, value: str) -> str:
        if not value:
            return ""
        base = cls._SHIFT_EQUIV.get(value, value)
        return base.lower() if len(base) == 1 else str(base).lower()

    def _matches_buffer(self) -> bool:
        if len(self._buffer) != len(self.sequence):
            return False

        for index, (actual, expected) in enumerate(zip(self._buffer, self.sequence)):
            actual = str(actual)
            expected = str(expected)
            if index == 0 and self.strict_first_char:
                if actual != expected:
                    return False
                continue
            if self.shift_agnostic_tail:
                if self._normalize_shift_agnostic(actual) != self._normalize_shift_agnostic(expected):
                    return False
            elif actual != expected:
                return False
        return True



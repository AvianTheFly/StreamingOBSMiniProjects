"""Bounded speech measurements; the service owns capture deadlines and actions."""
from __future__ import annotations

import numpy as np

MAX_CAPTURE_SECONDS = 5.0


class SpeechActivity:
    """Sample the already bundled Silero detector on the microphone drain worker.

    A two-second rolling window provides model context. Only the newest frames
    contribute evidence; isolated clicks cannot establish speech. No idle audio,
    extra model, worker, or microphone is introduced.
    """
    RATE = 16000
    FRAME = 512
    INTERVAL = 4096
    WINDOW = 32768

    def __init__(self, model, sample_rate, started_at):
        self.model = model
        self.sample_rate = sample_rate
        self.started_at = started_at
        self.audio = np.empty(0, dtype=np.float32)
        self.pending = 0
        self.samples = 0
        self.speech_detected = False
        self.last_speech_at = None
        self._onset_frames = 0

    def feed(self, chunk):
        self.samples += len(chunk)
        self.pending += len(chunk)
        window = int(self.WINDOW * self.sample_rate / self.RATE)
        self.audio = np.concatenate((self.audio, chunk))[-window:]
        interval = int(self.INTERVAL * self.sample_rate / self.RATE)
        if self.pending < interval:
            return
        new_frames = max(1, int(self.pending * self.RATE / self.sample_rate) // self.FRAME)
        self.pending = 0
        audio = at_model_rate(self.audio, self.sample_rate)
        audio = audio[:len(audio) // self.FRAME * self.FRAME].copy()
        probabilities = np.asarray(self.model(audio)).reshape(-1)
        # Silero's batch implementation mutates its context view. Pass a copy
        # above so the rolling microphone evidence remains intact.
        newest = probabilities[-new_frames:]
        end_at = self.started_at + self.samples / self.sample_rate
        for index, probability in enumerate(newest):
            frame_at = end_at - (len(newest) - index - 1) * self.FRAME / self.RATE
            if not self.speech_detected:
                self._onset_frames = self._onset_frames + 1 if probability >= .6 else 0
                if self._onset_frames >= 3:
                    self.speech_detected = True
            if self.speech_detected and probability >= .35:
                self.last_speech_at = frame_at

    def snapshot(self):
        return {"speech_detected": self.speech_detected,
                "last_speech_at": self.last_speech_at}


def at_model_rate(audio, sample_rate):
    """Normalize the native-rate fallback for both endpoint detection and ASR."""
    if sample_rate == SpeechActivity.RATE:
        return audio
    from math import gcd
    from scipy.signal import resample_poly
    divisor = gcd(int(sample_rate), SpeechActivity.RATE)
    return resample_poly(audio, SpeechActivity.RATE // divisor,
                         int(sample_rate) // divisor).astype(np.float32)

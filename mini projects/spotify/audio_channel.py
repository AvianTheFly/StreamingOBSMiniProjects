"""One fixed latest-audio mailbox between the capture process and state owner."""
import time
import json

from .audio_analysis import quiet_features

SCALARS = ('bass', 'treble', 'energy', 'beat', 'pitch', 'tonality', 'width', 'balance', 'flux',
           'roughness', 'noisiness', 'texture_rate', 'loudness')
SIZE = 48 + 128 + 8 + 8 + 8 + len(SCALARS) + 4


class AudioChannel:
    def __init__(self, context, port=7447):
        self.lock = context.Lock()
        self.control_lock = context.Lock()
        self.values = context.Array('d', SIZE, lock=False)
        self.generation = context.Value('Q', 0, lock=False)
        self.audio_generation = context.Value('Q', 0, lock=False)
        self.pid = context.Value('i', 0, lock=False)
        self.error = context.Array('u', 512, lock=False)
        self.control = context.Array('u', 65536, lock=False)
        self.control_generation = context.Value('Q', 0, lock=False)
        self.port = context.Value('i', port, lock=False)
        self.ready = context.Event()

    def publish_control(self, media, hidden, updated):
        text = json.dumps(dict(media=media, hidden=hidden, updated=updated))
        with self.control_lock:
            self.control.value = text
            self.control_generation.value += 1

    def read_control(self, after):
        if not self.control_lock.acquire(timeout=.005):
            return None
        try:
            if self.control_generation.value == after:
                return None
            generation, text = self.control_generation.value, self.control.value
        finally:
            self.control_lock.release()
        return generation, json.loads(text)

    def set_status(self, pid, error=''):
        if not self.lock.acquire(block=False):
            return False
        try:
            self.pid.value = pid or 0
            self.error.value = str(error)[:511]
            self.generation.value += 1
        finally:
            self.lock.release()
        return True

    def publish_audio(self, bands, features, sample_end, analysis_ms, timestamp_valid):
        values = (list(bands) + features['waveform'] + features['voice_widths'] + features['voice_balances'] + features['voice_levels']
                  + [features[k] for k in SCALARS]
                  + [sample_end, analysis_ms, float(timestamp_valid), time.monotonic()])
        # Hub readers can be descheduled after taking an IPC lock. Never let
        # status observation stall the child-local capture/HTTP fast path.
        if not self.lock.acquire(block=False):
            return False
        try:
            self.values[:] = values
            self.audio_generation.value += 1
            self.generation.value += 1
        finally:
            self.lock.release()
        return True

    def read(self, after):
        # A reader never holds the mailbox across DSP, state publication or I/O.
        if not self.lock.acquire(timeout=.005):
            return None
        try:
            if self.generation.value == after:
                return None
            result = dict(generation=self.generation.value, audio_generation=self.audio_generation.value,
                          pid=self.pid.value, error=self.error.value, values=self.values[:])
        finally:
            self.lock.release()
        return result

    @staticmethod
    def unpack(values):
        features = quiet_features()
        features.update(waveform=values[48:176], voice_widths=values[176:184], voice_balances=values[184:192],
                        voice_levels=values[192:200])
        features.update(zip(SCALARS, values[200:200+len(SCALARS)]))
        return values[:48], features, values[-4], values[-3], bool(values[-2]), values[-1]

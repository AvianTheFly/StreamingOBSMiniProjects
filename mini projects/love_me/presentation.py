"""Feature presentation policy on the Hub-owned browser channel and OBS transport."""
import time
import json
import math
import obs
from lib.browser_effects.audio import prepare_audio
from lib.browser_effects.obs_source import attach, source_name
from lib.browser_effects.runtime import get_channel
from lib.project_settings import audio_settings_transaction

PROJECT = 'love_me'
SOURCE = source_name(PROJECT)


class MoodPresentation:
    def __init__(self, store):
        self.store = store
        self.channel = get_channel(PROJECT)
        self.loaded = None
        self.expected_db = None
        self.prepared = False

    def master_db(self, state=None):
        path=self.store.root/'hub_audio.json'
        state=state if state is not None else (json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else {})
        value=float(state.get('project_volume_db',0))+float(state.get('profile_volume_db',0))
        if not math.isfinite(value):
            raise ValueError('Love Me master volume must be finite.')
        return value

    def prepare(self):
        name = attach(PROJECT, 'LoveMe', 'OBS_MONITORING_TYPE_MONITOR_ONLY',
                      {str(n):n==1 for n in range(1,7)})
        # An existing browser can load the generic fallback before this feature
        # registers during Hub startup. A polling client alone cannot prove that
        # the authored renderer is loaded. Refresh once per feature lifetime.
        if not self.prepared:
            obs.get_obs().send('PressInputPropertiesButton',
                              dict(inputName=name, propertyName='refreshnocache'), raw=True)
            self.prepared = True
        return name

    @audio_settings_transaction
    def capture_fader(self):
        row = self.loaded
        if row is None or not self.channel.matches(row['id']):
            return
        value = (obs.get_input_volume(SOURCE) or {}).get('db')
        if value is None or not math.isfinite(value) or self.expected_db is None or abs(value-self.expected_db)<.06:
            return
        snapshot = self.store.snapshot()
        self.store.save(dict(id=row['id'], revision=snapshot['revision'],
                             changes={'volume_db':round(self.store.get(row['id'])['volume_db']+value-self.expected_db,2)}))
        self.expected_db = value

    @audio_settings_transaction
    def apply_audio_state(self,state):
        if self.loaded:
            row=self.store.get(self.loaded['id'])
            value=self.master_db(state)+row['volume_db']
            obs.set_input_volume_db(SOURCE,value)
            self.expected_db=value

    @audio_settings_transaction
    def _audio(self, row):
        self.capture_fader()
        row={**row,'volume_db':self.store.get(row['id'])['volume_db']}
        volume=self.master_db()+row['volume_db']
        obs.set_input_volume_db(SOURCE, volume)
        obs.set_input_audio_monitor_type(SOURCE, 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
                                        if row['record_audio'] else 'OBS_MONITORING_TYPE_MONITOR_ONLY')
        obs.set_input_audio_tracks(SOURCE, {str(n):n==(2 if row['record_audio'] else 1) for n in range(1,7)})
        self.loaded, self.expected_db = dict(row), volume

    def play(self, row, cancelled, allowed):
        file = self.store.audio_path(row)
        media = prepare_audio(file, cancelled=cancelled) if file else None
        if cancelled():
            return
        self.prepare()
        self._audio(row)
        if not self.channel.snapshot()['ready']:
            obs.get_obs().send('PressInputPropertiesButton',
                              dict(inputName=SOURCE, propertyName='refreshnocache'), raw=True)
        if cancelled():
            return
        identity = self.channel.begin(row['id'], media, {**row, 'audio':bool(media)})
        started = time.monotonic()
        try:
            while not self.channel.done.wait(.05):
                if cancelled():
                    return
                self.channel.pause(not allowed())
                active=self.channel.snapshot()['active']
                if not active:
                    return
                if not self.channel.started.is_set() and time.monotonic()-started>10:
                    raise RuntimeError('The OBS mood source did not start. Check that LoveMe is nested in your scene.')
                if active['elapsed']>row['duration']+10:
                    raise RuntimeError('Mood presentation exceeded its excerpt length.')
            if self.channel.error and not cancelled():
                raise RuntimeError('Audio could not play or the excerpt was too short. Check trim start, length and file format.')
        finally:
            self.channel.stop(identity)

    def pause(self, paused):
        self.channel.pause(paused)

    def stop(self):
        self.channel.stop()

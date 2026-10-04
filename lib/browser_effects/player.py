"""Adapter for synchronous module players. Source volume remains an OBS fader."""
from pathlib import Path
import time
import obs
from .audio import prepare_audio
from .runtime import get_channel
from .obs_source import attach, source_name
from .catalog import effect_for


class BrowserPlayer:
    def __init__(self, project, project_dir, scene, monitor, tracks):
        self.project, self.project_dir = project, Path(project_dir)
        self.scene, self.monitor, self.tracks = scene, monitor, tracks
        self.channel = get_channel(project)
        self.playback_id = None
        self.loaded = False

    @property
    def source(self):
        return source_name(self.project)

    def effect(self, stem):
        return effect_for(self.project_dir, stem)

    def play(self, stem, filepath, volume_db, cancelled, timeout, *, allowed=None):
        effect = self.effect(stem)
        if not effect:
            raise ValueError('No browser renderer mapped for this asset')
        media = prepare_audio(filepath, cancelled=cancelled)
        if cancelled():
            return
        attach(self.project, self.scene, self.monitor, self.tracks)
        if not self.channel.snapshot()['ready']:
            # OBS-first startup can leave an error page instead of our poll loop.
            obs.get_obs().send('PressInputPropertiesButton',
                dict(inputName=self.source, propertyName='refreshnocache'), raw=True)
        obs.set_input_mute(self.source, False)
        obs.set_input_volume_db(self.source, volume_db)
        if cancelled():
            return
        self.loaded = True
        self.playback_id = playback_id = self.channel.begin(stem, media, effect)
        started_at = time.monotonic()
        confirmed = False
        suspended = False
        try:
            while not self.channel.done.wait(.05):
                if cancelled():
                    return
                if allowed is not None and not allowed():
                    if not suspended:
                        self.pause(True)
                        suspended = True
                    continue
                if suspended:
                    self.pause(False)
                    suspended = False
                active = self.channel.snapshot()['active']
                elapsed = active['elapsed'] if active else time.monotonic()-started_at
                if self.channel.started.is_set() and not confirmed:
                    confirmed = True
                    print(f'[{self.project}] Browser audio started: {stem}', flush=True)
                if not self.channel.started.is_set() and elapsed > 8:
                    raise RuntimeError('OBS browser did not start audio. Ensure the effects source is active.')
                if elapsed > timeout:
                    raise RuntimeError('Browser effect exceeded playback timeout')
            if self.channel.error and not cancelled():
                raise RuntimeError(self.channel.error)
        finally:
            self.channel.stop(playback_id)
            self.playback_id = None

    def pause(self, paused):
        self.channel.pause(paused)

    def abort(self):
        self.channel.stop(self.playback_id)

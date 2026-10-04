"""Apply the current media/audio policy for an asset without owning its playback."""
from .controls import asset_volume_db


class SourceAudio:
    def __init__(self, cfg, active_settings, obs_api):
        self.cfg, self.active_settings, self.obs = cfg, active_settings, obs_api

    def volume_for(self, stem):
        return asset_volume_db(self.cfg, self.active_settings[0], stem)

    def configure_media(self, source):
        try:
            self.obs.configure_media_source_properties(source, restart_on_activate=False,
                close_when_inactive=True, looping=False, clear_on_media_end=False)
        except Exception as exc:
            print(f'[{self.cfg.project_name}] Could not set media properties for {source}: {exc}')

    def configure_audio(self, source, stem):
        operations = [(self.obs.set_input_mute, (source, False)),
                      (self.obs.set_input_audio_monitor_type, (source, self.cfg.monitor))]
        if self.cfg.audio_tracks:
            operations.append((self.obs.set_input_audio_tracks, (source, self.cfg.audio_tracks)))
        for action, args in operations:
            try:
                action(*args)
            except Exception as exc:
                print(f'[{self.cfg.project_name}] Could not configure audio for {source}: {exc}')
        self.obs.set_input_volume_db(source, self.volume_for(stem))

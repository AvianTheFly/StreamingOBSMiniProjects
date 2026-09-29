"""Recall an absolute OBS fader value for each replay file."""
import json
import math
from pathlib import Path
import obs


class AssetFader:
    def __init__(self, source, path):
        self.source, self.path = source, Path(path)

    def values(self):
        try:
            return json.loads(self.path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            return {}

    def loaded(self):
        settings = obs.get_obs().get_input_settings(self.source).input_settings
        file = settings.get('local_file')
        return str(Path(file).resolve()).casefold() if file else None

    def capture(self):
        key = self.loaded()
        volume = (obs.get_input_volume(self.source) or {}).get('db')
        if not key or volume is None or not math.isfinite(volume) or self.loaded() != key:
            return
        values = self.values()
        value = round(volume, 2)
        if values.get(key) == value:
            return
        values[key] = value
        temporary = self.path.with_suffix('.tmp')
        temporary.write_text(json.dumps(values, indent=2), encoding='utf-8')
        temporary.replace(self.path)

    def apply(self, file, *, fallback=None):
        key = str(Path(file).resolve()).casefold()
        values = self.values()
        volume = values.get(key)
        if volume is None and fallback:
            volume = values.get(str(Path(fallback).resolve()).casefold())
        if volume is not None and self.loaded() == key:
            obs.set_input_volume_db(self.source, volume)

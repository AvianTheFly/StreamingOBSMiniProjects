"""Asset-specific waiting-room levels with atomic personal-data persistence."""
import json
import math
from pathlib import Path
import obs
from lib.asset_fader import AssetFader
from lib.json_store import update_json
from lib.settings_backups import SettingsBackups


class ClipLevels(AssetFader):
    def values(self):
        values = json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {}
        if not isinstance(values, dict):
            raise ValueError('Clip levels need recovery; original data is untouched.')
        return values

    def capture(self):
        key = self.loaded()
        volume = (obs.get_input_volume(self.source) or {}).get('db')
        if not key or volume is None or not math.isfinite(volume) or self.loaded() != key:
            return
        value = round(volume, 2)
        if self.values().get(key) == value:
            return
        SettingsBackups().snapshot()
        def merge(current):
            if not isinstance(current, dict):
                raise ValueError('Clip levels are malformed; original data is untouched.')
            return {**current, key: value}
        update_json(self.path, merge, default={})

    def apply_row(self, row):
        key = str(Path(row['path']).resolve()).casefold()
        value = self.values().get(key, row.get('volume_db'))
        if value is None:
            value = -6.0
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError('Saved clip volume is invalid; original data is untouched.')
        if self.loaded() == key:
            obs.set_input_volume_db(self.source, value)

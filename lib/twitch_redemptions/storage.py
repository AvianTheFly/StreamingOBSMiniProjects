"""Persistent settings and redemption results; credentials stay outside Git."""
from __future__ import annotations

import json
from lib.json_store import write_json


class RewardStorage:
    def _read(self, name, fallback):
        try:
            return json.loads((self.root / name).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return fallback


    def _write(self, name, value):
        if name == 'settings.json':
            import os
            from pathlib import Path
            from lib.settings_backups import SettingsBackups
            default = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'StreamingHub' / 'viewer-rewards'
            if self.root == default:
                SettingsBackups().snapshot()
        write_json(self.root / name, value, ensure_ascii=True)


    def _result(self, rid, status):
        self.db.execute("UPDATE redemptions SET status=? WHERE id=?", (status, rid))
        self.db.commit()

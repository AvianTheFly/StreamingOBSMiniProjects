"""Version local settings outside Git; recover missing files without resetting edits."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import threading
import time

from lib.paths import PROJECT_ROOT


class SettingsBackups:
    def __init__(self, root=PROJECT_ROOT, backup_root=None):
        self.root = Path(root).resolve()
        identity = hashlib.sha256(str(self.root).encode()).hexdigest()[:12]
        self.backup_root = Path(backup_root) if backup_root else (
            Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) /
            'StreamingHub' / 'settings-history' / identity)
        self._seen: dict[Path, tuple[int, int]] = {}

    def paths(self):
        # Module data only. Never copy credentials, assets or model files.
        from lib.project_registry import SUPPORTED_RUNTIME_PROJECTS
        for module in sorted(SUPPORTED_RUNTIME_PROJECTS):
            yield from (self.root / 'mini projects' / module).glob('*.json')
        for name in ('hub_rules.json', 'hub_settings.json', 'chat_overlay_settings.json', 'chat_sticker_pack.json'):
            yield self.root / name

    def recover_missing(self):
        for latest in self.backup_root.glob('**/latest.json'):
            relative = latest.parent.relative_to(self.backup_root)
            if relative.parts[0] in {'_obs_scenes', '_twitch_redemptions'}:
                continue  # OBS collections are recovery copies, never auto-replaced.
            target = self.root / relative
            if target.exists():
                continue
            payload = latest.read_bytes()
            json.loads(payload)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
            print(f'[settings] Recovered missing settings: {relative}')

    def snapshot(self, *, changed_only=False):
        sources = [(p, p.relative_to(self.root)) for p in self.paths()]
        if self.root == PROJECT_ROOT and os.environ.get('LOCALAPPDATA'):
            reward_settings = Path(os.environ['LOCALAPPDATA']) / 'StreamingHub' / 'viewer-rewards' / 'settings.json'
            sources.append((reward_settings, Path('_twitch_redemptions') / 'settings.json'))
        if os.environ.get('APPDATA'):
            scenes = Path(os.environ['APPDATA']) / 'obs-studio' / 'basic' / 'scenes'
            sources += [(p, Path('_obs_scenes') / p.name) for p in scenes.glob('*.json')]
        for source, relative in sources:
            if source.name == 'twitch_config.json':
                continue
            try:
                stat = source.stat()
                marker = (stat.st_mtime_ns, stat.st_size)
                if changed_only and self._seen.get(source) == marker:
                    continue
                payload = source.read_bytes()
                json.loads(payload)  # Ignore partial writes; retry on next pass.
                folder = self.backup_root / relative
                latest = folder / 'latest.json'
                if latest.exists() and latest.read_bytes() == payload:
                    self._seen[source] = marker
                    continue
                folder.mkdir(parents=True, exist_ok=True)
                digest = hashlib.sha256(payload).hexdigest()[:12]
                version = folder / f'{time.time_ns()}-{digest}.json'
                version.write_bytes(payload)
                temporary = folder / 'latest.tmp'
                temporary.write_bytes(payload)
                temporary.replace(latest)
                self._seen[source] = marker
            except (OSError, ValueError):
                self._seen.pop(source, None)
                continue


def start_settings_backups(stop_event):
    history = SettingsBackups()
    history.recover_missing()
    history.snapshot()
    print(f'[settings] Versioned settings backups: {history.backup_root}')

    def watch():
        last_full = time.monotonic()
        while not stop_event.wait(2):
            now = time.monotonic()
            full = now - last_full >= 300
            history.snapshot(changed_only=not full)
            if full:
                last_full = now
        history.snapshot()

    threading.Thread(target=watch, name='settings-backups', daemon=True).start()
    return history

"""Live media profile selection and bindings; never writes personal settings."""
from pathlib import Path
import threading
from functools import wraps
from lib.snapshots import SnapshotMap

from lib.key_sequences import SequenceTrigger
from lib.project_settings import load_project_settings, load_project_profile_summaries
from .controls import normalize_interface_hotkeys, parse_sequences


def _serialized(method):
    @wraps(method)
    def call(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)
    return call


class RuntimeProfiles:
    def __init__(self, cfg, project_dir, *, loader=None, profile_parser=parse_sequences):
        self._lock = threading.RLock()
        self.cfg = cfg
        self.project_dir = Path(project_dir)
        self.hotkeys_file = self.project_dir / 'hotkeys.json'
        self.editor_file = self.project_dir / 'hotkeys_editor.json'
        self.loader = loader or self._load_settings
        self.profile_parser = profile_parser
        settings = self.loader(None)
        # Stable references used by playback callbacks and live status views.
        self.active_settings = [settings]
        self.active_profile_name = [settings.profile_name if settings else 'default']
        self.profile_triggers = SnapshotMap()
        self.action_triggers = SnapshotMap()
        self._stamp = None

    def _load_settings(self, profile):
        return load_project_settings(self.project_dir, hotkeys_file=self.hotkeys_file,
            asset_dir=self.cfg.asset_dir, valid_extensions=self.cfg.valid_extensions, profile=profile)

    def file_stamp(self):
        result = []
        for path in (self.hotkeys_file, self.editor_file):
            try:
                stat = path.stat()
                result.append((stat.st_mtime_ns, stat.st_size))
            except OSError:
                result.append(None)
        return tuple(result)

    def _publish(self, settings):
        self.active_settings[0] = settings
        self.active_profile_name[0] = settings.profile_name
        actions = {}
        for action, sequence in self.interface_hotkeys().items():
            parsed = parse_sequences(sequence)
            if parsed:
                actions[action] = [SequenceTrigger(keys, self.cfg.trigger_max_interval) for keys in parsed]
        self.action_triggers.replace(actions)

    @_serialized
    def activate(self, name):
        settings = self.loader(name)
        if settings is None or settings.profile_name != name:
            return False
        self._publish(settings)
        print(f'[{self.cfg.project_name}] Profile armed: {name}')
        return True

    @_serialized
    def activate_live(self):
        settings = self.loader(None)
        if settings is None:
            return False
        self._publish(settings)
        return True

    @_serialized
    def manual_map(self):
        settings = self.active_settings[0]
        return dict(settings.hotkeys if settings is not None else self.cfg.manual_trigger_map)

    @_serialized
    def interface_hotkeys(self):
        merged = normalize_interface_hotkeys(self.cfg.interface_hotkeys)
        settings = self.active_settings[0]
        if settings is not None:
            merged.update({key: value for key, value in
                normalize_interface_hotkeys(settings.interface_hotkeys).items() if value})
        return merged

    @_serialized
    def reload(self, *, force=False):
        stamp = self.file_stamp()
        if not force and stamp == self._stamp:
            return False
        triggers = {}
        for profile in load_project_profile_summaries(self.project_dir, hotkeys_file=self.hotkeys_file):
            name = str(profile.get('name') or '')
            parsed = self.profile_parser(str(profile.get('trigger_sequences') or ''))
            if name and parsed:
                triggers[name] = [SequenceTrigger(keys, self.cfg.trigger_max_interval) for keys in parsed]
        if not self.activate(self.active_profile_name[0]) and not self.activate_live():
            return False
        self.profile_triggers.replace(triggers)
        self._stamp = stamp
        return True

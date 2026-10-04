"""Resolve live layout rules; asset overrides are applied by AssetPlayback first."""
import threading

from .layout_rules import (layout_rules_file_for_config, load_layout_rules,
                           resolve_rule_for_stem, obs_transform_from_rule)


class AssetLayout:
    def __init__(self, cfg, active_settings):
        self.cfg = cfg
        self.active_settings = active_settings
        self.path = layout_rules_file_for_config(cfg)
        self._lock = threading.Lock()
        self._marker = None
        self._rules = {}

    def resolve(self, stem, path):
        if not getattr(self.cfg, 'single_source_mode', False):
            return None
        with self._lock:
            try:
                marker = self.path.stat().st_mtime_ns
                if marker != self._marker:
                    self._rules = load_layout_rules(self.path)
                    self._marker = marker
            except OSError:
                pass
            settings = self.active_settings[0]
            categories = list(settings.sound_categories.get(stem, ())) if settings else []
            rule = resolve_rule_for_stem(self._rules, stem=stem, path=path, categories=categories)
            return obs_transform_from_rule(rule) if rule else None

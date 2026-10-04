"""Editor layout endpoints; transport owns request parsing."""
from __future__ import annotations
import time
from lib.shared_media.layout_rules import safe_transform as _safe_transform
from .settings import _save_layout_rules, _scene_name, _source_prefix
from .layout import _apply_layout_rules, _apply_source_properties, _layout_response


class _LayoutRoutes:

    def _handle_layout_save(self, data):
        proj = self.context.current['proj']
        rules = data.get('rules', {})
        if not isinstance(rules, dict):
            return self._json_err('rules must be an object')
        overrides = data.get('overrides', {})
        if not isinstance(overrides, dict):
            return self._json_err('overrides must be an object')
        clean_rules = {str(key): _safe_transform(value) for key, value in rules.items() if isinstance(value, dict)}
        clean_overrides = {str(key): _safe_transform(value) for key, value in overrides.items() if isinstance(value, dict)}
        _save_layout_rules(proj, {'scene': _scene_name(proj), 'prefix': _source_prefix(proj), 'rules': clean_rules, 'overrides': clean_overrides, 'updated_at': time.strftime('%Y-%m-%d %H:%M:%S')})
        result = {'applied': [], 'failed': []}
        if data.get('apply', True):
            try:
                apply_rules = data.get('apply_rules')
                apply_overrides = data.get('apply_overrides')
                clean_apply_rules = {str(key): _safe_transform(value) for key, value in apply_rules.items() if isinstance(value, dict)} if isinstance(apply_rules, dict) else clean_rules
                clean_apply_overrides = {str(key): _safe_transform(value) for key, value in apply_overrides.items() if isinstance(value, dict)} if isinstance(apply_overrides, dict) else clean_overrides
                result = _apply_layout_rules(proj, clean_apply_rules, clean_apply_overrides)
            except Exception as exc:
                result = {'applied': [], 'failed': [{'source': '(OBS)', 'error': str(exc)}]}
        self._json_ok({'ok': True, 'layout': _layout_response(proj), 'apply_result': result})

    def _handle_layout_properties_apply(self, data):
        proj = self.context.current['proj']
        try:
            result = _apply_source_properties(proj, data if isinstance(data, dict) else {})
            self._json_ok({'ok': True, 'result': result, 'layout': _layout_response(proj)})
        except Exception as exc:
            self._json_err(str(exc))

    def _handle_layout_source_visibility(self, data):
        proj = self.context.current['proj']
        source = str(data.get('source', '')).strip()
        if not source:
            return self._json_err('source required')
        visible = bool(data.get('visible'))
        try:
            import obs
            obs.set_scene_source_visible(_scene_name(proj), source, visible)
            self._json_ok({'ok': True, 'layout': _layout_response(proj)})
        except Exception as exc:
            self._json_err(str(exc))

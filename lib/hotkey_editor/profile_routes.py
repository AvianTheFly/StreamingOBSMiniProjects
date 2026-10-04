"""Editor profile endpoints; transport owns request parsing."""
from __future__ import annotations
import math
from pathlib import Path
from lib.hotkey_editor.profiles import change_profile
from lib.hotkey_editor.profiles import profile_response
from lib.hotkey_editor.profiles import default_profile as _default_profile
from lib.project_settings import audio_settings_transaction
from lib.shared_media.controls import normalize_file_volume_offsets
from lib.shared_media.controls import normalize_interface_hotkeys
from lib.shared_media.profile_store import create_media_profile
from .settings import _config_response, _load_editor_state, _load_phrases, _normalize_project, _phrases_file, _save_config_overrides, _save_editor_state, _save_phrases, _sync_hotkeys_file
from .assets import _scan_sounds
from .presentation import _build_api_data


class _ProfileRoutes:

    @audio_settings_transaction
    def _handle_save(self, data):
        for key in ('project_volume_db', 'profile_volume_db'):
            if key in data:
                try:
                    if not math.isfinite(float(data[key])):
                        raise ValueError()
                except (TypeError, ValueError):
                    return self._json_err('Volumes must be finite numbers')
        proj = self.context.current['proj']
        state = _load_editor_state(proj)
        active = state.get('active_profile', 'default')
        if active not in state['profiles']:
            state['profiles'][active] = _default_profile()
        profile = state['profiles'][active]
        for key in ('hotkeys', 'interface_hotkeys', 'project_volume_db', 'profile_volume_db', 'category_volume_db', 'file_volume_offsets', 'group_names', 'display_names', 'categories', 'sound_categories', 'empty_groups', 'unbound_groups'):
            if key in data:
                if key == 'interface_hotkeys':
                    profile[key] = normalize_interface_hotkeys(data[key])
                elif key in {'file_volume_offsets', 'category_volume_db'}:
                    profile[key] = normalize_file_volume_offsets(data[key])
                elif key in {'project_volume_db', 'profile_volume_db'}:
                    profile[key] = float(data[key])
                else:
                    profile[key] = data[key]
        if 'profile_trigger_sequences' in data:
            profile['trigger_sequences'] = str(data.get('profile_trigger_sequences') or '')
        if 'phrases' in data:
            _save_phrases(proj, data.get('phrases') or {})
        _save_editor_state(proj, state)
        if active == state.get('live_profile'):
            _sync_hotkeys_file(proj, profile)
            count = len(profile.get('hotkeys', {}))
            print(f"[hotkey_editor] Saved {count} hotkey(s) → {proj['hotkeys_file']}")
        self._json_ok({'ok': True})

    def _handle_config_save(self, data):
        proj = self.context.current['proj']
        settings = data.get('settings', {})
        if not isinstance(settings, dict):
            return self._json_err('settings must be an object')
        _save_config_overrides(proj, settings)
        refreshed = _config_response(proj)
        current_settings = refreshed.get('current', {})
        if current_settings.get('asset_dir'):
            proj['asset_dir'] = Path(str(current_settings['asset_dir']))
        extensions = current_settings.get('valid_extensions')
        if isinstance(extensions, list):
            proj['extensions'] = {str(ext).strip().lower() for ext in extensions if str(ext).strip()}
        elif isinstance(extensions, str):
            proj['extensions'] = {item.strip().lower() for item in extensions.split(',') if item.strip()}
        self._json_ok({'ok': True, 'config_settings': refreshed, 'sounds': _scan_sounds(proj['asset_dir'], proj['extensions'])})

    def _handle_phrases_save(self, data):
        proj = self.context.current['proj']
        phrases = data.get('phrases', {})
        if not isinstance(phrases, dict):
            return self._json_err('phrases must be an object')
        _save_phrases(proj, phrases)
        self._json_ok({'ok': True, 'phrases': _load_phrases(proj), 'phrases_file': str(_phrases_file(proj))})

    def _handle_media_profile_create(self, data):
        proj = self.context.current['proj']
        store_file = proj.get('profile_store_file')
        if not store_file:
            store_file = next((p.get('profile_store_file') for p in self.context.projects if p.get('profile_store_file')), None)
        if not store_file:
            return self._json_err('This editor session is not backed by a media profile store')
        try:
            created = create_media_profile(Path(store_file), data)
        except Exception as exc:
            return self._json_err(str(exc))
        new_proj = _normalize_project(created)
        self.context.projects.append(new_proj)
        self.context.current['proj'] = new_proj
        state = _load_editor_state(new_proj)
        self._json_ok({'ok': True, **_build_api_data(new_proj, state, self.context.projects, self.context.current['proj'])})

    @audio_settings_transaction
    def _handle_profile(self, action: str, data: dict):
        proj = self.context.current['proj']
        state = _load_editor_state(proj)
        old_live = state.get('live_profile')
        try:
            change_profile(state, action, data)
        except ValueError as exc:
            return self._json_err(str(exc))
        live = state['live_profile']
        if action == 'delete' and live != old_live:
            _sync_hotkeys_file(proj, state['profiles'][live])
        _save_editor_state(proj, state)
        if action == 'set_live':
            profile = state['profiles'][live]
            _sync_hotkeys_file(proj, profile)
            count = len(profile.get('hotkeys', {}))
            print(f"[hotkey_editor] Live profile → '{live}'  ({count} hotkeys → {proj['hotkeys_file']})")
        self._json_ok(profile_response(state, action))

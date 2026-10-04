"""Assemble editor response data from domain services."""
from __future__ import annotations
from lib.hotkey_editor.profiles import default_profile as _default_profile
from lib.hotkey_editor.profiles import profile_response_fields as _profile_response_fields
from .settings import _config_response, _load_phrases, _phrases_file
from .assets import _scan_sounds


def _build_api_data(proj: dict, state: dict, all_projects: list[dict], current_proj: dict) -> dict:
    active = state.get('active_profile', 'default')
    profile = state['profiles'].get(active, _default_profile())
    return {'project_name': proj['name'], 'asset_dir': str(proj['asset_dir']), 'sounds': _scan_sounds(proj['asset_dir'], proj['extensions']), 'active_profile': active, 'live_profile': state.get('live_profile', 'default'), 'profile_names': sorted(state['profiles'].keys()), 'projects': [{'key': p['key'], 'name': p['name'], 'active': p is current_proj} for p in all_projects], 'config_settings': _config_response(proj), 'features': proj.get('features', {}), 'can_create_profiles': bool(proj.get('can_create_profiles')), 'phrases': _load_phrases(proj), 'phrases_file': str(_phrases_file(proj)), **_profile_response_fields(profile)}

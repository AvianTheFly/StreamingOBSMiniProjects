"""Editor settings, profile files, phrases, and project normalization."""
from __future__ import annotations
import threading
import copy
import json
from pathlib import Path
from lib.hotkey_editor.schema import CONFIG_FIELDS as _CONFIG_FIELDS
from lib.hotkey_editor.schema import config_fields_for_project as _config_fields_for_proj
from lib.hotkey_editor.profiles import default_profile as _default_profile
from lib.hotkey_editor.profiles import default_editor_state as _default_editor_state
from lib.hotkeys import load_hotkeys
from lib.hotkeys import save_hotkeys
from lib.json_store import write_json
from lib.shared_media.controls import action_catalog
from lib.shared_media.controls import normalize_interface_hotkeys

_STATE_LOCK = threading.RLock()


def _config_file(proj: dict) -> Path:
    return proj['hotkeys_file'].parent / 'editor_config_overrides.json'

def _layout_rules_file(proj: dict) -> Path:
    return proj['hotkeys_file'].parent / 'obs_layout_rules.json'

def _phrases_file(proj: dict) -> Path:
    return Path(proj.get('phrases_file') or proj['hotkeys_file'].parent / 'phrases.json')

def _load_config_overrides(proj: dict) -> dict:
    path = _config_file(proj)
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}

def _save_config_overrides(proj: dict, settings: dict) -> None:
    allowed = {field['key'] for field in _CONFIG_FIELDS}
    clean = {key: value for key, value in settings.items() if key in allowed}
    if 'interface_hotkeys' in clean:
        clean['interface_hotkeys'] = normalize_interface_hotkeys(clean['interface_hotkeys'])
    write_json(_config_file(proj), clean)

def _config_response(proj: dict) -> dict:
    defaults = dict(proj.get('config_defaults') or {})
    defaults.setdefault('asset_dir', str(proj['asset_dir']))
    defaults.setdefault('valid_extensions', sorted(proj['extensions']))
    overrides = _load_config_overrides(proj)
    current = {**defaults, **overrides}
    if 'interface_hotkeys' in current:
        current['interface_hotkeys'] = normalize_interface_hotkeys(current['interface_hotkeys'])
    return {'fields': _config_fields_for_proj(proj), 'interface_actions': action_catalog(), 'defaults': defaults, 'overrides': overrides, 'current': current, 'file': str(_config_file(proj))}

def _load_layout_rules(proj: dict) -> dict:
    path = _layout_rules_file(proj)
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}

def _save_layout_rules(proj: dict, rules: dict) -> None:
    write_json(_layout_rules_file(proj), rules)

def _scene_name(proj: dict) -> str:
    current = _config_response(proj).get('current', {})
    return str(current.get('scene') or proj['name'])

def _source_prefix(proj: dict) -> str:
    current = _config_response(proj).get('current', {})
    return str(current.get('obs_source_prefix') or '')

def _single_source_name(proj: dict) -> str | None:
    """Return the single shared OBS source name if the project uses single-source mode."""
    current = _config_response(proj).get('current', {})
    if current.get('single_source_mode'):
        prefix = _source_prefix(proj)
        return f'{prefix}player' if prefix else None
    return None

def _load_phrases(proj: dict) -> dict:
    path = _phrases_file(proj)
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    return {str(key): [str(item) for item in value if str(item).strip()] for key, value in raw.items() if not str(key).startswith('_') and isinstance(value, list)}

def _save_phrases(proj: dict, phrases: dict) -> None:
    clean = {str(key): _unique_strings(value) for key, value in (phrases or {}).items() if str(key).strip()}
    payload = {'_comment': 'Keys are canonical asset file stems without extensions. Values are alternate phrases that should trigger that asset.', **{key: value for key, value in sorted(clean.items()) if value}}
    write_json(_phrases_file(proj), payload)

def _unique_strings(raw: object) -> list[str]:
    if isinstance(raw, str):
        items = raw.splitlines()
    elif isinstance(raw, list):
        items = raw
    else:
        items = []
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        text = str(item).strip()
        folded = text.lower()
        if text and folded not in seen:
            seen.add(folded)
            result.append(text)
    return result

def _load_editor_state(proj: dict) -> dict:
    state_file: Path = proj['state_file']
    hotkeys_file: Path = proj['hotkeys_file']
    with _STATE_LOCK:
        if not state_file.is_file():
            state = _default_editor_state()
            if hotkeys_file.is_file():
                existing = load_hotkeys(hotkeys_file)
                if existing:
                    state['profiles']['default']['hotkeys'] = dict(existing)
            return state
        try:
            raw = json.loads(state_file.read_text(encoding='utf-8'))
        except Exception:
            return _default_editor_state()
    if not isinstance(raw, dict):
        return _default_editor_state()
    state = _default_editor_state()
    state.update(raw)
    if not isinstance(state.get('profiles'), dict) or not state['profiles']:
        state['profiles'] = {'default': _default_profile()}
    for profile in state['profiles'].values():
        for k, v in _default_profile().items():
            if k not in profile:
                profile[k] = copy.deepcopy(v)
    names = list(state['profiles'].keys())
    if state.get('live_profile') not in names:
        state['live_profile'] = names[0]
    if state.get('active_profile') not in names:
        state['active_profile'] = state['live_profile']
    return state

def _save_editor_state(proj: dict, state: dict) -> None:
    with _STATE_LOCK:
        write_json(proj['state_file'], state)

def _sync_hotkeys_file(proj: dict, profile: dict) -> None:
    """Write only the bound hotkeys to hotkeys.json for mini-project consumption."""
    save_hotkeys(proj['hotkeys_file'], profile.get('hotkeys', {}))

def _normalize_project(p: dict) -> dict:
    hf = Path(p['hotkeys_file'])
    return {'key': p.get('key', p['name'].lower().replace(' ', '_')), 'name': p['name'], 'asset_dir': Path(p['asset_dir']), 'hotkeys_file': hf, 'extensions': set(p.get('extensions', p.get('valid_extensions', set()))), 'config_defaults': p.get('config_defaults', {}), 'features': p.get('features', {}), 'profile_store_file': Path(p['profile_store_file']) if p.get('profile_store_file') else None, 'can_create_profiles': bool(p.get('can_create_profiles')), 'phrases_file': Path(p.get('phrases_file') or hf.parent / 'phrases.json'), 'state_file': hf.parent / f'{hf.stem}_editor.json'}

"""Editor OBS layout and source-property operations."""
from __future__ import annotations
from pathlib import Path
from lib.shared_media.layout_rules import obs_transform_from_rule as _obs_transform_from_rule
from lib.shared_media.layout_rules import probe_dimension_key
from .context import _VIDEO_EXTS
from .settings import _layout_rules_file, _load_editor_state, _load_layout_rules, _scene_name, _single_source_name, _source_prefix
from .assets import _scan_sounds


from .metadata import _probe_media_dimensions


def _layout_response(proj: dict, *, include_obs: bool=True) -> dict:
    sounds = _scan_sounds(proj['asset_dir'], proj['extensions'])
    videos = [sound for sound in sounds if sound.get('ext') in _VIDEO_EXTS]
    state = _load_editor_state(proj)
    active = state.get('active_profile', 'default')
    profile = state.get('profiles', {}).get(active, {})
    sound_categories = profile.get('sound_categories', {}) if isinstance(profile, dict) else {}
    groups: dict[str, dict] = {}
    for sound in videos:
        dimension_key = sound.get('dimension_key') or 'unknown'
        categories = sound_categories.get(sound['stem'])
        if not isinstance(categories, list) or not categories:
            categories = ['Uncategorized']
        for category in categories:
            category = str(category).strip() or 'Uncategorized'
            key = f'{dimension_key}::{category}'
            group = groups.setdefault(key, {'key': key, 'dimension_key': dimension_key, 'category': category, 'width': sound.get('width'), 'height': sound.get('height'), 'sounds': []})
            grouped_sound = {**sound, 'layout_category': category}
            group['sounds'].append(grouped_sound)
    canvas = {'baseWidth': 1920, 'baseHeight': 1080, 'outputWidth': 1920, 'outputHeight': 1080}
    transforms = {}
    sources = []
    obs_error = ''
    if include_obs:
        try:
            import obs
            canvas = obs.get_canvas_size()
            transforms = obs.get_scene_source_transforms(_scene_name(proj), _source_prefix(proj))
            sources, source_error = _scene_sources_response(proj)
            if source_error:
                obs_error = source_error
        except Exception as exc:
            obs_error = str(exc)
    saved = _load_layout_rules(proj)
    return {'scene': _scene_name(proj), 'prefix': _source_prefix(proj), 'singleSourceName': _single_source_name(proj), 'canvas': canvas, 'groups': sorted(groups.values(), key=lambda g: (g.get('height') or 0, g.get('width') or 0, g.get('category') or '', g['key'])), 'rules': saved.get('rules', {}), 'overrides': saved.get('overrides', {}), 'transforms': transforms, 'sources': sources, 'obs_error': obs_error, 'file': str(_layout_rules_file(proj))}

def _apply_layout_rules(proj: dict, rules: dict, overrides: dict | None=None) -> dict:
    import obs
    overrides = overrides or {}
    if _single_source_name(proj):
        return {'applied': [], 'failed': []}
    sounds = _scan_sounds(proj['asset_dir'], proj['extensions'])
    state = _load_editor_state(proj)
    active = state.get('active_profile', 'default')
    profile = state.get('profiles', {}).get(active, {})
    sound_categories = profile.get('sound_categories', {}) if isinstance(profile, dict) else {}
    scene = _scene_name(proj)
    prefix = _source_prefix(proj)
    applied = []
    failed = []
    for sound in sounds:
        if sound.get('ext') not in _VIDEO_EXTS:
            continue
        categories = sound_categories.get(sound['stem'])
        if not isinstance(categories, list) or not categories:
            categories = ['Uncategorized']
        dimension_key = sound.get('dimension_key') or 'unknown'
        rule = overrides.get(sound['stem']) or next((rules.get(f"{dimension_key}::{str(category).strip() or 'Uncategorized'}") for category in categories if rules.get(f"{dimension_key}::{str(category).strip() or 'Uncategorized'}")), None) or rules.get(dimension_key)
        if not rule:
            continue
        source = f"{prefix}{sound['stem']}"
        try:
            obs.set_source_transform(scene, source, _obs_transform_from_rule(rule))
            applied.append(source)
        except Exception as exc:
            failed.append({'source': source, 'error': str(exc)})
    return {'applied': applied, 'failed': failed}

def _sound_categories_for_project(proj: dict) -> dict:
    state = _load_editor_state(proj)
    active = state.get('active_profile', 'default')
    profile = state.get('profiles', {}).get(active, {})
    return profile.get('sound_categories', {}) if isinstance(profile, dict) else {}

def _source_records(proj: dict) -> list[dict]:
    prefix = _source_prefix(proj)
    sound_categories = _sound_categories_for_project(proj)
    records = []
    for sound in _scan_sounds(proj['asset_dir'], proj['extensions']):
        categories = sound_categories.get(sound['stem'])
        if not isinstance(categories, list) or not categories:
            categories = ['Uncategorized']
        source = f"{prefix}{sound['stem']}"
        records.append({**sound, 'source': source, 'categories': [str(c).strip() or 'Uncategorized' for c in categories], 'dimension_key': sound.get('dimension_key') or 'unknown'})
    return records

def _scene_sources_response(proj: dict) -> tuple[list[dict], str]:
    scene = _scene_name(proj)
    records = {item['source']: item for item in _source_records(proj)}
    try:
        import obs
        scene_sources = obs.get_scene_sources(scene)
    except Exception as exc:
        return ([], str(exc))
    result = []
    for item in scene_sources:
        source = item.get('source', '')
        record = records.get(source, {})
        result.append({**item, 'profile_source': bool(record), 'stem': record.get('stem') or source, 'ext': record.get('ext', ''), 'categories': record.get('categories', []), 'dimension_key': record.get('dimension_key', ''), 'size_mb': record.get('size_mb')})
    return (result, '')

def _tracks_payload(value) -> dict | None:
    if value is None or value == '':
        return None
    if isinstance(value, dict):
        return {str(i): bool(value.get(str(i)) or value.get(i)) for i in range(1, 7)}
    if isinstance(value, list):
        enabled = {str(v).strip() for v in value}
    else:
        enabled = {part.strip() for part in str(value).split(',')}
    return {str(i): str(i) in enabled for i in range(1, 7)}

def _sources_for_property_scope(proj: dict, data: dict) -> list[dict]:
    scope_type = str(data.get('scope_type') or data.get('scopeType') or 'group')
    scope_key = str(data.get('scope_key') or data.get('scopeKey') or '')
    records = _source_records(proj)
    if scope_type == 'all':
        return records
    if scope_type == 'groups':
        keys = data.get('scope_keys') or data.get('scopeKeys') or []
        if not isinstance(keys, list):
            keys = []
        wanted = {str(key) for key in keys if str(key)}
        if scope_key:
            wanted.add(scope_key)
        matched: list[dict] = []
        seen: set[str] = set()
        for key in wanted:
            for item in _sources_for_property_scope(proj, {'scope_type': 'group', 'scope_key': key}):
                source = str(item.get('source') or '')
                if source and source not in seen:
                    seen.add(source)
                    matched.append(item)
        return matched
    if scope_type == 'category':
        return [item for item in records if scope_key in item.get('categories', [])]
    if scope_type == 'dimension':
        return [item for item in records if item.get('dimension_key') == scope_key]
    if scope_type == 'source':
        return [item for item in records if item.get('source') == scope_key or item.get('stem') == scope_key]
    if '::' in scope_key:
        dimension, category = scope_key.split('::', 1)
        return [item for item in records if item.get('dimension_key') == dimension and category in item.get('categories', [])]
    return [item for item in records if item.get('dimension_key') == scope_key]

def _apply_source_properties(proj: dict, data: dict) -> dict:
    import obs
    media_props = data.get('media_properties') or data.get('mediaProperties') or {}
    if not isinstance(media_props, dict):
        media_props = {}
    monitor = data.get('monitor')
    tracks = _tracks_payload(data.get('audio_tracks', data.get('audioTracks')))
    volume_db = data.get('volume_db')
    if volume_db is not None:
        try:
            volume_db = float(volume_db)
        except (TypeError, ValueError):
            volume_db = None
    targets = _sources_for_property_scope(proj, data)
    applied = []
    failed = []
    for item in targets:
        source = item['source']
        try:
            if media_props:
                kwargs = {}
                for key in ('restart_on_activate', 'close_when_inactive', 'looping', 'hw_decode', 'clear_on_media_end'):
                    if key in media_props:
                        kwargs[key] = bool(media_props[key])
                if media_props.get('speed_percent') not in (None, ''):
                    kwargs['speed_percent'] = float(media_props['speed_percent'])
                if kwargs:
                    obs.configure_media_source_properties(source, **kwargs)
            if monitor:
                obs.set_input_audio_monitor_type(source, str(monitor))
            if tracks is not None:
                obs.set_input_audio_tracks(source, tracks)
            if volume_db is not None:
                obs.set_input_volume_db(source, float(volume_db))
            applied.append(source)
        except Exception as exc:
            failed.append({'source': source, 'error': str(exc)})
    return {'applied': applied, 'failed': failed}

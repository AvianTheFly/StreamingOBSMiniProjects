"""Hotkey editor HTTP server startup, shutdown, and port selection."""
from __future__ import annotations
import http.server
import socket
import threading
import webbrowser
from pathlib import Path
from .settings import _normalize_project
from .transport import _make_handler


def _find_free_port(start: int, count: int=10) -> int:
    for p in range(start, start + count):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('localhost', p))
                return p
            except OSError:
                continue
    raise RuntimeError(f'No free port found in range {start}–{start + count - 1}')

def run_editor(*, asset_dir: Path, hotkeys_file: Path, valid_extensions: set[str], project_name: str, port: int=8765, all_projects: list[dict] | None=None, open_browser: bool=True, stop_event: threading.Event | None=None) -> None:
    """Serve until Ctrl+C or stop_event; optionally open a browser for standalone use.

    If *all_projects* is provided, the UI will show a project switcher.
    Each entry must have keys: key, name, asset_dir, hotkeys_file, extensions.
    """
    primary = _normalize_project({'name': project_name, 'asset_dir': asset_dir, 'hotkeys_file': hotkeys_file, 'extensions': valid_extensions})
    if all_projects:
        normalized = [_normalize_project(p) for p in all_projects]
        keys = [p['key'] for p in normalized]
        if primary['key'] not in keys:
            normalized.insert(0, primary)
        else:
            primary = next((p for p in normalized if p['key'] == primary['key']))
        projects_list = normalized
    else:
        projects_list = [primary]
    current = {'proj': primary}
    server_ref: list = [None]
    handler = _make_handler(current=current, all_projects=projects_list, server_ref=server_ref)

    # Serving the editor must not start OBS encoding. Replay capture is manual
    # while developing; users can enable the buffer directly in OBS when needed.
    actual_port = _find_free_port(port)
    server = http.server.HTTPServer(('localhost', actual_port), handler)
    server_ref[0] = server
    url = f'http://localhost:{actual_port}'
    bar = '=' * 56
    print(bar)
    print(f'  {project_name} — Hotkey Editor')
    print(bar)
    print(f'  URL        : {url}')
    print(f'  Asset dir  : {asset_dir}')
    print(f'  Hotkeys    : {hotkeys_file}')
    if actual_port != port:
        print(f'  [NOTE] Port {port} was in use — using {actual_port} instead.')
    if not asset_dir.is_dir():
        print('  [WARN] Asset directory not found — sounds list will be empty.')
    print('\n  Ctrl+C to stop.\n')
    if open_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    if stop_event is not None:

        def _stop_with_hub():
            stop_event.wait()
            server.shutdown()
        threading.Thread(target=_stop_with_hub, daemon=True, name='editor-shutdown').start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[hotkey_editor] Stopped.')
    finally:
        server.server_close()

# Compatibility exports; domain implementations live beside this lifecycle module.
from .settings import _config_file, _layout_rules_file, _phrases_file, _load_config_overrides, _save_config_overrides, _config_response, _load_layout_rules, _save_layout_rules, _scene_name, _source_prefix, _single_source_name, _load_phrases, _save_phrases, _unique_strings, _load_editor_state, _save_editor_state, _sync_hotkeys_file, _normalize_project
from .assets import _load_pending_moves, _save_pending_moves_file, _commit_pending_moves, _scan_sounds, _extension_for_media, _unique_archive_path
from .matching import _transcribe_audio, _score_phrase
from .layout import _probe_media_dimensions, _layout_response, _apply_layout_rules, _sound_categories_for_project, _source_records, _scene_sources_response, _tracks_payload, _sources_for_property_scope, _apply_source_properties
from .presentation import _build_api_data
from lib.shared_media.layout_rules import safe_transform as _safe_transform, obs_transform_from_rule as _obs_transform_from_rule

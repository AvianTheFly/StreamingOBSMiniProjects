"""Editor asset endpoints; transport owns request parsing."""
from __future__ import annotations
import urllib.parse
from pathlib import Path
from .context import _PENDING_MOVES_FILE
from .settings import _load_editor_state
from .assets import _commit_pending_moves, _extension_for_media, _load_pending_moves, _save_pending_moves_file, _scan_sounds, _unique_archive_path
from .presentation import _build_api_data


class _AssetRoutes:

    def _handle_media_replace(self, body: bytes):
        if not body:
            return self._json_err('No media data received')
        proj = self.context.current['proj']
        asset_dir = proj['asset_dir'].resolve()
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        stem = query.get('stem', [''])[0].strip()
        requested_name = query.get('filename', [''])[0].strip()
        original_name = query.get('original', [''])[0].strip()
        if not stem or stem != Path(stem).name or any((ch in stem for ch in ('/', '\\', ':'))):
            return self._json_err('Invalid media stem')
        if not asset_dir.is_dir():
            return self._json_err('Asset directory does not exist')
        original_path = None
        if original_name:
            candidate = (asset_dir / Path(original_name).name).resolve()
            if asset_dir in candidate.parents and candidate.is_file() and (candidate.stem == stem):
                original_path = candidate
        if original_path is None:
            matches = [p for p in asset_dir.iterdir() if p.is_file() and p.stem == stem and (p.suffix.lower() in proj['extensions'])]
            if matches:
                original_path = matches[0]
        if original_path is None:
            return self._json_err(f"Original file for '{stem}' was not found")
        content_type = self.headers.get('Content-Type', 'application/octet-stream')
        new_ext = _extension_for_media(content_type, requested_name)
        generated_exts = {'.webm', '.wav', '.mp4', '.mp3', '.ogg', '.m4a'}
        if new_ext not in proj['extensions'] and new_ext not in generated_exts:
            return self._json_err(f'Unsupported replacement extension: {new_ext}')
        proj['extensions'].add(new_ext)
        target_path = (asset_dir / f'{stem}{new_ext}').resolve()
        if asset_dir not in target_path.parents:
            return self._json_err('Invalid replacement path')
        archive_dir = asset_dir / 'originals_to_be_deleted'
        moved = []
        for path in sorted({original_path, target_path}):
            if path.exists():
                archive_path = _unique_archive_path(archive_dir, path.name)
                path.replace(archive_path)
                moved.append(str(archive_path))
        target_path.write_bytes(body)
        state = _load_editor_state(proj)
        self._json_ok({'ok': True, 'sound': {'stem': stem, 'ext': new_ext, 'filename': target_path.name}, 'moved_originals': moved, 'sounds': _scan_sounds(proj['asset_dir'], proj['extensions']), 'data': _build_api_data(proj, state, self.context.projects, self.context.current['proj'])})

    def _handle_pending_moves_save(self, data):
        moves = data.get('moves', [])
        if not isinstance(moves, list):
            return self._json_err('moves must be a list')
        _save_pending_moves_file(moves)
        self._json_ok({'ok': True, 'count': len(moves), 'file': str(_PENDING_MOVES_FILE)})

    def _handle_pending_moves_commit(self, data):
        moves = data.get('moves', [])
        if not isinstance(moves, list):
            return self._json_err('moves must be a list')
        result = _commit_pending_moves(moves, self.context.projects)
        applied_keys = {(a['stem'], a.get('fromProject', '')) for a in result['applied']}
        remaining = [m for m in _load_pending_moves() if (m.get('stem'), m.get('fromProject', '')) not in applied_keys]
        _save_pending_moves_file(remaining)
        self._json_ok({'ok': True, **result})

"""Editor asset inventory, replacement naming, and requested file moves."""
from __future__ import annotations
import json
import shutil
import time
from pathlib import Path
from lib.json_store import write_json
from .context import _PENDING_MOVES_FILE
from .metadata import _probe_media_dimensions


def _load_pending_moves() -> list:
    if not _PENDING_MOVES_FILE.is_file():
        return []
    try:
        raw = json.loads(_PENDING_MOVES_FILE.read_text(encoding='utf-8'))
        return raw if isinstance(raw, list) else []
    except Exception:
        return []

def _save_pending_moves_file(moves: list) -> None:
    write_json(_PENDING_MOVES_FILE, moves)

def _commit_pending_moves(moves: list, all_projects: list[dict]) -> dict:
    applied: list[dict] = []
    failed: list[dict] = []
    for move in moves:
        stem = move.get('stem', '')
        filename = move.get('filename', '')
        from_dir = move.get('fromDir', '')
        to_proj_key = move.get('toProject', '')
        if not all([stem, filename, from_dir, to_proj_key]):
            failed.append({'move': move, 'error': 'Missing required fields'})
            continue
        dest = next((p for p in all_projects if p['key'] == to_proj_key), None)
        if dest is None:
            failed.append({'move': move, 'error': f'Unknown destination project: {to_proj_key}'})
            continue
        from_path = Path(from_dir) / filename
        to_dir = dest['asset_dir']
        to_path = to_dir / filename
        if not from_path.exists():
            failed.append({'move': move, 'error': f'Source not found: {from_path}'})
            continue
        if to_path.exists():
            failed.append({'move': move, 'error': f'Destination already exists: {to_path}'})
            continue
        try:
            to_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(from_path), str(to_path))
            applied.append({**move, 'toDir': str(to_dir)})
        except Exception as exc:
            failed.append({'move': move, 'error': str(exc)})
    return {'applied': applied, 'failed': failed}

def _scan_sounds(asset_dir: Path, valid_extensions: set[str]) -> list[dict]:
    if not asset_dir.is_dir():
        return []
    results = []
    for p in asset_dir.iterdir():
        if p.is_file() and p.suffix.lower() in valid_extensions:
            stat = p.stat()
            results.append({'stem': p.stem, 'ext': p.suffix.lower(), 'filename': p.name, 'size': stat.st_size, 'size_mb': round(stat.st_size / (1024 * 1024), 2), 'mtime': stat.st_mtime, 'ctime': stat.st_ctime, **_probe_media_dimensions(p)})
    return sorted(results, key=lambda x: x['stem'].lower())

def _extension_for_media(content_type: str, fallback_name: str) -> str:
    suffix = Path(fallback_name).suffix.lower()
    if suffix:
        return suffix
    media_type = (content_type or '').split(';', 1)[0].strip().lower()
    return {'video/webm': '.webm', 'audio/webm': '.webm', 'audio/wav': '.wav', 'audio/wave': '.wav', 'audio/x-wav': '.wav', 'video/mp4': '.mp4', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg'}.get(media_type, '.webm')

def _unique_archive_path(folder: Path, filename: str) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    src = Path(filename)
    stamp = time.strftime('%Y%m%d-%H%M%S')
    candidate = folder / f'{src.stem}-{stamp}{src.suffix}'
    counter = 2
    while candidate.exists():
        candidate = folder / f'{src.stem}-{stamp}-{counter}{src.suffix}'
        counter += 1
    return candidate

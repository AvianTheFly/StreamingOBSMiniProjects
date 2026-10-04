"""Public owner of the lobby's shared media catalog and display choices."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import time
import uuid

from lib.json_store import json_transaction, write_json
from lib.settings_backups import SettingsBackups

ROOT = Path('C:/StreamingMedia/SpiritLobby/ScreenMedia')
MAX_BYTES = 80 * 1024 * 1024
TARGETS = ('main', 'left', 'right', 'booth')
PROGRAMS = {'cosmos': 'Infinite galaxy', 'liquid': 'Liquid light show', 'spirit': 'Crystal kaleidoscope', 'text': 'Sign text'}
TEXT_KEYS = {'title': 52, 'subtitle': 76, 'leftTitle': 28, 'leftSubtitle': 28, 'rightTitle': 28, 'rightSubtitle': 28}
EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm'}


class Library:
    def __init__(self, root=ROOT, *, snapshot=True):
        self.root = Path(root).resolve()
        self.manifest = self.root / 'catalog.json'
        self.snapshot = snapshot

    def _read(self):
        data = json.loads(self.manifest.read_text(encoding='utf-8')) if self.manifest.exists() else {}
        if not isinstance(data, dict) or not isinstance(data.get('assets', {}), dict) or not isinstance(data.get('selected', {}), dict) or not isinstance(data.get('texts', {}), dict):
            raise ValueError('The existing screen catalog needs repair; it was preserved.')
        return data

    def _before_write(self):
        if not self.snapshot:
            return
        history = SettingsBackups()
        history.snapshot()
        if self.manifest.exists():
            payload = self.manifest.read_bytes()
            folder = history.backup_root / '_spirit_lobby'
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f'{time.time_ns()}-{hashlib.sha256(payload).hexdigest()[:12]}.json').write_bytes(payload)

    def _change(self, operation):
        self.root.mkdir(parents=True, exist_ok=True)
        with json_transaction(self.manifest):
            data = self._read()
            operation(data)
            self._before_write()
            write_json(self.manifest, data)
        return self.state()

    def state(self):
        data = self._read()
        assets = [{'id': key, 'name': name, 'kind': 'text' if key == 'text' else 'program'} for key, name in PROGRAMS.items()]
        for identity, record in data.get('assets', {}).items():
            if not isinstance(record, dict):
                continue  # Preserve malformed personal entries, never reset them.
            assets.append({'id': identity, 'name': record.get('name', identity), 'kind': record.get('kind'), 'url': '/api/spirit-lobby/media/' + identity})
        return {'assets': assets, 'selected': {'main': 'cosmos', 'left': 'text', 'right': 'text', 'booth': 'text', **data.get('selected', {})}, 'texts': data.get('texts', {}), 'storage': str(self.root), 'maxBytes': MAX_BYTES}

    def save(self, body):
        selections, texts = body.get('selected', {}), body.get('texts', {})
        if not isinstance(selections, dict) or not isinstance(texts, dict):
            raise ValueError('Expected display choices and text.')
        def change(data):
            valid = set(PROGRAMS) | set(data.get('assets', {}))
            for target, identity in selections.items():
                if target not in TARGETS or not isinstance(identity, str) or identity not in valid or (target == 'main' and identity == 'text') or (target != 'main' and identity in {'cosmos', 'liquid', 'spirit'}):
                    raise ValueError('Unknown or incompatible screen choice.')
            cleaned = {}
            for key, value in texts.items():
                if key not in TEXT_KEYS or not isinstance(value, str):
                    raise ValueError('Unknown screen text.')
                cleaned[key] = re.sub(r'[\x00-\x1f]', '', value)[:TEXT_KEYS[key]]
            data['selected'] = {**data.get('selected', {}), **selections}
            data['texts'] = {**data.get('texts', {}), **cleaned}
        return self._change(change)

    def import_stream(self, stream, size, name, *, stopped=lambda: False):
        suffix = Path(name).suffix.lower()
        if suffix not in EXTENSIONS or not 0 < size <= MAX_BYTES:
            raise ValueError('Choose a PNG, JPEG, WebP, GIF, MP4 or WebM up to 80 MB.')
        self.root.mkdir(parents=True, exist_ok=True)
        identity = uuid.uuid4().hex
        temporary = self.root / ('.' + identity + '.upload')
        target = self.root / (identity + suffix)
        deadline = time.monotonic() + 90
        try:
            with temporary.open('xb') as output:
                remaining = size
                while remaining:
                    if stopped() or time.monotonic() >= deadline:
                        raise ValueError('Import cancelled or timed out.')
                    chunk = stream.read(min(256 * 1024, remaining))
                    if not chunk:
                        raise ValueError('The upload ended before the file was complete.')
                    output.write(chunk)
                    remaining -= len(chunk)
            if suffix in {'.mp4', '.webm'}:
                with temporary.open('rb') as source:
                    header = source.read(32)
                if not (suffix == '.mp4' and header[4:8] == b'ftyp' or suffix == '.webm' and header[:4] == b'\x1aE\xdf\xa3'):
                    raise ValueError('This file is not a supported video container.')
                kind = 'video'
            else:
                from PIL import Image
                with Image.open(temporary) as image:
                    if image.width * image.height > 40_000_000:
                        raise ValueError('Choose an image below 40 megapixels.')
                    image.verify()
                kind = 'image'
            os.replace(temporary, target)
            def add(data):
                data['assets'] = {**data.get('assets', {}), identity: {'file': target.name, 'name': Path(name).name[:120], 'kind': kind, 'bytes': size}}
            state = self._change(add)
            return {**state, 'imported': identity}
        except Exception:
            target.unlink(missing_ok=True)
            raise
        finally:
            temporary.unlink(missing_ok=True)

    def remove(self, identity):
        def change(data):
            if not isinstance(identity, str) or identity not in data.get('assets', {}):
                raise ValueError('Media is no longer in the library.')
            data['assets'] = {key: value for key, value in data['assets'].items() if key != identity}
            data['selected'] = {key: ('cosmos' if key == 'main' else 'text') if value == identity else value for key, value in data.get('selected', {}).items()}
        # Removing a library entry preserves the imported file and original file.
        return self._change(change)

    def media_path(self, identity):
        if not re.fullmatch(r'[a-f0-9]{32}', identity):
            raise ValueError('Unknown media.')
        record = self._read().get('assets', {}).get(identity)
        if not isinstance(record, dict) or not isinstance(record.get('file'), str):
            raise ValueError('Unknown media.')
        path = (self.root / record['file']).resolve()
        if not path.is_relative_to(self.root) or path.suffix.lower() not in EXTENSIONS or not path.is_file():
            raise ValueError('Media is unavailable.')
        return path

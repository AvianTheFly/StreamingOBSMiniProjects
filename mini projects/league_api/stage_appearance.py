"""Loading-stage artwork library and atomic personal selection, independent of match cues."""
from pathlib import Path
import hashlib
import io
import json
import threading
import os
import tempfile
import re

from lib.json_store import update_json
from lib.settings_backups import SettingsBackups

MAX_BYTES = 12 * 1024 * 1024
BUILTINS = {'sanctuary': ('Spirit sanctuary', 'media/match-screens/game-start.png'),
            **{key: (title, f'media/champ-select/{key}.jpg') for key, title in
               [('astral', 'Astral observatory'), ('tidal', 'Tidal vault'), ('neon', 'Neon concourse'),
                ('frost', 'Frost sanctum'), ('verdant', 'Verdant engine')]}}


class StageAppearance:
    def __init__(self, root):
        self.root = Path(root)
        self.path = self.root / 'stage_appearance.json'
        self.folder = self.root / 'media' / 'stage-art'
        self.lock = threading.RLock()

    def _read(self):
        data = json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {}
        if not isinstance(data, dict) or not isinstance(data.get('images', {}), dict):
            raise ValueError('Artwork settings need repair; existing data has been preserved')
        if (type(data.get('revision', 0)) is not int or data.get('revision', 0) < 0
                or not isinstance(data.get('loading_image', 'sanctuary'), str)):
            raise ValueError('Artwork settings need repair; existing data has been preserved')
        return data

    def _catalog(self, data):
        rows = [dict(id=key, title=title, image_url='/api/league-stage/art/' + key)
                for key, (title, relative) in BUILTINS.items() if (self.root / relative).is_file()]
        for key, entry in data.get('images', {}).items():
            if isinstance(entry, dict) and self._custom_path(key, entry).is_file():
                rows.append(dict(id=key, title=str(entry.get('title', 'Uploaded image'))[:100],
                                 image_url='/api/league-stage/art/' + key))
        return rows

    def _custom_path(self, key, entry):
        if not isinstance(key, str) or not re.fullmatch(r'image-[a-f0-9]{24}', key):
            raise ValueError('Invalid saved artwork identifier; data was preserved')
        filename = entry.get('file', '')
        if not isinstance(filename, str) or Path(filename).name != filename or not filename:
            raise ValueError('Invalid saved artwork reference; data was preserved')
        path = (self.folder / filename).resolve()
        if not path.is_relative_to(self.folder.resolve()):
            raise ValueError('Artwork reference is outside its library')
        return path

    def catalog(self):
        with self.lock:
            data = self._read()
            return {'revision': data.get('revision', 0), 'selected': data.get('loading_image', 'sanctuary'),
                    'images': self._catalog(data)}

    def snapshot(self):
        with self.lock:
            data = self._read()
            key = data.get('loading_image', 'sanctuary')
            return {'selected': key, 'revision': data.get('revision', 0), 'image_url': '/stage/art/' + key}

    def asset(self, key):
        with self.lock:
            if not isinstance(key, str):
                raise ValueError('Choose a saved image')
            if key in BUILTINS:
                path = self.root / BUILTINS[key][1]
            else:
                entry = self._read().get('images', {}).get(key)
                if not isinstance(entry, dict):
                    raise FileNotFoundError('Artwork not found')
                path = self._custom_path(key, entry)
            if not path.is_file():
                raise FileNotFoundError('Artwork not found')
            return path

    def select(self, key, revision):
        with self.lock:
            self._read()
            if type(revision) is not int:
                raise ValueError('Reopen the image chooser before saving')
            self.asset(key)
            SettingsBackups().snapshot()
            def change(saved):
                if not isinstance(saved, dict):
                    raise ValueError('Artwork settings need repair; data was preserved')
                if revision != saved.get('revision', 0):
                    raise ValueError('Artwork changed in another window. Reopen the image chooser.')
                return {**saved, 'loading_image': key, 'revision': saved.get('revision', 0) + 1}
            update_json(self.path, change, default={})
            return self.catalog()

    def upload(self, name, payload):
        if not 0 < len(payload) <= MAX_BYTES:
            raise ValueError('Choose an image under 12 MB')
        from PIL import Image, UnidentifiedImageError
        try:
            with Image.open(io.BytesIO(payload)) as img:
                if img.format not in {'PNG', 'JPEG', 'WEBP'} or img.width * img.height > 32000000:
                    raise ValueError('Choose a PNG, JPEG or WebP image under 32 megapixels')
                extension = {'PNG': '.png', 'JPEG': '.jpg', 'WEBP': '.webp'}[img.format]
                img.verify()
        except (OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
            raise ValueError('This image could not be read') from exc
        key = 'image-' + hashlib.sha256(payload).hexdigest()[:24]
        with self.lock:
            self._read()  # Validate before adding files; never reset malformed data.
            SettingsBackups().snapshot()
            self.folder.mkdir(parents=True, exist_ok=True)
            path = self.folder / (key + extension)
            if not path.exists():
                descriptor, temporary = tempfile.mkstemp(dir=self.folder, suffix='.tmp')
                try:
                    with os.fdopen(descriptor, 'wb') as stream:
                        stream.write(payload)
                    os.replace(temporary, path)
                finally:
                    if os.path.exists(temporary):
                        os.unlink(temporary)
            def add(saved):
                if not isinstance(saved, dict) or not isinstance(saved.get('images', {}), dict):
                    raise ValueError('Artwork settings need repair; data was preserved')
                images = dict(saved.get('images', {}))
                images.setdefault(key, {'file': path.name, 'title': Path(str(name).replace('\\', '/')).stem[:100] or 'Uploaded image'})
                return {**saved, 'images': images}
            update_json(self.path, add, default={})
            return {**self.catalog(), 'uploaded': key}

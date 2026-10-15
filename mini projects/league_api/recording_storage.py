"""Closed game-file validation and same-drive organization; no OBS policy."""
from pathlib import Path
import uuid

UNREVIEWED = 'Unreviewed Games'
KEPT = 'Kept Games'
EXTENSIONS = {'.mp4', '.mkv', '.mov', '.flv', '.ts'}


class RecordingStorage:
    def __init__(self, root):
        self.root = Path(root).resolve()

    def validate(self, entry):
        path = Path(entry['path']).resolve()
        allowed = {self.root, self.root / UNREVIEWED, self.root / KEPT}
        if path.parent not in allowed or path.suffix.lower() not in EXTENSIONS:
            raise ValueError('Recording is outside its game recording folders')
        stat = path.stat()
        if (stat.st_size, stat.st_mtime_ns) != (entry['size'], entry['mtime_ns']):
            raise ValueError('Recording changed since capture; file preserved')
        return path

    def move(self, entry, folder, publish):
        """Publish the moved path, rolling back a failed journal update.

        Only exact closed files are moved. A unique suffix preserves both files
        if OBS reused a filename already present in the destination.
        """
        if folder not in {UNREVIEWED, KEPT}:
            raise ValueError('Unknown game recording folder')
        source = self.validate(entry)
        destination = self.root / folder
        destination.mkdir(exist_ok=True)
        if destination.resolve() != destination:
            raise ValueError('Game recording folder redirects elsewhere; file preserved')
        target = destination / source.name
        if target != source:
            while target.exists():
                target = destination / f'{source.stem}-{uuid.uuid4().hex[:12]}{source.suffix}'
            source.rename(target)
        try:
            publish({**entry, 'path': str(target)})
        except Exception:
            if target != source:
                target.rename(source)
            raise
        return target

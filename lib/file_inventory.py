"""Fresh file snapshots using directory metadata; no retained cache or watcher."""
import os
from pathlib import Path


def media_entries(folder, extensions, *, recursive=False):
    """Yield (path, stat) once per matching file, releasing directory handles.

    Directory symlinks are not traversed. File symlinks retain their usual target
    metadata. Files removed during a scan are skipped; the next scan is fresh.
    """
    pending = [Path(folder)]
    while pending:
        directory = pending.pop()
        try:
            with os.scandir(directory) as entries:
                for entry in entries:
                    try:
                        if recursive and entry.is_dir(follow_symlinks=False):
                            pending.append(Path(entry.path))
                        elif Path(entry.name).suffix.lower() in extensions and entry.is_file():
                            yield Path(entry.path), entry.stat()
                    except OSError:
                        continue
        except OSError:
            continue

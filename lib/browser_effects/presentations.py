"""Hub-lifetime registration of feature-owned browser artwork, without imports.

Only explicitly published files are served. Registration performs no I/O and
returns an identity token so an old feature shutdown cannot remove a new owner.
"""
from pathlib import Path
import threading

_lock = threading.RLock()
_owners = {}


def register(project, files, *, entry='overlay.html'):
    if not project or '/' in project or entry not in files:
        raise ValueError('Invalid browser presentation')
    published = {name: Path(path).resolve() for name, path in files.items()}
    if any('/' in name or '\\' in name or name in {'.', '..'} for name in published):
        raise ValueError('Publish named presentation files only')
    token = object()
    with _lock:
        _owners[project] = (token, entry, published)
    return token


def unregister(project, token):
    with _lock:
        if project in _owners and _owners[project][0] is token:
            _owners.pop(project)


def resolve(project, name=None):
    with _lock:
        owner = _owners.get(project)
        return owner[2].get(name or owner[1]) if owner else None

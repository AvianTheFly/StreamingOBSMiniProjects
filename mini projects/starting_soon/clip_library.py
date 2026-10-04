"""Consume Instant Replay's public project contract, without peer imports."""
from lib.project_runtime import project_registry


def provider():
    interface = project_registry.get('instant_replay')
    if interface is None or not callable(getattr(interface, 'clip_catalog', None)):
        raise ValueError('Instant Replay library is unavailable.')
    return interface


def catalog():
    return provider().clip_catalog()


def resolve(paths):
    if not isinstance(paths, list) or not paths or len(paths) > 500:
        raise ValueError('Choose 1–500 saved clips.')
    return provider().clip_selection(paths)


def playable(paths):
    """Missing saved references remain editable, but cannot stall a session loop."""
    if not isinstance(paths,list) or not paths or len(paths)>500:
        raise ValueError('Choose 1–500 saved clips.')
    owner = provider()
    rows, missing = [], []
    for path in paths:
        try:
            rows.extend(owner.clip_selection([path]))
        except (ValueError,OSError):
            missing.append(path)
    if not rows:
        raise ValueError('None of these clips are available. Refresh the library and edit the playlist.')
    return rows, missing

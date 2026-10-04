"""Compose Footage Desk's review pool with the producer's portable catalog."""
from pathlib import Path
from lib.media_review import excluded_paths

CATALOG = Path(__file__).resolve().parents[1] / 'mini projects/instant_replay/replay_library.json'


def exclusions():
    return excluded_paths(CATALOG)


def candidates(rows):
    excluded = exclusions()
    return [r for r in rows if str(Path(r['path']).resolve()).casefold() not in excluded]

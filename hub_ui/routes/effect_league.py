"""Read-only League production preview composition; no game or OBS actions."""
from pathlib import Path


def league_catalog():
    from league_api.production.config import ProductionSettings
    from league_api.production.catalog import manifest
    import league_api
    root = Path(league_api.__file__).resolve().parent
    settings = ProductionSettings(root / 'production.json').load()
    return [dict(id='league:' + row['key'], name=row['title'], group='League',
                 effect=row, duration=row['duration'], has_audio=False,
                 state={k: settings[k] for k in ('opacity', 'intensity', 'edge_width')})
            for row in manifest(settings)]


def league_art_root():
    import league_api
    return Path(league_api.__file__).resolve().parent / 'production' / 'web'

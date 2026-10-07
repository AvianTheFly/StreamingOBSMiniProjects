"""Read-only Soundboard artwork and original-media preview composition."""
from pathlib import Path
from urllib.parse import quote
from lib.browser_effects.catalog import load_catalog


def sound_rows():
    from soundboard.config import CONFIG, PROJECT_DIR
    files = {p.stem.casefold(): p for p in Path(CONFIG.asset_dir).iterdir()
             if p.is_file() and p.suffix.lower() in CONFIG.valid_extensions}
    return [dict(id='sound:' + stem, name=stem, group='Sounds', effect=effect,
                 audio='/effects/audio/' + quote(stem, safe=''),
                 has_audio=stem.casefold() in files)
            for stem, effect in load_catalog(PROJECT_DIR).items() if isinstance(effect, dict)]


def sound_file(stem):
    from soundboard.config import CONFIG
    return next((p for p in Path(CONFIG.asset_dir).iterdir()
                 if p.is_file() and p.stem.casefold() == stem.casefold()
                 and p.suffix.lower() in CONFIG.valid_extensions), None)

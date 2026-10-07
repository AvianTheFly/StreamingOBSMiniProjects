"""Private gallery GET transport. Preview clocks and controls stay in the browser."""
from pathlib import Path
from urllib.parse import unquote
from lib.http_files import serve_file
from .effect_soundboard import sound_rows, sound_file
from .effect_league import league_catalog, league_art_root

SOUND_WEB = Path(__file__).resolve().parents[2] / 'lib/browser_effects/web'


class EffectsGalleryRoutes:
    def _get_effects_gallery(self, path):
        if path == '/api/effects-gallery':
            return self._json(200, {'items': sound_rows() + league_catalog()})
        if path.startswith('/effects/audio/'):
            stem = unquote(path.removeprefix('/effects/audio/'))
            if '/' in stem or '\\' in stem:
                return self._err(404, 'Unknown sound')
            target = sound_file(stem)
        else:
            root = league_art_root() if path.startswith('/effects/art/league/') else SOUND_WEB
            name = unquote(path.split('/')[-1])
            target = (root / name).resolve()
            # Only renderer modules and their images are gallery resources.
            if not target.is_relative_to(root.resolve()) or target.suffix not in {'.js', '.png'}:
                target = None
            if name == 'subtle.js':
                target = SOUND_WEB / name
        if target is None or not target.is_file():
            return self._err(404, 'Preview resource unavailable')
        return serve_file(self, target, headers={'Cache-Control': 'no-store'})

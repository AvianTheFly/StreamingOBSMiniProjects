"""Pure replay art direction: modes, viewport geometry and viewer-facing copy."""
from pathlib import Path
import re
from datetime import datetime


def mode_for(kind, *, in_game=False, requested=None):
    if requested in ('replay', 'showcase'):
        return requested
    return 'replay' if kind == 'replay' and in_game else 'showcase'


def layout(companion, camera=False):
    """Keep both viewports 16:9; never cover the recorded gameplay HUD."""
    live = companion != 'off'
    side = live or camera
    return dict(media=[56, 182, 1376, 774] if side else [184, 144, 1552, 873],
                live=[1480, 182, 384, 216],
                camera=[1480, 466 if live else 182, 384, 216],
                next_y=754 if live and camera else 466,
                footer=[56, 985, 1376, 66] if side else [184, 1029, 1552, 36])


def clip_copy(path, metadata):
    """Prefer personal titles; keep technical capture filenames off the stage."""
    path = Path(path)
    title = str(metadata.get('title') or '').strip()
    tag = str(metadata.get('tag') or '').strip()
    if tag == 'untagged':
        tag = ''
    capture = re.search(r'(\d{4}-\d{2}-\d{2})[ _](\d{2})[-:](\d{2})', path.stem)
    recorded = ''
    if capture:
        try:
            stamp = datetime.strptime(' '.join(capture.groups()), '%Y-%m-%d %H %M')
            recorded = f"{stamp.strftime('%b')} {stamp.day} · {stamp.strftime('%H:%M')}"
        except ValueError:
            pass
    if not title or title in (path.name, path.stem):
        title = tag.replace('_', ' ').title() if tag else recorded or path.stem.replace('_', ' ')
    game = re.sub(r'\s+\d{4}-\d{2}-\d{2}$', '', str(metadata.get('game') or '').strip())
    parts = [game, tag if tag and tag.casefold() != title.casefold() else '',
             recorded if recorded and recorded != title else '']
    return title[:160], ' · '.join(p for p in parts if p)[:180]


def transition_for(value):
    return {'move': ('Move', 320), 'wipe': ('Luma Wipe', 320),
            'fade': ('Fade', 220), 'cut': ('Cut', 50)}.get(value)

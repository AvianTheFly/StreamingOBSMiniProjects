"""Choose decoder placement for managed media without transcoding user assets.

OBS 32.1 creates a hardware device context each time a hardware-decoded file
opens. Small H.264 reactions need little software decoding and do not warrant
that GPU allocation during a game. Unknown/heavy video keeps hardware decode.
HUB_MEDIA_DECODE_MODE=hardware restores the previous all-hardware policy;
preserve leaves the OBS checkbox under manual control.
"""
import os
from pathlib import Path
import subprocess
from lib.media_metadata import probe_media


def hardware_decode_for(path: str | Path) -> bool | None:
    mode = os.environ.get('HUB_MEDIA_DECODE_MODE', 'auto').strip().lower()
    if mode == 'preserve':
        return None
    if mode == 'hardware':
        return True
    if mode == 'software':
        return False
    path = Path(path)
    if path.suffix.lower() not in {'.mp4', '.mkv', '.mov', '.m4v', '.ts'}:
        return True
    try:
        media = probe_media(path)
        small = (media.codec == 'h264' and 0 < media.width * media.height <= 1280 * 720
                 and max(media.width, media.height) <= 1280 and 0 < media.fps <= 30.01)
        return not small
    except (OSError, ValueError, TypeError, KeyError, ZeroDivisionError, subprocess.SubprocessError):
        # Probe failure must never prevent playback or turn a large/unknown
        # video into a potentially expensive software decoder.
        return True

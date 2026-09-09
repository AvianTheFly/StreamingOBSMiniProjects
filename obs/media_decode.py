"""Choose decoder placement for managed media without transcoding user assets.

OBS 32.1 creates a hardware device context each time a hardware-decoded file
opens. Small H.264 reactions need little software decoding and do not warrant
that GPU allocation during a game. Unknown/heavy video keeps hardware decode.
HUB_MEDIA_DECODE_MODE=hardware restores the previous all-hardware policy;
preserve leaves the OBS checkbox under manual control.
"""
from functools import lru_cache
from fractions import Fraction
import json
import os
from pathlib import Path
import subprocess


@lru_cache(maxsize=512)
def _small_h264(path: str, modified_ns: int, size: int) -> bool:
    result = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=codec_name,width,height,avg_frame_rate',
         '-of', 'json', path],
        capture_output=True, text=True, timeout=3,
        creationflags=(getattr(subprocess, 'CREATE_NO_WINDOW', 0)
                       | getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)),
    )
    if result.returncode:
        raise ValueError('Media metadata unavailable')
    streams = json.loads(result.stdout).get('streams') or []
    if not streams:
        return False
    stream = streams[0]
    width, height = int(stream.get('width') or 0), int(stream.get('height') or 0)
    fps = float(Fraction(stream.get('avg_frame_rate') or '0'))
    return (stream.get('codec_name') == 'h264' and 0 < width * height <= 1280 * 720
            and max(width, height) <= 1280 and 0 < fps <= 30.01)


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
        stat = path.stat()
        return not _small_h264(str(path.resolve()), stat.st_mtime_ns, stat.st_size)
    except (OSError, ValueError, TypeError, KeyError, ZeroDivisionError, subprocess.SubprocessError):
        # Probe failure must never prevent playback or turn a large/unknown
        # video into a potentially expensive software decoder.
        return True

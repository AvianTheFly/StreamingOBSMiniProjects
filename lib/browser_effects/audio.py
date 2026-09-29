"""Extract original audio into an external cache; never normalize or edit assets."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess


def prepare_audio(path):
    path = Path(path).resolve()
    if path.suffix.lower() in {'.wav', '.mp3', '.ogg', '.m4a'}:
        return path
    tool = shutil.which('ffmpeg')
    if not tool:
        raise RuntimeError('ffmpeg is required to prepare audio for browser effects.')
    stat = path.stat()
    identity = hashlib.sha256(f'{path}:{stat.st_size}:{stat.st_mtime_ns}'.encode()).hexdigest()
    folder = Path(os.environ.get('LOCALAPPDATA', Path.home()))/'StreamingHub'/'browser-effects'/'audio'
    folder.mkdir(parents=True, exist_ok=True)
    output = folder/(identity+'.wav')
    if output.exists():
        return output
    temporary = output.with_suffix('.tmp.wav')
    try:
        subprocess.run([tool, '-v', 'error', '-y', '-i', str(path), '-vn', '-c:a', 'pcm_s16le', str(temporary)],
                       check=True, capture_output=True, timeout=30,
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return output

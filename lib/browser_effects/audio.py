"""Extract original audio into an external cache; never normalize or edit assets."""
import hashlib
import os
from pathlib import Path
import shutil
import tempfile
import threading
from lib.media_jobs import jobs, MediaJobCancelled

_conversion_lock = threading.Lock()


def prepare_audio(path, *, cancelled=lambda: False):
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
    # Two projects can request the same clip. Serialize cache publication and
    # recheck it, rather than encoding the same audio twice into one temp file.
    while not _conversion_lock.acquire(timeout=.05):
        if cancelled():
            raise MediaJobCancelled('Audio preparation cancelled while waiting')
    temporary = None
    try:
        if output.exists():
            return output
        if cancelled():
            raise MediaJobCancelled('Audio preparation cancelled before conversion')
        with tempfile.NamedTemporaryFile(dir=folder, suffix='.tmp.wav', delete=False) as stream:
            temporary = Path(stream.name)
        jobs.run([tool, '-nostdin', '-v', 'error', '-y', '-threads', '1',
                  '-filter_threads', '1', '-i', str(path), '-map', '0:a:0',
                  '-vn', '-threads', '1', '-c:a', 'pcm_s16le', str(temporary)],
                 kind='browser-audio', weight=1, priority=0, cancelled=cancelled,
                 check=True, timeout=30)
        temporary.replace(output)
        return output
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        _conversion_lock.release()

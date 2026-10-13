"""On-demand, low-resolution browser previews. Never changes the OBS media."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
import os
from pathlib import Path
import threading
from lib.media_jobs import jobs
from lib.http_files import serve_file as serve_http_file
from lib.json_store import write_json

_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="replay-preview")
_lock = threading.Lock()
_jobs = {}
_poster_jobs = {}
CACHE = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "StreamingHub" / "replay-previews"


def _pending_count():
    return sum(not j.done() for j in (*_jobs.values(), *_poster_jobs.values()))


def _make_poster(source, output, metadata):
    """A still and duration share the existing bounded preview worker/budget."""
    CACHE.mkdir(parents=True, exist_ok=True)
    original = source.stat()
    temporary = output.with_name(output.stem + '.partial.jpg')
    try:
        probe = jobs.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(source)],
                         kind='replay-poster-probe',weight=1,priority=25,text=True,timeout=20)
        duration = float(json.loads(probe.stdout)['format']['duration'])
        if probe.returncode or not math.isfinite(duration) or duration <= 0:
            raise ValueError('Clip duration unavailable')
        result = jobs.run(['ffmpeg','-nostdin','-v','error','-y','-threads','1',
                          '-ss',str(min(2,duration/3)),'-i',str(source),'-frames:v','1',
                          '-vf','scale=480:-2','-q:v','4','-threads','1',str(temporary)],
                         kind='replay-poster',weight=1,priority=25,timeout=30)
        current = source.stat()
        if (result.returncode or not temporary.is_file() or not temporary.stat().st_size
                or (current.st_size,current.st_mtime_ns)!=(original.st_size,original.st_mtime_ns)):
            raise ValueError('Clip changed or its thumbnail could not be decoded')
        temporary.replace(output)
        write_json(metadata, {'duration': duration})
    finally:
        temporary.unlink(missing_ok=True)


def poster(source):
    stat = source.stat()
    key = hashlib.sha256(f'poster-v1:{source}:{stat.st_mtime_ns}:{stat.st_size}'.encode()).hexdigest()
    output, metadata = CACHE / (key+'.jpg'), CACHE / (key+'.poster.json')
    with _lock:
        if output.is_file() and metadata.is_file():
            return {'status':'ready',**json.loads(metadata.read_text(encoding='utf-8'))}, output
        future = _poster_jobs.get(key)
        if future is not None and future.done():
            try:
                future.result()
            except Exception:
                return {'status':'error','error':'Thumbnail unavailable; open the clip to review it.'}, None
        if future is None or future.done():
            if _pending_count() >= 3:
                return {'status':'busy'}, None
            for old in list(_poster_jobs)[:-80]:
                if _poster_jobs[old].done():
                    del _poster_jobs[old]
            _poster_jobs[key] = _pool.submit(_make_poster,source,output,metadata)
        return {'status':'preparing'}, None


def _convert(source, output):
    CACHE.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".partial.mp4")
    try:
        result = jobs.run([
            "ffmpeg", "-nostdin", "-v", "error", "-y", "-threads", "1",
            "-filter_threads", "1", "-i", str(source),
            "-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale=-2:480,fps=24",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "29", "-threads", "1",
            "-c:a", "aac", "-ac", "2", "-b:a", "96k", "-movflags", "+faststart", str(temporary)
        ], kind='replay-preview', weight=1, priority=20, timeout=300)
        if result.returncode:
            raise ValueError("This clip could not be decoded for browser preview.")
        temporary.replace(output)
        # Bound disposable previews; source recordings never enter this folder.
        cached = sorted(CACHE.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
        total = 0
        for path in cached:
            total += path.stat().st_size
            if path != output and total > 2 * 1024**3:
                try:
                    path.unlink()
                except OSError:
                    pass
    finally:
        temporary.unlink(missing_ok=True)


def preview(source):
    stat = source.stat()
    key = hashlib.sha256(f"{source}:{stat.st_mtime_ns}:{stat.st_size}".encode()).hexdigest()
    output = CACHE / f"{key}.mp4"
    with _lock:
        if output.is_file():
            return {"status": "ready"}, output
        job = _jobs.get(key)
        if job is not None and job.done():
            try:
                job.result()
            except Exception:
                return {"status": "error", "error": "Preview unavailable. The clip may be incomplete or unsupported."}, None
        if job is None or job.done():
            if _pending_count() >= 3:
                return {"status": "busy"}, None
            # Retain only recent completed job results.
            if len(_jobs) > 100:
                for old in list(_jobs):
                    if _jobs[old].done():
                        del _jobs[old]
            _jobs[key] = _pool.submit(_convert, source, output)
        return {"status": "preparing"}, None


def serve_file(handler, path):
    serve_http_file(handler, path, content_type='image/jpeg' if path.suffix == '.jpg' else 'video/mp4')

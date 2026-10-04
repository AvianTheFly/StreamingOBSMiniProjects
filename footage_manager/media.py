"""Bounded FFmpeg jobs and verified exports, preserving every source stream."""
import json
from fractions import Fraction
import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path
from footage_manager.jobs import JobYielded

FLAGS = getattr(subprocess, 'CREATE_NO_WINDOW', 0) | getattr(subprocess, 'BELOW_NORMAL_PRIORITY_CLASS', 0)
EXTENSIONS = {'.mp4', '.mkv', '.mov', '.m4v', '.webm', '.avi', '.ts'}
JOB_CONTEXT = threading.local()


class Cancelled(RuntimeError):
    pass


def check_cancelled():
    job = getattr(JOB_CONTEXT, 'job', {})
    if job.get('cancel_requested'):
        raise Cancelled('Job cancelled. Completed exports remain available.')
    if job.get('yield_requested'):
        raise JobYielded('Foreground media work is waiting')


def run(args, timeout=120):
    check_cancelled()
    if Path(args[0]).stem.lower() == 'ffmpeg':
        # Bound decoding, filters, and encoding in this standalone application's
        # existing media owner, including browser previews and precise exports.
        args = [args[0],'-threads','2','-filter_threads','1',*args[1:-1],'-threads','2',args[-1]]
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace', creationflags=FLAGS)
    started = time.monotonic()
    try:
        while True:
            check_cancelled()
            if time.monotonic()-started > timeout:
                raise ValueError('Media command timed out')
            try:
                stdout, stderr = proc.communicate(timeout=.5)
                break
            except subprocess.TimeoutExpired:
                continue
        if proc.returncode:
            raise ValueError(stderr[-1800:] or 'Media command failed')
        return subprocess.CompletedProcess(args, proc.returncode, stdout, stderr)
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.communicate()


def probe(path):
    data = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)], 30).stdout)
    duration = float(data.get('format', {}).get('duration', 0))
    streams = data.get('streams', [])
    if duration <= 0 or not any(s['codec_type'] == 'video' for s in streams):
        raise ValueError('No playable video duration found')
    def fps(stream):
        try:
            return float(Fraction(stream.get('avg_frame_rate') or '0'))
        except (ValueError, ZeroDivisionError):
            return 0
    return duration, [{'index': s['index'], 'type': s['codec_type'], 'codec': s.get('codec_name'), 'width': s.get('width'), 'height': s.get('height'), 'fps': fps(s), 'tags': s.get('tags', {})} for s in streams]


def unchanged(video):
    path = Path(video['path'])
    st = path.stat()
    if st.st_size != video['size'] or st.st_mtime_ns != video['mtime_ns']:
        raise ValueError('Source changed since indexing. Rescan before exporting or deleting.')
    return path


def export_clip(store, clip, output, padding=15, mode='copy'):
    video = store.video(clip['video_id'])
    source = unchanged(video)
    start, end = max(0, clip['start']-padding), min(video['duration'], clip['end']+padding)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    estimate = video['size'] * (end-start) / video['duration'] * (2 if mode == 'exact' else 1.2)
    if shutil.disk_usage(output).free < estimate + 256*1024*1024:
        raise ValueError('Not enough free space for this export')
    title = re.sub(r'[^\w .-]', '_', clip['title'] or 'clip', flags=re.UNICODE).strip(' .')[:90] or 'clip'
    stamp = time.strftime('%Y%m%d-%H%M%S') + '-' + str(time.time_ns())[-6:]
    # MP4 for ordinary OBS H.264/AAC; MKV preserves other streams without dropping them.
    source_streams = json.loads(video['streams'])
    mp4 = all(s['type'] in ('video', 'audio') and s['codec'] in ('h264', 'hevc', 'av1', 'aac', 'mp3') for s in source_streams)
    extension = '.mp4' if mp4 else '.mkv'
    destination = output / f'{source.stem}__r{clip["id"]}__{title}__{stamp}{extension}'
    temporary = destination.with_name(destination.stem + '.partial' + extension)
    args = ['ffmpeg', '-nostdin', '-v', 'error', '-n', '-ss', str(start), '-i', str(source), '-t', str(end-start), '-map', '0', '-map_metadata', '0']
    if mode == 'exact':
        args += ['-c', 'copy', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18']
    else:
        args += ['-c', 'copy']
    args += ['-avoid_negative_ts', 'make_zero']
    if extension == '.mp4':
        args += ['-movflags', '+faststart']
    try:
        run(args + [str(temporary)], max(300, (end-start)*8 if mode == 'exact' else (end-start)*2))
        actual_duration, actual_streams = probe(temporary)
        expected = sorted((s['type'], s['codec']) for s in source_streams)
        actual = sorted((s['type'], s['codec']) for s in actual_streams)
        if mode == 'exact':
            expected = sorted((s['type'], 'h264' if s['type'] == 'video' else s['codec']) for s in source_streams)
        if actual != expected or abs(actual_duration-(end-start)) > max(8, (end-start)*.05):
            raise ValueError('Export validation failed: duration or tracks differ from the requested clip')
        # Decode samples at both ends, including every audio stream.
        for seek in (0, max(0, actual_duration-2)):
            run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', str(seek), '-i', str(temporary), '-t', '1', '-map', '0:v', '-map', '0:a?', '-f', 'null', '-'], 90)
        unchanged(video)
        temporary.rename(destination)
        info = {'duration': actual_duration, 'streams': actual_streams, 'start': start, 'end': end, 'mode': mode, 'size': destination.stat().st_size, 'mtime_ns': destination.stat().st_mtime_ns}
        # Portable provenance travels with the clip even if the catalogue/source is lost.
        # Atomic publication completes before the catalogue can approve source disposal.
        from lib.json_store import write_json
        sidecar = destination.with_suffix(destination.suffix + '.source.json')
        provenance = {'schema':1, 'source_id':video['id'], 'source_path':video['path'],
                      'source_name':video['name'], 'source_size':video['size'], 'source_mtime_ns':video['mtime_ns'],
                      'requested_start_seconds':clip['start'], 'requested_end_seconds':clip['end'],
                      'export_start_seconds':start, 'export_end_seconds':end,
                      'export_mode':mode, 'export_duration_seconds':actual_duration,
                      'range_id':clip['id'], 'title':clip['title'], 'notes':clip['notes'],
                      'export_path':str(destination), 'streams':actual_streams}
        write_json(sidecar, provenance)
        info['source_metadata'] = str(sidecar)
        info['source_metadata_size'] = sidecar.stat().st_size
        info['source_metadata_mtime_ns'] = sidecar.stat().st_mtime_ns
        store.execute('UPDATE ranges SET exported=?,export_signature=?,export_info=? WHERE id=?', (str(destination), store.signature(video, clip), json.dumps(info), clip['id']))
        return str(destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def deletion_check(store, video):
    if video['status'] not in ('delete', 'keep_clips'):
        raise ValueError('Choose Reviewed — delete or Reviewed — keep clips first')
    ranges = store.ranges(video['id'])
    if any(r['decision'] in ('maybe', 'rereview') for r in ranges):
        raise ValueError('Resolve your Later and Re-review ranges before deleting the recording')
    keep = [r for r in ranges if r['decision'] == 'keep']
    if video['status'] == 'keep_clips' and not keep:
        raise ValueError('No keep ranges exist. Mark this recording Reviewed — delete if it has no keepers.')
    for clip in keep:
        if clip['export_signature'] != store.signature(video, clip):
            raise ValueError('Every keep range needs a current verified export')
        target = Path(clip['exported'])
        info = json.loads(clip['export_info'])
        if not target.is_file() or target.stat().st_size != info.get('size') or target.stat().st_mtime_ns != info.get('mtime_ns'):
            raise ValueError('An exported keeper is missing or changed. Export it again before deletion.')
        if target.resolve() == Path(video['path']).resolve():
            raise ValueError('Export cannot be the original')
        if info.get('source_metadata'):
            sidecar = Path(info['source_metadata'])
            if not sidecar.is_file() or sidecar.stat().st_size != info.get('source_metadata_size') or sidecar.stat().st_mtime_ns != info.get('source_metadata_mtime_ns'):
                raise ValueError('Keeper source metadata is missing or changed. Export again before deletion.')
    return True

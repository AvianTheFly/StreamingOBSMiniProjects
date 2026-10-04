"""Footage Desk: localhost-only, dependency-free personal footage manager."""
import argparse
import csv
import hashlib
import io
import json
import mimetypes
import os
import secrets
import shutil
import socket
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Standalone launchers must still resolve the repository's shared persistence API.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from media import EXTENSIONS, JOB_CONTEXT, Cancelled, check_cancelled, deletion_check, export_clip, probe, run, unchanged
from store import Store
import analysis_api
from footage_manager.jobs import JobRunner

HERE = Path(__file__).resolve().parent
DATA = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'FootageDesk'
DEFAULT_OUTPUT = Path('C:/StreamingMedia/SelectedClips')
TOKEN = secrets.token_urlsafe(32)
UI_VERSION = hashlib.sha256(b''.join((HERE/'web'/name).read_bytes() for name in ('index.html', 'app.js', 'analysis.js', 'voice_markers.js', 'between_games.js', 'workflow.js', 'clip_editor.js', 'clip_drag.js', 'clip_history.js', 'clip_editor.css', 'recording_timeline.js', 'timeline_review.css', 'workflow.css', 'style.css'))).hexdigest()[:16]
STOP = threading.Event()
STORE = None


def save_jobs(jobs):
    if STORE is not None:
        STORE.set_setting('jobs', jobs)


RUNNER = JobRunner(save_jobs)
JOBS, JOB_LOCK, WORK = RUNNER.jobs, RUNNER.lock, RUNNER.queue
persist_jobs = RUNNER.persist


def enqueue(label, function, *, background=False):
    return RUNNER.submit(label, function, background=background)


def worker():
    RUNNER.run(STOP, JOB_CONTEXT, check_cancelled, Cancelled)


def automatic_scans():
    while not STOP.is_set():
        if STORE.setting('roots', []):
            with JOB_LOCK:
                busy = any(j['state'] in ('queued', 'running') and j['label'] == 'Scan recordings' for j in JOBS.values())
            if not busy:
                enqueue('Scan recordings', scan)
        STOP.wait(600)


def scan(job):
    from footage_manager.review_pool import exclusions
    excluded = exclusions()
    added = 0
    seen = set()
    errors = []
    roots = STORE.setting('roots', [])
    output = Path(STORE.setting('output', str(DEFAULT_OUTPUT))).resolve()
    for root in roots:
        base = Path(root)
        if not base.is_dir() and not (base.is_file() and base.suffix.lower() in EXTENSIONS):
            errors.append('Folder unavailable: ' + root)
            continue
        def walk_error(exc):
            errors.append(str(exc))
        entries = [(str(base.parent), [], [base.name])] if base.is_file() else os.walk(base, onerror=walk_error)
        for directory, subdirs, files in entries:
            subdirs[:] = [d for d in subdirs if not d.startswith('.') and (Path(directory)/d).resolve() != output]
            if Path(directory).resolve() == output:
                continue
            for name in files:
                check_cancelled()
                path = Path(directory) / name
                if path.suffix.lower() not in EXTENSIONS or '.partial.' in name:
                    continue
                absolute = str(path.resolve())
                if absolute.casefold() in excluded:
                    continue
                key = os.path.normcase(absolute)
                if key in seen:
                    continue
                seen.add(key)
                job['progress'] = name
                try:
                    st = path.stat()
                    existing = STORE.rows('SELECT * FROM videos WHERE path=?', (absolute,))
                    if existing and existing[0]['availability'] in ('trash', 'deleted'):
                        continue
                    if existing and existing[0]['size'] == st.st_size and existing[0]['mtime_ns'] == st.st_mtime_ns and existing[0]['duration'] > 0:
                        STORE.execute("UPDATE videos SET availability='online' WHERE id=?", (existing[0]['id'],))
                        continue
                    duration, streams = probe(path)
                    after = path.stat()
                    if after.st_size != st.st_size or after.st_mtime_ns != st.st_mtime_ns:
                        raise ValueError('Recording is still changing; rescan when it finishes')
                    if existing:
                        STORE.execute("UPDATE videos SET size=?,mtime_ns=?,duration=?,streams=?,availability='online',status='rereview',error='' WHERE id=?", (st.st_size, st.st_mtime_ns, duration, json.dumps(streams), existing[0]['id']))
                    else:
                        STORE.execute('INSERT INTO videos (path,name,size,mtime_ns,duration,streams) VALUES (?,?,?,?,?,?)', (absolute, name, st.st_size, st.st_mtime_ns, duration, json.dumps(streams)))
                        added += 1
                except Cancelled:
                    raise
                except Exception as exc:
                    errors.append(name + ': ' + str(exc))
                    if not STORE.rows('SELECT id FROM videos WHERE path=?', (absolute,)):
                        st = path.stat()
                        STORE.execute('INSERT INTO videos (path,name,size,mtime_ns,error) VALUES (?,?,?,?,?)', (absolute, name, st.st_size, st.st_mtime_ns, str(exc)))
    for video in STORE.rows("SELECT id,path FROM videos WHERE availability='online'"):
        if not Path(video['path']).exists():
            STORE.execute("UPDATE videos SET availability='missing' WHERE id=?", (video['id'],))
    return {'added': added, 'errors': errors}


def export_job(payload, job):
    ids = payload.get('ids', [])
    if not ids:
        raise ValueError('Select at least one range')
    padding = float(payload.get('padding', 15))
    if not 0 <= padding <= 600:
        raise ValueError('Padding must be between 0 and 600 seconds')
    mode = payload.get('mode', 'copy')
    if mode not in ('copy', 'exact'):
        raise ValueError('Unknown export mode')
    output = STORE.setting('output', str(DEFAULT_OUTPUT))
    results, failures = [], []
    for index, ident in enumerate(ids):
        rows = STORE.rows('SELECT * FROM ranges WHERE id=?', (int(ident),))
        if not rows:
            failures.append(f'Range {ident} no longer exists')
            continue
        clip = rows[0]
        if clip['decision'] == 'reject':
            failures.append(f'Range {ident} is marked reject')
            continue
        job['progress'] = f'{index+1}/{len(ids)} — {clip["title"] or "Untitled range"}'
        try:
            results.append(export_clip(STORE, clip, output, padding, mode))
        except Cancelled:
            raise
        except Exception as exc:
            failures.append(f'Range {ident}: {exc}')
    if failures:
        job['result'] = {'files': results, 'errors': failures}
        raise ValueError('\n'.join(failures))
    return {'files': results}


def trash_video(ident, confirmation):
    video = STORE.video(ident)
    if video['availability'] != 'online' or confirmation != video['name']:
        raise ValueError('Type the exact filename to confirm')
    deletion_check(STORE, video)
    source = unchanged(video)
    STORE.backup()
    target = source.parent / '.footage-manager-trash' / (str(video['id']) + '__' + source.name)
    target.parent.mkdir(exist_ok=True)
    if target.exists():
        raise ValueError('Trash destination already exists')
    # Record recovery location before rename; reconcile on startup after interruption.
    STORE.execute('UPDATE videos SET trash_path=? WHERE id=?', (str(target), video['id']))
    source.rename(target)
    STORE.execute("UPDATE videos SET availability='trash' WHERE id=?", (video['id'],))
    return True


def restore_video(ident):
    video = STORE.video(ident)
    if video['availability'] != 'trash':
        raise ValueError('Recording is not in trash')
    original, source = Path(video['path']), Path(video['trash_path'])
    if original.exists():
        raise ValueError('Original location is occupied; cannot overwrite it')
    STORE.backup()
    source.rename(original)
    STORE.execute("UPDATE videos SET availability='online',trash_path='' WHERE id=?", (video['id'],))


def purge_video(ident, confirmation):
    video = STORE.video(ident)
    if video['availability'] != 'trash' or confirmation != 'DELETE ' + video['name']:
        raise ValueError('Type DELETE followed by the exact filename')
    deletion_check(STORE, video)
    source = Path(video['trash_path'])
    expected = Path(video['path']).parent / '.footage-manager-trash' / (str(video['id'])+'__'+video['name'])
    if source.resolve() != expected.resolve() or source.parent.name != '.footage-manager-trash':
        raise ValueError('Invalid trash path')
    st = source.stat()
    if st.st_size != video['size'] or st.st_mtime_ns != video['mtime_ns']:
        raise ValueError('Trash recording changed; deletion blocked')
    # Re-probe all retained exports immediately before irreversible source deletion.
    for clip in STORE.ranges(ident):
        if clip['decision'] == 'keep':
            duration, streams = probe(clip['exported'])
            info = json.loads(clip['export_info'])
            if abs(duration-info['duration']) > .1 or [(s['type'],s['codec'],s['width'],s['height']) for s in streams] != [(s['type'],s['codec'],s['width'],s['height']) for s in info['streams']]:
                raise ValueError('Keeper validation failed')
    STORE.backup()
    source.unlink()
    STORE.execute("UPDATE videos SET availability='deleted' WHERE id=?", (video['id'],))


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *_):
        pass

    def handle(self):
        try:
            super().handle()
        except (ConnectionError, BrokenPipeError):
            pass

    def response(self, data, status=200, content_type='application/json'):
        payload = json.dumps(data, ensure_ascii=False).encode() if content_type == 'application/json' else data
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        # Rejected POSTs may have unread bodies. Never let those bytes become
        # the next request on a reused browser connection after a restart.
        self.send_header('Connection', 'close')
        self.close_connection = True
        self.end_headers()
        self.wfile.write(payload)

    def local_request(self):
        host = self.headers.get('Host', '')
        if host not in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'):
            raise ValueError('Only localhost requests are allowed')
        origin = self.headers.get('Origin')
        if origin and origin not in (f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'):
            raise ValueError('Cross-origin requests are blocked')

    def stream(self, path):
        size = path.stat().st_size
        start, end = 0, size-1
        status = 200
        requested = self.headers.get('Range')
        if requested:
            import re
            match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
            if not match or (not match[1] and not match[2]):
                self.response({'error': 'Invalid byte range'}, 416)
                return
            if match[1]:
                start = int(match[1])
                end = min(int(match[2]) if match[2] else end, end)
            else:
                start = max(0, size-int(match[2]))
            if start >= size or end < start:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            status = 206
        self.send_response(status)
        self.send_header('Content-Type', mimetypes.guess_type(str(path))[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(end-start+1))
        self.send_header('Accept-Ranges', 'bytes')
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        try:
            with path.open('rb') as source:
                source.seek(start)
                remaining = end-start+1
                while remaining:
                    chunk = source.read(min(256*1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def do_GET(self):
        try:
            self.local_request()
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            query = urllib.parse.parse_qs(parsed.query)
            if path == '/health':
                return self.response({'app': 'Footage Desk', 'source': str(HERE), 'port': self.server.server_port})
            if path == '/':
                return self.response((HERE/'web/index.html').read_text(encoding='utf-8').replace('__TOKEN__', TOKEN).replace('__UI_VERSION__', UI_VERSION).encode(), content_type='text/html; charset=utf-8')
            if path in ('/app.js', '/analysis.js', '/voice_markers.js', '/between_games.js', '/workflow.js', '/clip_editor.js', '/clip_drag.js', '/clip_history.js', '/clip_editor.css', '/recording_timeline.js', '/timeline_review.css', '/workflow.css', '/style.css'):
                return self.response((HERE/'web'/path[1:]).read_bytes(), content_type='text/javascript' if path.endswith('.js') else 'text/css')
            if path == '/api/library':
                jobs = RUNNER.snapshot()
                videos = STORE.review_videos()
                for v in videos:
                    v['ranges'] = STORE.ranges(v['id'])
                output = STORE.setting('output', str(DEFAULT_OUTPUT))
                free = shutil.disk_usage(Path(output).anchor).free if Path(output).anchor else 0
                return self.response({'videos': videos, 'roots': STORE.setting('roots', []), 'output': output, 'data': str(STORE.directory), 'jobs': jobs, 'free': free, 'session': TOKEN, 'ui_version': UI_VERSION})
            if path == '/api/analysis':
                weights = json.loads(query['weights'][0]) if 'weights' in query else None
                return self.response(analysis_api.summary(STORE, weights))
            if path == '/api/analysis-voice-marks':
                return self.response(analysis_api.voice_marks(STORE, int(query['id'][0])))
            if path == '/api/analysis-between-marks':
                return self.response(analysis_api.between_marks(STORE, int(query['id'][0])))
            if path == '/api/analysis-game-marks':
                return self.response(analysis_api.game_marks(STORE, int(query['id'][0])))
            if path == '/api/catalogue.csv':
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(['source', 'review_status', 'game', 'start_seconds', 'end_seconds', 'title', 'decision', 'tags', 'purpose', 'usage', 'collection', 'notes', 'exported_file'])
                for v in STORE.review_videos():
                    for r in STORE.ranges(v['id']) or [{}]:
                        writer.writerow([v['path'], v['status'], v['game']] + [r.get(k, '') for k in ('start', 'end', 'title', 'decision', 'tags', 'purpose', 'usage', 'collection', 'notes', 'exported')])
                return self.response(output.getvalue().encode('utf-8-sig'), content_type='text/csv; charset=utf-8')
            if path == '/api/video-metadata':
                video = STORE.video(query['id'][0])
                source = unchanged(video)
                duration, streams = probe(source)
                unchanged(video)
                STORE.execute('UPDATE videos SET streams=? WHERE id=?', (json.dumps(streams), video['id']))
                return self.response({'streams': streams, 'duration': duration})
            if path == '/media':
                video = STORE.video(query['id'][0])
                if video['availability'] != 'online':
                    raise ValueError('Recording is not online')
                return self.stream(unchanged(video))
            if path == '/exported':
                rows = STORE.rows('SELECT exported FROM ranges WHERE id=?', (int(query['id'][0]),))
                if not rows or not rows[0]['exported']:
                    raise ValueError('No exported clip')
                return self.stream(Path(rows[0]['exported']))
            if path == '/thumb':
                video = STORE.video(query['id'][0])
                second = max(0, min(float(query.get('t', [0])[0]), max(0, video['duration']-1)))
                source = unchanged(video)
                key = hashlib.sha256(f'{video["id"]}:{video["mtime_ns"]}:{second:.1f}'.encode()).hexdigest()
                target = STORE.directory/'thumbnails'/f'{key}.jpg'
                target.parent.mkdir(exist_ok=True)
                if not target.exists():
                    with THUMB_LOCK:
                        if not target.exists():
                            run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', str(second), '-i', str(source), '-frames:v', '1', '-vf', 'scale=240:-2', '-q:v', '5', '-y', str(target)], 30)
                return self.stream(target)
            if path == '/preview':
                key = query.get('key', [''])[0]
                if not key.isalnum():
                    raise ValueError('Invalid preview key')
                return self.stream(STORE.directory/'previews'/(key+'.mp4'))
            return self.response({'error': 'Not found'}, 404)
        except Exception as exc:
            self.response({'error': str(exc)}, 400)

    def do_POST(self):
        try:
            self.local_request()
            if self.headers.get('X-Footage-Token') != TOKEN:
                return self.response({'error': 'Reload the app to renew your session'}, 403)
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length < 2_000_000:
                raise ValueError('Invalid request size')
            payload = json.loads(self.rfile.read(length))
            path = urllib.parse.urlparse(self.path).path
            if path == '/api/analyze':
                with JOB_LOCK:
                    if any(j['label']=='Analyze games and moments' and j['state'] in ('queued','running') for j in JOBS.values()):
                        raise ValueError('An analysis is already queued or running. Cancel it or wait for completion.')
                work = analysis_api.prepare(STORE, payload)
                return self.response({'job': enqueue('Analyze games and moments', work, background=True)})
            if path == '/api/analysis-keep':
                return self.response({'id': analysis_api.keep(STORE,payload)})
            if path == '/api/analysis-replay':
                return self.response({'id': analysis_api.mark_replay(STORE,payload)})
            if path == '/api/settings':
                roots = payload.get('roots', STORE.setting('roots', []))
                for root in roots:
                    if not Path(root).is_dir() and not (Path(root).is_file() and Path(root).suffix.lower() in EXTENSIONS):
                        raise ValueError('Folder not found: '+root)
                output = Path(payload.get('output', STORE.setting('output', str(DEFAULT_OUTPUT)))).resolve()
                if not output.is_absolute():
                    raise ValueError('Choose an absolute export folder')
                output.mkdir(parents=True, exist_ok=True)
                STORE.backup()
                STORE.set_setting('roots', list(dict.fromkeys(str(Path(r).resolve()) for r in roots)))
                STORE.set_setting('output', str(output))
                return self.response({'job': enqueue('Scan recordings', scan)})
            if path == '/api/cancel':
                with JOB_LOCK:
                    job = JOBS.get(payload.get('id'))
                    if not job or job['state'] not in ('queued', 'running') or job['label'] == 'Permanently delete recording':
                        raise ValueError('This job cannot be cancelled')
                    job['cancel_requested'] = True
                return self.response({'ok': True})
            if path == '/api/scan':
                return self.response({'job': enqueue('Scan recordings', scan)})
            if path == '/api/video':
                STORE.update_video(payload['id'], payload)
            elif path == '/api/range':
                return self.response({'id': STORE.save_range(payload)})
            elif path == '/api/remove-range':
                STORE.backup()
                STORE.execute('DELETE FROM ranges WHERE id=?', (int(payload['id']),))
            elif path == '/api/export':
                return self.response({'job': enqueue('Extract selected clips', lambda j: export_job(payload, j))})
            elif path == '/api/trash':
                trash_video(payload['id'], payload.get('confirmation', ''))
            elif path == '/api/check-delete':
                video = STORE.video(payload['id'])
                unchanged(video)
                deletion_check(STORE, video)
            elif path == '/api/restore':
                restore_video(payload['id'])
            elif path == '/api/purge':
                # Serialise all source deletion against active exports/scans.
                return self.response({'job': enqueue('Permanently delete recording', lambda j: purge_video(payload['id'], payload.get('confirmation', '')))})
            elif path == '/api/backup':
                return self.response({'path': STORE.backup()})
            elif path == '/api/open':
                if payload.get('kind') == 'output':
                    target = Path(STORE.setting('output', str(DEFAULT_OUTPUT)))
                elif payload.get('kind') == 'data':
                    target = STORE.directory
                elif payload.get('kind') == 'clip':
                    rows = STORE.rows('SELECT exported FROM ranges WHERE id=?', (int(payload['id']),))
                    target = Path(rows[0]['exported']) if rows and rows[0]['exported'] else None
                else:
                    target = Path(STORE.video(payload['id'])['path'])
                if target is None or not target.exists():
                    raise ValueError('File or folder is unavailable')
                if target.is_file():
                    import subprocess
                    subprocess.Popen(['explorer.exe', '/select,', str(target)], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                else:
                    os.startfile(str(target))
            elif path == '/api/losslesscut':
                source = unchanged(STORE.video(payload['id']))
                executable = Path(os.environ['LOCALAPPDATA'])/'Programs/LosslessCut/LosslessCut.exe'
                if not executable.is_file():
                    raise ValueError('LosslessCut is not installed at its expected location')
                import subprocess
                subprocess.Popen([str(executable), str(source)], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            elif path == '/api/preview':
                video = STORE.video(payload['id'])
                source = unchanged(video)
                start = max(0, min(float(payload.get('start', 0)), max(0, video['duration']-1)))
                track = int(payload.get('track', 0))
                key = hashlib.sha256(f'{video["id"]}:{video["mtime_ns"]}:{start}:{track}'.encode()).hexdigest()
                target = STORE.directory/'previews'/(key+'.mp4')
                target.parent.mkdir(exist_ok=True)
                def make_preview(job):
                    if not target.exists():
                        partial = target.with_name(key+'.partial.mp4')
                        try:
                            run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', str(start), '-i', str(source), '-t', '120', '-map', '0:v:0', '-map', f'0:a:{track}?', '-vf', 'scale=960:-2', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-movflags', '+faststart', '-y', str(partial)], 600)
                            partial.rename(target)
                        finally:
                            partial.unlink(missing_ok=True)
                    return {'key': key, 'start': start}
                return self.response({'job': enqueue('Make 2-minute compatibility preview', make_preview)})
            elif path == '/api/clear-cache':
                if not WORK.empty() or any(j['state'] == 'running' for j in JOBS.values()):
                    raise ValueError('Wait for media jobs to finish')
                with THUMB_LOCK:
                    for folder in ('thumbnails', 'previews'):
                        target = STORE.directory/folder
                        if target.parent.resolve() != STORE.directory.resolve():
                            raise ValueError('Invalid cache path')
                        if target.exists():
                            shutil.rmtree(target)
            else:
                return self.response({'error': 'Not found'}, 404)
            return self.response({'ok': True})
        except Exception as exc:
            self.response({'error': str(exc)}, 400)


THUMB_LOCK = threading.Lock()


class LocalServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    global STORE
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8791)
    parser.add_argument('--data', default=str(DATA))
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        raise SystemExit('FFmpeg and FFprobe must be on PATH')
    try:
        server = LocalServer(('127.0.0.1', args.port), Handler)
    except OSError:
        try:
            health = json.load(urllib.request.urlopen(f'http://127.0.0.1:{args.port}/health', timeout=3))
            if health.get('source') == str(HERE):
                if not args.no_browser:
                    webbrowser.open(f'http://127.0.0.1:{args.port}')
                return
        except Exception:
            pass
        raise SystemExit(f'Port {args.port} is occupied by another application')
    STORE = Store(args.data)
    JOBS.update(STORE.setting('jobs', {}))
    for job in JOBS.values():
        if job['state'] in ('running', 'queued'):
            job['state'] = 'error'
            job['error'] = 'Previous run was interrupted. Completed exports remain saved. Retry any unfinished clips.'
    persist_jobs()
    if not STORE.setting('output'):
        DEFAULT_OUTPUT.mkdir(parents=True, exist_ok=True)
        STORE.set_setting('output', str(DEFAULT_OUTPUT))
    for video in STORE.rows("SELECT * FROM videos WHERE trash_path!='' AND availability!='deleted'"):
        if Path(video['trash_path']).exists() and not Path(video['path']).exists():
            STORE.execute("UPDATE videos SET availability='trash' WHERE id=?", (video['id'],))
    STORE.backup()
    STOP.clear()
    jobs_thread=threading.Thread(target=worker,name='Footage media jobs',daemon=True)
    scan_thread=threading.Thread(target=automatic_scans,name='Footage scan schedule',daemon=True)
    jobs_thread.start()
    scan_thread.start()
    if not args.no_browser:
        webbrowser.open(f'http://127.0.0.1:{args.port}')
    print(f'Footage Desk ready at http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    finally:
        STOP.set()
        with JOB_LOCK:
            for job in JOBS.values():
                if job['state'] in ('queued','running'):
                    job['cancel_requested']=True
        server.server_close()
        jobs_thread.join(timeout=8)
        scan_thread.join(timeout=2)
        if not jobs_thread.is_alive():
            STORE.db.close()


if __name__ == '__main__':
    main()

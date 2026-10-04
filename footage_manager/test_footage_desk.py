"""Integration tests use generated disposable footage, never the user's recordings."""
import json
import http.client
import shutil
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).parent))
import app
from media import JOB_CONTEXT, Cancelled, deletion_check, export_clip, probe, run
from store import Store


class FootageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='footage-desk-test-')
        cls.root = Path(cls.temp.name)
        cls.fixture = cls.root/'fixture.mp4'
        run(['ffmpeg', '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440', '-f', 'lavfi', '-i', 'sine=frequency=880', '-t', '16', '-map', '0:v', '-map', '1:a', '-map', '2:a', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '30', '-c:a', 'aac', '-metadata:s:a:0', 'title=Game', '-metadata:s:a:1', 'title=Mic', str(cls.fixture)])

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.dir = self.root/self._testMethodName
        self.dir.mkdir()
        self.source = self.dir/'recording.mp4'
        shutil.copy2(self.fixture, self.source)
        self.store = Store(self.dir/'data')
        st = self.source.stat()
        duration, streams = probe(self.source)
        self.id = self.store.execute('INSERT INTO videos(path,name,size,mtime_ns,duration,streams) VALUES (?,?,?,?,?,?)', (str(self.source), self.source.name, st.st_size, st.st_mtime_ns, duration, json.dumps(streams)))
        app.STORE = self.store

    def tearDown(self):
        self.store.db.close()

    def clip(self, start=2, end=5, decision='keep'):
        ident = self.store.save_range({'video_id': self.id, 'start': start, 'end': end, 'decision': decision, 'title': 'Clutch', 'tags': 'funny, clutch', 'collection': 'Episode 1'})
        return self.store.rows('SELECT * FROM ranges WHERE id=?', (ident,))[0]

    def export(self, clip, mode='copy'):
        return export_clip(self.store, clip, self.dir/'exports', padding=0, mode=mode)

    def test_multiple_ranges_tracks_and_exact_export(self):
        first, second = self.clip(), self.clip(8, 12)
        before = self.source.stat()
        for clip, mode in ((first, 'copy'), (second, 'exact')):
            output = self.export(clip, mode)
            duration, streams = probe(output)
            self.assertEqual(2, len([s for s in streams if s['type']=='audio']))
            self.assertTrue(2 <= duration <= 6)
        self.assertEqual(before.st_size, self.source.stat().st_size)
        self.assertEqual(before.st_mtime_ns, self.source.stat().st_mtime_ns)
        self.store.update_video(self.id, {'status':'keep_clips'})
        self.assertTrue(deletion_check(self.store, self.store.video(self.id)))

    def test_export_portable_source_metadata_required_for_disposal(self):
        clip=self.clip()
        output=self.export(clip)
        sidecar=Path(output+'.source.json')
        metadata=json.loads(sidecar.read_text(encoding='utf-8'))
        self.assertEqual(str(self.source),metadata['source_path'])
        self.assertEqual((2,5),(metadata['requested_start_seconds'],metadata['requested_end_seconds']))
        self.assertEqual(2,len([s for s in metadata['streams'] if s['type']=='audio']))
        self.store.update_video(self.id,{'status':'keep_clips'})
        sidecar.unlink()
        with self.assertRaisesRegex(ValueError,'source metadata'):
            deletion_check(self.store,self.store.video(self.id))

    def test_unresolved_ranges_block_deletion(self):
        clip = self.clip()
        self.export(clip)
        self.store.update_video(self.id, {'status':'keep_clips'})
        self.clip(10, 11, 'maybe')
        with self.assertRaisesRegex(ValueError, 'Later'):
            deletion_check(self.store, self.store.video(self.id))

    def test_changed_range_invalidates_export(self):
        clip = self.clip()
        self.export(clip)
        self.store.update_video(self.id, {'status':'keep_clips'})
        self.store.save_range({**clip, 'end':6})
        with self.assertRaisesRegex(ValueError, 'current verified'):
            deletion_check(self.store, self.store.video(self.id))

    def test_missing_export_blocks_deletion(self):
        output = self.export(self.clip())
        Path(output).unlink()
        self.store.update_video(self.id, {'status':'keep_clips'})
        with self.assertRaisesRegex(ValueError, 'missing or changed'):
            deletion_check(self.store, self.store.video(self.id))

    def test_source_change_blocks_export(self):
        clip = self.clip()
        with self.source.open('ab') as f:
            f.write(b'changed')
        with self.assertRaisesRegex(ValueError, 'Source changed'):
            self.export(clip)

    def test_cancel_stops_running_subprocess(self):
        job = {'cancel_requested':False}
        result = []
        def task():
            JOB_CONTEXT.job = job
            try:
                run([sys.executable, '-c', 'import time; time.sleep(60)'], 65)
            except Cancelled:
                result.append('cancelled')
            finally:
                JOB_CONTEXT.job = {}
        thread = threading.Thread(target=task)
        thread.start()
        time.sleep(.2)
        job['cancel_requested'] = True
        thread.join(3)
        self.assertFalse(thread.is_alive(), 'Cancellation must stop an active command promptly')
        self.assertEqual(['cancelled'], result)

    def test_trash_restore_and_purge(self):
        output = self.export(self.clip())
        self.store.update_video(self.id, {'status':'keep_clips'})
        with self.assertRaises(ValueError):
            app.trash_video(self.id, 'wrong')
        app.trash_video(self.id, self.source.name)
        self.assertFalse(self.source.exists())
        self.assertEqual('trash', self.store.video(self.id)['availability'])
        app.restore_video(self.id)
        self.assertTrue(self.source.exists())
        app.trash_video(self.id, self.source.name)
        app.purge_video(self.id, 'DELETE '+self.source.name)
        self.assertEqual('deleted', self.store.video(self.id)['availability'])
        self.assertTrue(Path(output).is_file())

    def test_keep_full_cannot_be_trashed(self):
        self.store.update_video(self.id, {'status':'keep_full'})
        with self.assertRaises(ValueError):
            app.trash_video(self.id, self.source.name)
        self.assertTrue(self.source.exists())

    def test_coverage_and_persistence(self):
        self.clip()
        self.store.update_video(self.id, {'coverage':[[0,3],[2,5],[10,12]], 'position':11, 'game':'League', 'title':'Ranked with friends', 'notes':'Revisit ending'})
        self.assertEqual([[0.0,5.0],[10.0,12.0]], json.loads(self.store.video(self.id)['coverage']))
        backup = self.store.backup()
        self.assertTrue(Path(backup).exists())
        reopened = Store(self.dir/'data')
        self.assertEqual('League', reopened.video(self.id)['game'])
        self.assertEqual('Ranked with friends', reopened.video(self.id)['title'])
        self.assertEqual('Episode 1', reopened.ranges(self.id)[0]['collection'])
        reopened.db.close()

    def test_single_instance_port_is_exclusive(self):
        server = app.LocalServer(('127.0.0.1', 0), app.Handler)
        try:
            with self.assertRaises(OSError):
                app.LocalServer(('127.0.0.1', server.server_port), app.Handler)
        finally:
            server.server_close()

    def test_fractional_boundaries_survive_edits(self):
        clip = self.clip(2.266667, 6.816667)
        self.store.save_range({**clip, 'title':'Precise moment'})
        restored = self.store.ranges(self.id)[0]
        self.assertAlmostEqual(2.266667, restored['start'])
        self.assertAlmostEqual(6.816667, restored['end'])

    def test_scan_preserves_user_data_and_detects_change(self):
        self.clip()
        self.store.update_video(self.id, {'game':'League', 'tags':'special', 'status':'keep_full'})
        self.store.set_setting('roots', [str(self.source)])
        self.store.set_setting('output', str(self.dir/'exports'))
        app.scan({'progress':''})
        self.assertEqual('keep_full', self.store.video(self.id)['status'])
        with self.source.open('ab') as f:
            f.write(b'new')
        app.scan({'progress':''})
        self.assertEqual('rereview', self.store.video(self.id)['status'])
        self.assertEqual('special', self.store.video(self.id)['tags'])
        self.assertEqual(1, len(self.store.ranges(self.id)))

    def test_http_seek_ranges_and_csrf(self):
        server = ThreadingHTTPServer(('127.0.0.1',0), app.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            for resource in ('workflow.js', 'workflow.css', 'clip_editor.js', 'clip_drag.js', 'clip_history.js', 'clip_editor.css', 'recording_timeline.js', 'timeline_review.css'):
                with urllib.request.urlopen(base+'/'+resource) as response:
                    self.assertEqual(200,response.status)
                    self.assertTrue(response.read())
            with urllib.request.urlopen(base+'/between_games.js') as response:
                self.assertIn('reviewSourceRange',response.read().decode('utf-8'))
            with urllib.request.urlopen(base+f'/api/analysis-between-marks?id={self.id}') as response:
                self.assertEqual('ineligible',json.load(response)['state'])
            request = urllib.request.Request(base+f'/media?id={self.id}', headers={'Range':'bytes=100-199'})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(206, response.status)
                with self.source.open('rb') as f:
                    f.seek(100)
                    self.assertEqual(f.read(100), response.read())
            request = urllib.request.Request(base+f'/media?id={self.id}', headers={'Range':'bytes=-30'})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(self.source.read_bytes()[-30:], response.read())
            request = urllib.request.Request(base+'/api/video', data=json.dumps({'id':self.id,'status':'delete'}).encode(), headers={'Content-Type':'application/json'})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(403, error.exception.code)
            self.assertEqual('unreviewed', self.store.video(self.id)['status'])
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
            connection.request('POST', '/api/video', body=json.dumps({'id':self.id, 'position':4}), headers={'Content-Type':'application/json', 'X-Footage-Token':'stale-session'})
            rejected = connection.getresponse()
            self.assertEqual(403, rejected.status)
            rejected.read()
            connection.request('GET', '/health')
            recovered = connection.getresponse()
            self.assertEqual(200, recovered.status)
            recovered.read()
            connection.close()
            with urllib.request.urlopen(base+'/api/catalogue.csv') as response:
                self.assertIn('review_status', response.read().decode('utf-8-sig'))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main(verbosity=2)

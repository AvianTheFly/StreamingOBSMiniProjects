"""Actual file bytes, bounded buffering, seeking and disconnected-reader cleanup."""
import io
from http.server import ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen

from lib.http_files import serve_file
from lib.hotkey_editor.transport import _make_handler
from twitch_celebrations.http_server import handler as celebrations_handler
from types import SimpleNamespace


class Response:
    def __init__(self, requested='', *, command='GET'):
        self.headers = {'Range': requested}
        self.command = command
        self.sent = {}
        self.wfile = io.BytesIO()
        self.close_connection = False

    def send_response(self, status):
        self.status = status

    def send_header(self, name, value):
        self.sent[name] = str(value)

    def end_headers(self):
        pass

    def send_error(self, status):
        self.status = status


class FileResponseTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / 'asset.mp4'
        self.payload = bytes(range(256)) * 2049
        self.path.write_bytes(self.payload)

    def test_complete_response_and_ranges_preserve_exact_bytes_and_headers(self):
        cases = [('', self.payload, 200), ('bytes=100-199', self.payload[100:200], 206),
                 ('bytes=-77', self.payload[-77:], 206), ('bytes=524288-', self.payload[524288:], 206),
                 ('bytes=524288-9999999999', self.payload[524288:], 206),
                 ('bytes=-9999999999', self.payload, 206)]
        for requested, expected, status in cases:
            with self.subTest(requested=requested):
                response = Response(requested)
                serve_file(response, self.path, headers={'Access-Control-Allow-Origin': '*'})
                self.assertEqual(response.status, status)
                self.assertEqual(response.wfile.getvalue(), expected)
                self.assertEqual(int(response.sent['Content-Length']), len(expected))
                self.assertEqual(response.sent['Accept-Ranges'], 'bytes')
                self.assertEqual(response.sent['Content-Type'], 'video/mp4')
                self.assertEqual(response.sent['Access-Control-Allow-Origin'], '*')

    def test_bad_ranges_are_bounded_and_report_current_size(self):
        for requested in ('bytes=', 'bytes=-0', 'bytes=99-1', 'bytes=999999-',
                          'bytes=0-1,3-4', 'items=0-5', 'bytes=' + '9'*5000 + '-'):
            with self.subTest(requested=requested[:30]):
                response = Response(requested)
                serve_file(response, self.path)
                self.assertEqual(response.status, 416)
                self.assertEqual(response.sent['Content-Range'], f'bytes */{len(self.payload)}')
                self.assertEqual(response.sent['Content-Length'], '0')
                self.assertEqual(response.wfile.getvalue(), b'')

    def test_empty_missing_and_head_responses(self):
        response = Response(command='HEAD')
        serve_file(response, self.path)
        self.assertEqual(response.status, 200)
        self.assertEqual(int(response.sent['Content-Length']), len(self.payload))
        self.assertEqual(response.wfile.getvalue(), b'')
        self.path.write_bytes(b'')
        response = Response()
        serve_file(response, self.path)
        self.assertEqual(response.status, 200)
        self.assertEqual(response.sent['Content-Length'], '0')
        response = Response('bytes=0-')
        serve_file(response, self.path)
        self.assertEqual(response.status, 416)
        self.path.unlink()
        response = Response()
        serve_file(response, self.path)
        self.assertEqual(response.status, 404)

    def test_large_file_reads_are_bounded_and_small_ranges_read_only_requested_bytes(self):
        # The wrapper observes real disk reads, rather than retaining a second file copy.
        original_open = Path.open
        reads, opened = [], []
        class TrackedFile:
            def __init__(self, stream): self.stream = stream
            def __enter__(self): return self
            def __exit__(self, *args): self.stream.close()
            def fileno(self): return self.stream.fileno()
            def seek(self, offset): return self.stream.seek(offset)
            def read(self, count):
                reads.append(count)
                if not 0 < count <= 256 * 1024:
                    raise AssertionError('file response allocated an unbounded buffer')
                return self.stream.read(count)
        def open_tracked(path, *args, **kwargs):
            result = TrackedFile(original_open(path, *args, **kwargs))
            opened.append(result)
            return result
        with patch.object(Path, 'open', open_tracked), patch.object(Path, 'read_bytes', side_effect=AssertionError('whole-file read')):
            serve_file(Response(), self.path)
            self.assertGreater(len(reads), 1)
            reads.clear()
            response = Response('bytes=100-4195')
            serve_file(response, self.path)
            self.assertEqual(sum(reads), 4096)
            self.assertEqual(response.wfile.getvalue(), self.payload[100:4196])
        self.assertTrue(all(file.stream.closed for file in opened))

    def test_disconnect_stops_reading_and_closes_the_file(self):
        opened = []
        original_open = Path.open
        def track(path, *args, **kwargs):
            stream = original_open(path, *args, **kwargs)
            opened.append(stream)
            return stream
        response = Response()
        response.wfile = SimpleNamespace(write=lambda data: (_ for _ in ()).throw(ConnectionAbortedError()))
        with patch.object(Path, 'open', track):
            serve_file(response, self.path)
        self.assertTrue(response.close_connection)
        self.assertTrue(all(stream.closed for stream in opened))

    def test_editor_and_twitch_routes_support_seeking_through_real_http(self):
        editor = _make_handler(current={'proj': {'asset_dir': Path(self.folder.name), 'extensions': {'.mp4'}}},
                               all_projects=[], server_ref=[None])
        service = SimpleNamespace(asset=lambda name: self.path if name == self.path.name else None)
        for kind in ('editor', 'twitch'):
            with self.subTest(kind=kind):
                # Twitch validates the actual bound loopback host/port.
                server = ThreadingHTTPServer(('127.0.0.1', 0), editor)
                if kind == 'twitch':
                    server.RequestHandlerClass = celebrations_handler(service, Path(self.folder.name), server.server_port)
                worker = threading.Thread(target=server.serve_forever)
                worker.start()
                try:
                    prefix = '/assets/' if kind == 'editor' else '/media/'
                    request = Request(f'http://127.0.0.1:{server.server_port}{prefix}{self.path.name}',
                                      headers={'Range': 'bytes=500-999'})
                    with urlopen(request, timeout=3) as response:
                        self.assertEqual(response.status, 206)
                        self.assertEqual(response.read(), self.payload[500:1000])
                        self.assertEqual(response.headers['Content-Range'], f'bytes 500-999/{len(self.payload)}')
                        if kind == 'twitch':
                            self.assertEqual(response.headers['Cache-Control'], 'no-store')
                            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
                finally:
                    server.shutdown()
                    server.server_close()
                    worker.join(3)


if __name__ == '__main__':
    unittest.main()

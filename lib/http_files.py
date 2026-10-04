"""Bounded file responses for existing HTTP owners; callers authorize paths."""
from __future__ import annotations

import mimetypes
import os
from pathlib import Path
import re

CHUNK_BYTES = 256 * 1024


def serve_file(handler, path, *, content_type=None, headers=None):
    """Stream a complete file or one byte range without materializing the asset."""
    path = Path(path)
    try:
        stream = path.open('rb')
    except FileNotFoundError:
        handler.send_error(404)
        return
    with stream:
        size = os.fstat(stream.fileno()).st_size
        first, last = 0, size - 1
        requested = handler.headers.get('Range', '')
        try:
            if requested:
                match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
                if not match or not any(match.groups()):
                    raise ValueError('Invalid range')
                left, right = match.groups()
                if left:
                    first = int(left)
                    last = min(int(right), last) if right else last
                else:
                    first = max(0, size - int(right))
                if first > last or first >= size:
                    raise ValueError('Unsatisfiable range')
        except ValueError:
            handler.send_response(416)
            handler.send_header('Content-Range', f'bytes */{size}')
            handler.send_header('Content-Length', '0')
            for key, value in (headers or {}).items():
                handler.send_header(key, value)
            handler.end_headers()
            return
        try:
            handler.send_response(206 if requested else 200)
            handler.send_header('Content-Type', content_type or mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
            handler.send_header('Content-Length', str(last - first + 1))
            handler.send_header('Accept-Ranges', 'bytes')
            if requested:
                handler.send_header('Content-Range', f'bytes {first}-{last}/{size}')
            for key, value in (headers or {}).items():
                handler.send_header(key, value)
            handler.end_headers()
            if getattr(handler, 'command', 'GET') == 'HEAD':
                return
            stream.seek(first)
            remaining = last - first + 1
            while remaining:
                chunk = stream.read(min(CHUNK_BYTES, remaining))
                if not chunk:
                    handler.close_connection = True  # File shortened during transfer.
                    break
                handler.wfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            handler.close_connection = True

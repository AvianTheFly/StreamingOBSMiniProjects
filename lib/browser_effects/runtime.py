"""One loopback server for independent project channels, started by the supported Hub."""
import threading
from http.server import ThreadingHTTPServer
from .session import Channel
from .obs_source import PORT
from lib.runtime_cleanup import run_cleanup

_channels = {}
_lock = threading.RLock()
_server = None


def get_channel(project):
    with _lock:
        if project not in _channels:
            _channels[project] = Channel()
        return _channels[project]


def find_channel(project):
    with _lock:
        return _channels.get(project)


def start_browser_effects(stop):
    global _server
    from .http_server import handler
    with _lock:
        if _server:
            return
        _server = ThreadingHTTPServer(('127.0.0.1', PORT), handler(find_channel, PORT))
        _server.daemon_threads = True
        server = _server
        try:
            threading.Thread(target=server.serve_forever, name='browser-effects-http', daemon=True).start()
        except Exception:
            server.server_close()
            _server = None
            raise
    print(f'[browser-effects] Ready: http://127.0.0.1:{PORT}', flush=True)

    def shutdown():
        global _server
        stop.wait()
        close_server()

    def close_server():
        global _server
        with _lock:
            channels = list(_channels.values())
        try:
            run_cleanup('browser-effects', *(channel.stop for channel in channels),
                        server.shutdown, server.server_close)
        finally:
            with _lock:
                if _server is server:
                    _server = None

    try:
        threading.Thread(target=shutdown, name='browser-effects-shutdown', daemon=True).start()
    except Exception:
        close_server()
        raise

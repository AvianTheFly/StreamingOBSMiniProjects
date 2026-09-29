"""One loopback server for independent project channels, started by the supported Hub."""
import threading
from http.server import ThreadingHTTPServer
from .session import Channel
from .obs_source import PORT

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
    threading.Thread(target=server.serve_forever, name='browser-effects-http', daemon=True).start()
    print(f'[browser-effects] Ready: http://127.0.0.1:{PORT}', flush=True)

    def shutdown():
        global _server
        stop.wait()
        with _lock:
            for channel in _channels.values():
                channel.stop()
        server.shutdown()
        server.server_close()
        with _lock:
            _server = None
    threading.Thread(target=shutdown, name='browser-effects-shutdown', daemon=True).start()

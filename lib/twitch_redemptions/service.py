"""Single Hub-owned lifecycle; no additional keyboard listeners."""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from .catalog import PORT
from .engine import RewardBridge
from .http_server import handler
from .obs_source import recover_overlay


def start_viewer_rewards(stop):
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), BaseHTTPRequestHandler)
    except OSError:
        print(f"[viewer-rewards] Port {PORT} is occupied; bridge not started.")
        return None
    bridge = RewardBridge(stop)
    server.RequestHandlerClass = handler(bridge)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True, name="viewer-rewards-ui").start()
    threading.Thread(target=bridge.listen, daemon=True, name="viewer-rewards-twitch").start()
    threading.Thread(target=bridge.sync_availability, daemon=True, name="viewer-rewards-availability").start()
    threading.Thread(target=recover_overlay, args=(bridge,), daemon=True, name='viewer-rewards-obs').start()

    def shutdown():
        stop.wait()
        if bridge.socket:
            bridge.socket.close()
        server.shutdown()
        server.server_close()

    threading.Thread(target=shutdown, daemon=True, name="viewer-rewards-shutdown").start()
    print(f"[viewer-rewards] Test lab: http://127.0.0.1:{PORT}")
    return bridge

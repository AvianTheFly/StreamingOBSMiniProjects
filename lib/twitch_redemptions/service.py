"""Single Hub-owned lifecycle; no additional keyboard listeners."""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from .catalog import PORT
from .engine import RewardBridge
from .http_server import handler
from .obs_source import recover_overlay
from lib.runtime_cleanup import run_cleanup


def start_viewer_rewards(stop):
    service_stop = threading.Event()
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), BaseHTTPRequestHandler)
    except OSError:
        print(f"[viewer-rewards] Port {PORT} is occupied; bridge not started.")
        return None
    try:
        bridge = RewardBridge(service_stop)
        server.RequestHandlerClass = handler(bridge)
    except Exception:
        server.server_close()
        raise
    server.daemon_threads = True
    serving = False

    def close_service():
        service_stop.set()
        actions = []
        if bridge.socket:
            actions.append(bridge.socket.close)
        if serving:
            actions.append(server.shutdown)
        actions.append(server.server_close)
        run_cleanup('viewer-rewards', *actions)

    def shutdown():
        stop.wait()
        close_service()

    try:
        threading.Thread(target=server.serve_forever, daemon=True, name="viewer-rewards-ui").start()
        serving = True
        threading.Thread(target=bridge.listen, daemon=True, name="viewer-rewards-twitch").start()
        threading.Thread(target=bridge.sync_availability, daemon=True, name="viewer-rewards-availability").start()
        threading.Thread(target=recover_overlay, args=(bridge,), daemon=True, name='viewer-rewards-obs').start()
        threading.Thread(target=shutdown, daemon=True, name="viewer-rewards-shutdown").start()
    except Exception:
        close_service()
        raise
    print(f"[viewer-rewards] Test lab: http://127.0.0.1:{PORT}")
    return bridge

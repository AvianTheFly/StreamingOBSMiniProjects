"""Loopback control API and capability-protected overlay."""
import json
import mimetypes
import secrets
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from .catalog import PORT, PAGE, ASSETS, EFFECTS
from .config import configure_effect

WEB = PAGE.parent / 'viewer_rewards'
STATIC = {'control.js', 'overlay.js', 'renderer.js', 'styles.css'}


def handler(bridge, port=PORT):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log OAuth codes or overlay capability URLs.

        def send(self, value, status=200, content_type="application/json"):
            data = json.dumps(value).encode() if content_type == "application/json" else value
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def valid_host(self):
            return self.headers.get("Host") in {f"127.0.0.1:{port}", f"localhost:{port}"}

        def overlay_auth(self):
            return secrets.compare_digest(parse_qs(urlparse(self.path).query).get("key", [""])[0], bridge.overlay_key)

        def do_GET(self):
            if not self.valid_host():
                return self.send({"error": "Invalid host"}, 403)
            path = urlparse(self.path).path
            if path == "/api/status":
                return self.send(bridge.status())
            if path == "/api/next":
                active = parse_qs(urlparse(self.path).query).get('active', ['1'])[0] == '1'
                return self.send(bridge.next_effect(active) if self.overlay_auth() else {"error": "Forbidden"}, 200 if self.overlay_auth() else 403)
            if path in {"/", "/overlay"}:
                if path == "/overlay" and not self.overlay_auth():
                    return self.send({"error": "Forbidden"}, 403)
                data = PAGE.read_text(encoding="utf-8").replace("__CSRF__", bridge.csrf if path == "/" else "")
                return self.send(data.encode(), content_type="text/html; charset=utf-8")
            if path.startswith("/assets/"):
                name = path.removeprefix("/assets/")
                if name in {v["image"] for v in EFFECTS.values()} and (ASSETS / name).is_file():
                    return self.send((ASSETS / name).read_bytes(), content_type=mimetypes.guess_type(name)[0])
            if path.startswith('/web/') and path.removeprefix('/web/') in STATIC:
                file = WEB / path.removeprefix('/web/')
                return self.send(file.read_bytes(), content_type=mimetypes.guess_type(file.name)[0])
            self.send({"error": "Not found"}, 404)

        def do_POST(self):
            if not self.valid_host():
                return self.send({"error": "Invalid host"}, 403)
            path = urlparse(self.path).path
            authorized = self.overlay_auth() if path == "/api/ack" else secrets.compare_digest(self.headers.get("X-Hub-CSRF", ""), bridge.csrf)
            if not authorized:
                return self.send({"error": "Forbidden"}, 403)
            if self.headers.get('Origin') not in {None, f'http://127.0.0.1:{port}', f'http://localhost:{port}'}:
                return self.send({'error': 'Forbidden origin'}, 403)
            try:
                size = int(self.headers.get("Content-Length", 0))
                if not 0 <= size <= 4096:
                    raise ValueError("Request too large")
                body = json.loads(self.rfile.read(size) or b"{}")
                if path == "/api/connect":
                    return self.send(bridge.connect())
                if path == "/api/install":
                    bridge.install_rewards()
                elif path == "/api/obs":
                    bridge.attach_obs()
                elif path == "/api/enabled":
                    with bridge.lock:
                        bridge.config["enabled"] = body.get("enabled") is True
                        bridge._write("settings.json", bridge.config)
                elif path == "/api/test":
                    bridge.enqueue(body.get("key"))
                elif path == '/api/configure':
                    configure_effect(bridge, body.get('key'), body.get('settings'))
                elif path == "/api/ack":
                    bridge.acknowledge(body.get("id"), body.get('status', 'played'))
                else:
                    return self.send({"error": "Not found"}, 404)
                self.send({"ok": True})
            except (RuntimeError, ValueError, KeyError) as exc:
                self.send({"error": str(exc)}, 400)
            except Exception:
                self.send({"error": "Could not complete action. Check that OBS is running and connected."}, 503)

    return Handler

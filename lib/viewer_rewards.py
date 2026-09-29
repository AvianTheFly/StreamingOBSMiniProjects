"""Bounded Twitch redeems for the Hub's dedicated, silent OBS overlay.

Credentials and redemption deduplication live outside the checkout. This bridge
never interprets viewer text as a command or modifies existing media modules.
"""
from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import requests

from lib.paths import PROJECT_ROOT

PORT = 7442
SOURCE = "Hub Viewer Stickers"
SCOPE = "channel:manage:redemptions"
EVENT = "channel.channel_points_custom_reward_redemption.add"
ASSETS = PROJECT_ROOT / "hub_ui" / "viewer_assets"
PAGE = PROJECT_ROOT / "hub_ui" / "viewer_rewards.html"
EFFECTS = {
    "bear": dict(title="Tiny Bot Lane Bear", cost=10, duration=1000, image="botlaneBear-chat.png", label="", color="#d97706"),
    "oops": dict(title="Tiny Udyr Oops", cost=10, duration=1000, image="botlaneOops-chat.png", label="OOPS", color="#0891b2"),
    "cannon": dict(title="Cannon Incident", cost=15, duration=1000, image="botlaneOops-chat.png", label="CANNON?", color="#2563eb"),
    "calculated": dict(title="Totally Calculated", cost=15, duration=1000, image="botlaneBear-chat.png", label="CALCULATED", color="#7c3aed"),
    "fear": dict(title="No Fear Bot Lane", cost=25, duration=1500, image="botlaneBear-chat.png", label="NO FEAR", color="#db2777"),
    "party": dict(title="Bear Victory Dance", cost=50, duration=2000, image="botlaneBear-chat.png", label="BOT LANE DIFF", color="#d97706"),
}


class RewardBridge:
    def __init__(self, stop, root=None, clock=time.monotonic):
        self.stop = stop
        self.clock = clock
        self.root = Path(root or Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "StreamingHub" / "viewer-rewards")
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.api_lock = threading.RLock()
        self.csrf = secrets.token_urlsafe(32)
        self.overlay_key = self._read("overlay-key.json", {}).get("key") or secrets.token_urlsafe(32)
        self._write("overlay-key.json", {"key": self.overlay_key})
        self.config = self._read("settings.json", {"enabled": False, "rewards": {}})
        self.tokens = self._read("credentials.json", {})
        self.db = sqlite3.connect(self.root / "redemptions.sqlite", check_same_thread=False)
        self.db.execute("CREATE TABLE IF NOT EXISTS redemptions (id TEXT PRIMARY KEY, reward TEXT, status TEXT, created REAL)")
        self.db.execute("UPDATE redemptions SET status='interrupted: review in Twitch' WHERE status='queued'")
        self.db.commit()
        self.pending = None
        self.last_play = -1000.0
        self.last_obs = -1000.0
        self.connected = False
        self.message = "Connect Twitch to enable automatic stickers."
        self.auth = None
        self.auth_busy = False
        self.socket = None
        self.paused_remote = None

    def _read(self, name, fallback):
        try:
            return json.loads((self.root / name).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return fallback

    def _write(self, name, value):
        p = self.root / name
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(value, indent=2), encoding="utf-8")
        tmp.replace(p)

    def status(self):
        with self.lock:
            rows = self.db.execute("SELECT id,reward,status FROM redemptions ORDER BY created DESC LIMIT 12").fetchall()
            return dict(connected=self.connected, enabled=self.config["enabled"],
                        overlay_ready=self.clock() - self.last_obs < 4,
                        message=self.message, auth=self.auth,
                        effects=[dict(key=k, **v) for k, v in EFFECTS.items()],
                        installed=len(self.config.get("rewards", {})),
                        recent=[dict(id=r[0], reward=r[1], status=r[2]) for r in rows])

    def token(self):
        with self.api_lock:
            if not self.tokens:
                raise RuntimeError("Connect Twitch first.")
            if self.tokens.get("expires_at", 0) < time.time() + 120:
                r = requests.post("https://id.twitch.tv/oauth2/token", data={
                    "grant_type": "refresh_token", "refresh_token": self.tokens["refresh_token"],
                    "client_id": os.environ["TWITCH_CLIENT_ID"],
                    "client_secret": os.environ.get("TWITCH_CLIENT_SECRET", ""),
                }, timeout=15)
                if not r.ok:
                    raise RuntimeError("Twitch connection expired. Reconnect Twitch.")
                self._accept_tokens(r.json())
            return self.tokens["access_token"]

    def _accept_tokens(self, data):
        r = requests.get("https://id.twitch.tv/oauth2/validate", headers={
            "Authorization": "OAuth " + data["access_token"]}, timeout=15)
        if not r.ok:
            raise RuntimeError("Twitch could not validate the connection.")
        info = r.json()
        if info.get("user_id") != os.environ.get("TWITCH_BROADCASTER_ID") or SCOPE not in info.get("scopes", []):
            raise RuntimeError("Connect the channel owner's Twitch account with Channel Points permission.")
        self.tokens = dict(access_token=data["access_token"], refresh_token=data["refresh_token"],
                           expires_at=time.time() + int(data["expires_in"]))
        self._write("credentials.json", self.tokens)

    def api(self, method, path, **kwargs):
        with self.api_lock:
            r = requests.request(method, "https://api.twitch.tv/helix/" + path,
                                 headers={"Client-Id": os.environ["TWITCH_CLIENT_ID"],
                                          "Authorization": "Bearer " + self.token()}, timeout=15, **kwargs)
            if not r.ok:
                raise RuntimeError(f"Twitch request failed (HTTP {r.status_code}).")
            return r.json() if r.content else {}

    def connect(self):
        with self.lock:
            if self.auth_busy:
                return self.auth
            self.auth_busy = True
        try:
            r = requests.post("https://id.twitch.tv/oauth2/device", data={
                "client_id": os.environ["TWITCH_CLIENT_ID"], "scopes": SCOPE}, timeout=15)
            if not r.ok:
                raise RuntimeError(f"Twitch device connection failed (HTTP {r.status_code}).")
            data = r.json()
            self.auth = dict(url=data["verification_uri"], code=data["user_code"])
            self.message = "Approve the Channel Points connection on Twitch."
            threading.Thread(target=self._poll_auth, args=(data,), daemon=True).start()
            return self.auth
        except Exception:
            self.auth_busy = False
            raise

    def _poll_auth(self, data):
        deadline = self.clock() + int(data["expires_in"])
        interval = max(5, int(data.get("interval", 5)))
        try:
            while self.clock() < deadline and not self.stop.wait(interval):
                r = requests.post("https://id.twitch.tv/oauth2/token", data={
                    "client_id": os.environ["TWITCH_CLIENT_ID"],
                    "client_secret": os.environ.get("TWITCH_CLIENT_SECRET", ""),
                    "device_code": data["device_code"], "scopes": SCOPE,
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code"}, timeout=15)
                if r.ok:
                    with self.api_lock:
                        self._accept_tokens(r.json())
                    self.message = "Twitch authorized. Connecting to redemption events."
                    return
                error = r.json().get("message", r.json().get("error", ""))
                if "slow_down" in error:
                    interval += 5
                elif "authorization_pending" not in error:
                    raise RuntimeError("Twitch authorization was declined or expired. Reconnect to try again.")
            self.message = "Authorization expired. Click Connect Twitch to try again."
        except Exception as exc:
            self.message = str(exc) if isinstance(exc, RuntimeError) else "Twitch authorization connection failed."
        finally:
            self.auth = None
            self.auth_busy = False

    def install_rewards(self):
        if not self.connected:
            raise RuntimeError("Connect Twitch before installing automatic rewards.")
        params = {"broadcaster_id": os.environ["TWITCH_BROADCASTER_ID"]}
        owned = self.api("GET", "channel_points/custom_rewards", params={**params, "only_manageable_rewards": "true"})["data"]
        for key, effect in EFFECTS.items():
            if not (ASSETS / effect["image"]).is_file():
                raise RuntimeError(f"Missing sticker asset for {effect['title']}.")
            existing = next((r for r in owned if r["id"] == self.config["rewards"].get(key)), None)
            if existing is None:
                existing = next((r for r in owned if r["title"] == effect["title"]), None)
            if existing is None:
                existing = self.api("POST", "channel_points/custom_rewards", params=params, json={
                    "title": effect["title"], "cost": effect["cost"], "background_color": effect["color"],
                    "prompt": f"Automatic small, silent sticker for {effect['duration']/1000:g}s. Requires the Hub + viewer overlay. Failed requests stay in the queue for refund.",
                    "is_enabled": True, "is_global_cooldown_enabled": True, "global_cooldown_seconds": 10,
                    "is_max_per_stream_enabled": True, "max_per_stream": 100,
                    "is_max_per_user_per_stream_enabled": True, "max_per_user_per_stream": 20,
                    "should_redemptions_skip_request_queue": False,
                })["data"][0]
            self.config["rewards"][key] = existing["id"]
            self.api("PATCH", "channel_points/custom_rewards", params={**params, "id": existing["id"]}, json={"is_paused": True})
            with self.lock:
                self._write("settings.json", self.config)
        self.message = "Six automatic sticker rewards installed. Enable effects when the OBS overlay is ready."
        self.paused_remote = None

    def receive(self, event):
        if event.get("broadcaster_user_id") != os.environ.get("TWITCH_BROADCASTER_ID"):
            return False
        key = next((k for k, rid in self.config["rewards"].items() if rid == event.get("reward", {}).get("id")), None)
        if key not in EFFECTS or event.get("status") != "unfulfilled" or not event.get("id"):
            return False
        with self.lock:
            try:
                self.db.execute("INSERT INTO redemptions VALUES (?,?,?,?)", (event["id"], event["reward"]["id"], "received", time.time()))
                self.db.commit()
            except sqlite3.IntegrityError:
                return False
            try:
                self.enqueue(key, event["id"], live=True)
            except RuntimeError as exc:
                self._result(event["id"], str(exc) + ": refund in Twitch")
                return False
        return True

    def enqueue(self, key, redemption_id=None, live=False):
        if key not in EFFECTS:
            raise ValueError("Unknown sticker.")
        with self.lock:
            now = self.clock()
            if self.pending and self.pending["expires"] < now:
                if self.pending["live"]:
                    self._result(self.pending["id"], "overlay timed out: refund in Twitch")
                self.pending = None
            if live and not self.config["enabled"]:
                raise RuntimeError("Effects paused")
            if now - self.last_obs > 4:
                raise RuntimeError("OBS overlay offline")
            if self.pending or now - self.last_play < 3:
                raise RuntimeError("Effects busy")
            self.last_play = now
            self.pending = dict(id=redemption_id or "test-" + secrets.token_hex(8), key=key,
                                expires=now + 8, live=live, delivered=False)
            if live:
                self._result(redemption_id, "queued")
            return self.pending["id"]

    def next_effect(self):
        with self.lock:
            self.last_obs = self.clock()
            if self.pending and self.pending["expires"] < self.clock():
                if self.pending["live"]:
                    self._result(self.pending["id"], "overlay timed out: refund in Twitch")
                self.pending = None
            if not self.pending or self.pending["delivered"]:
                return None
            self.pending["delivered"] = True
            return dict(id=self.pending["id"], key=self.pending["key"], **EFFECTS[self.pending["key"]])

    def _result(self, rid, status):
        self.db.execute("UPDATE redemptions SET status=? WHERE id=?", (status, rid))
        self.db.commit()

    def acknowledge(self, rid):
        with self.lock:
            item = self.pending
            if not item or item["id"] != rid or not item["delivered"] or item["expires"] < self.clock():
                return
            self.pending = None
        if item["live"]:
            try:
                self.api("PATCH", "channel_points/custom_rewards/redemptions", params={
                    "broadcaster_id": os.environ["TWITCH_BROADCASTER_ID"],
                    "reward_id": self.config["rewards"][item["key"]], "id": rid}, json={"status": "FULFILLED"})
                result = "fulfilled"
            except RuntimeError:
                result = "played; mark fulfilled in Twitch"
            with self.lock:
                self._result(rid, result)

    def attach_obs(self):
        from lib.settings_backups import SettingsBackups
        import obs
        SettingsBackups().snapshot()
        client = obs.get_obs()
        scene = obs.get_current_scene()
        inputs = client.send("GetInputList", {}, raw=True)["inputs"]
        existing = next((x for x in inputs if x["inputName"] == SOURCE), None)
        settings = dict(url=f"http://127.0.0.1:{PORT}/overlay?key={self.overlay_key}",
                        width=1920, height=1080, shutdown=True, restart_when_active=True)
        if not existing:
            client.send("CreateInput", {"sceneName": scene, "inputName": SOURCE, "inputKind": "browser_source",
                                       "inputSettings": settings, "sceneItemEnabled": True}, raw=True)
        else:
            if existing["inputKind"] != "browser_source":
                raise RuntimeError("An unrelated OBS source already uses the sticker source name.")
            client.send("SetInputSettings", {"inputName": SOURCE, "inputSettings": settings, "overlay": True}, raw=True)
            items = client.send("GetSceneItemList", {"sceneName": scene}, raw=True)["sceneItems"]
            if not any(x["sourceName"] == SOURCE for x in items):
                client.send("CreateSceneItem", {"sceneName": scene, "sourceName": SOURCE, "sceneItemEnabled": True}, raw=True)
        self.message = "Viewer overlay added to " + scene + ". It is silent and only uses a small area."

    def sync_availability(self):
        """Pause only our rewards if the bridge/overlay is unavailable."""
        while not self.stop.is_set():
            paused = not (self.connected and self.config["enabled"] and self.clock() - self.last_obs < 4)
            if self.tokens and self.config["rewards"] and self.paused_remote != paused:
                try:
                    for rid in list(self.config["rewards"].values()):
                        self.api("PATCH", "channel_points/custom_rewards", params={
                            "broadcaster_id": os.environ["TWITCH_BROADCASTER_ID"], "id": rid}, json={"is_paused": paused})
                    self.paused_remote = paused
                except RuntimeError:
                    pass
            self.stop.wait(5)

    def listen(self):
        import websocket
        while not self.stop.is_set():
            if not self.tokens:
                self.stop.wait(2)
                continue
            sock = None
            try:
                # Validate each new session, refresh as needed, and periodically reconnect.
                token = self.token()
                valid = requests.get("https://id.twitch.tv/oauth2/validate", headers={"Authorization": "OAuth " + token}, timeout=15)
                if not valid.ok:
                    self.tokens["expires_at"] = 0
                    self.token()
                sock = websocket.create_connection("wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30", timeout=35)
                self.socket = sock
                welcome = json.loads(sock.recv())
                session = welcome["payload"]["session"]
                self.api("POST", "eventsub/subscriptions", json={"type": EVENT, "version": "1",
                    "condition": {"broadcaster_user_id": os.environ["TWITCH_BROADCASTER_ID"]},
                    "transport": {"method": "websocket", "session_id": session["id"]}})
                self.connected = True
                self.message = "Connected to Twitch redemption events."
                started = self.clock()
                while not self.stop.is_set() and self.clock() - started < 3300:
                    message = json.loads(sock.recv())
                    kind = message.get("metadata", {}).get("message_type")
                    if kind == "notification" and message["metadata"].get("subscription_type") == EVENT:
                        self.receive(message["payload"]["event"])
                    elif kind == "session_reconnect":
                        url = message["payload"]["session"]["reconnect_url"]
                        parsed = urlparse(url)
                        if parsed.scheme != "wss" or parsed.hostname != "eventsub.wss.twitch.tv":
                            raise RuntimeError("Unexpected Twitch reconnect address.")
                        replacement = websocket.create_connection(url, timeout=35)
                        json.loads(replacement.recv())["payload"]["session"]
                        sock.close()
                        sock = replacement
                        self.socket = sock
                    elif kind == "revocation":
                        raise RuntimeError("Twitch revoked the connection. Reconnect Twitch.")
            except Exception as exc:
                self.message = str(exc) if isinstance(exc, RuntimeError) else "Twitch disconnected; reconnecting. Unplayed requests remain refundable."
            finally:
                self.connected = False
                if sock:
                    sock.close()
                self.socket = None
            self.stop.wait(5)


def start_viewer_rewards(stop):
    bridge = RewardBridge(stop)

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
            return self.headers.get("Host") in {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}

        def overlay_auth(self):
            return secrets.compare_digest(parse_qs(urlparse(self.path).query).get("key", [""])[0], bridge.overlay_key)

        def do_GET(self):
            if not self.valid_host():
                return self.send({"error": "Invalid host"}, 403)
            path = urlparse(self.path).path
            if path == "/api/status":
                return self.send(bridge.status())
            if path == "/api/next":
                return self.send(bridge.next_effect() if self.overlay_auth() else {"error": "Forbidden"}, 200 if self.overlay_auth() else 403)
            if path in {"/", "/overlay"}:
                if path == "/overlay" and not self.overlay_auth():
                    return self.send({"error": "Forbidden"}, 403)
                data = PAGE.read_text(encoding="utf-8").replace("__CSRF__", bridge.csrf if path == "/" else "")
                return self.send(data.encode(), content_type="text/html; charset=utf-8")
            if path.startswith("/assets/"):
                name = path.removeprefix("/assets/")
                if name in {v["image"] for v in EFFECTS.values()} and (ASSETS / name).is_file():
                    return self.send((ASSETS / name).read_bytes(), content_type=mimetypes.guess_type(name)[0])
            self.send({"error": "Not found"}, 404)

        def do_POST(self):
            if not self.valid_host():
                return self.send({"error": "Invalid host"}, 403)
            path = urlparse(self.path).path
            authorized = self.overlay_auth() if path == "/api/ack" else secrets.compare_digest(self.headers.get("X-Hub-CSRF", ""), bridge.csrf)
            if not authorized:
                return self.send({"error": "Forbidden"}, 403)
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
                elif path == "/api/ack":
                    bridge.acknowledge(body.get("id"))
                else:
                    return self.send({"error": "Not found"}, 404)
                self.send({"ok": True})
            except (RuntimeError, ValueError, KeyError) as exc:
                self.send({"error": str(exc)}, 400)
            except Exception:
                self.send({"error": "Could not complete action. Check that OBS is running and connected."}, 503)

    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        print(f"[viewer-rewards] Port {PORT} is occupied; bridge not started.")
        return None
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True, name="viewer-rewards-ui").start()
    threading.Thread(target=bridge.listen, daemon=True, name="viewer-rewards-twitch").start()
    threading.Thread(target=bridge.sync_availability, daemon=True, name="viewer-rewards-availability").start()

    def shutdown():
        stop.wait()
        if bridge.socket:
            bridge.socket.close()
        server.shutdown()
        server.server_close()

    threading.Thread(target=shutdown, daemon=True, name="viewer-rewards-shutdown").start()
    print(f"[viewer-rewards] Test lab: http://127.0.0.1:{PORT}")
    return bridge

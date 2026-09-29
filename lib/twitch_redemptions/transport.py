"""OAuth and EventSub connectivity for channel-point redemptions."""
from __future__ import annotations

import json
import os
import threading
import time
from urllib.parse import urlparse
import requests
from .catalog import EVENT, SCOPE


class TwitchTransport:
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
        if (info.get('client_id') != os.environ.get('TWITCH_CLIENT_ID') or
                info.get("user_id") != os.environ.get("TWITCH_BROADCASTER_ID") or SCOPE not in info.get("scopes", [])):
            raise RuntimeError("Connect the channel owner's Twitch account with Channel Points permission.")
        self.tokens = dict(access_token=data["access_token"], refresh_token=data["refresh_token"],
                           expires_at=time.time() + int(data["expires_in"]))
        self._write("credentials.json", self.tokens)


    def api(self, method, path, **kwargs):
        with self.api_lock:
            r = requests.request(method, "https://api.twitch.tv/helix/" + path,
                                 headers={"Client-Id": os.environ["TWITCH_CLIENT_ID"],
                                          "Authorization": "Bearer " + self.token()}, timeout=15, **kwargs)
            if r.status_code == 401:
                self.tokens['expires_at'] = 0
                r = requests.request(method, 'https://api.twitch.tv/helix/' + path,
                    headers={'Client-Id': os.environ['TWITCH_CLIENT_ID'],
                             'Authorization': 'Bearer ' + self.token()}, timeout=15, **kwargs)
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


    def listen(self):
        import websocket
        while not self.stop.is_set():
            if not self.tokens:
                self.stop.wait(2)
                continue
            sock = None
            try:
                # Twitch requires token validation at startup and hourly thereafter.
                self.validate_connection()
                sock = websocket.create_connection("wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30", timeout=35)
                self.socket = sock
                welcome = json.loads(sock.recv())
                if welcome.get('metadata', {}).get('message_type') != 'session_welcome':
                    raise RuntimeError('Twitch did not welcome the redemption connection.')
                session = welcome["payload"]["session"]
                self.api("POST", "eventsub/subscriptions", json={"type": EVENT, "version": "1",
                    "condition": {"broadcaster_user_id": os.environ["TWITCH_BROADCASTER_ID"]},
                    "transport": {"method": "websocket", "session_id": session["id"]}})
                self.connected = True
                self.message = "Connected to Twitch redemption events."
                started = self.clock()
                while not self.stop.is_set():
                    message = json.loads(sock.recv())
                    if self.clock() - started >= 3500:
                        self.validate_connection()
                        started = self.clock()
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

    def validate_connection(self):
        token = self.token()
        valid = requests.get('https://id.twitch.tv/oauth2/validate',
                             headers={'Authorization': 'OAuth ' + token}, timeout=15)
        if not valid.ok:
            self.tokens['expires_at'] = 0
            self.token()
            return
        info = valid.json()
        if (info.get('client_id') != os.environ.get('TWITCH_CLIENT_ID') or
                info.get('user_id') != os.environ.get('TWITCH_BROADCASTER_ID') or SCOPE not in info.get('scopes', [])):
            raise RuntimeError('Reconnect the channel owner with Channel Points permission.')

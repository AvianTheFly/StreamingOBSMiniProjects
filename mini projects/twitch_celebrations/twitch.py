"""Twitch device authorization and EventSub transport; no rendering or OBS code.

Credentials are isolated from Channel Points and kept outside the checkout.
"""
import json
import os
from pathlib import Path
import threading
import time
from urllib.parse import urlparse
import requests

SCOPES = 'moderator:read:followers channel:read:subscriptions bits:read'
AUTH_SCOPES = SCOPES + ' clips:edit'
EVENTS = [('channel.raid','1','raid'), ('channel.follow','2','follow'),
          ('channel.subscribe','1','subscribe'), ('channel.subscription.gift','1','gift'),
          ('channel.cheer','1','cheer')]


class Twitch:
    def __init__(self, stop, receive):
        self.stop, self.receive = stop, receive
        self.path = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'StreamingHub' / 'twitch-celebrations' / 'credentials.json'
        try:
            self.tokens = json.loads(self.path.read_text())
        except (OSError, ValueError):
            self.tokens = {}
        self.lock = threading.RLock()
        self.auth = None
        self.busy = False
        self.connected = False
        self.message = 'Connect Twitch to receive raids, follows, subscriptions, gifts and cheers.'
        self.socket = None

    def save_tokens(self, data):
        valid = requests.get('https://id.twitch.tv/oauth2/validate', headers={'Authorization':'OAuth '+data['access_token']}, timeout=15)
        valid.raise_for_status()
        info = valid.json()
        if info.get('user_id') != os.environ.get('TWITCH_BROADCASTER_ID') or not set(SCOPES.split()) <= set(info.get('scopes', [])):
            raise ValueError('Authorize the channel owner with all requested celebration permissions.')
        self.tokens = dict(access_token=data['access_token'], refresh_token=data['refresh_token'], expires_at=time.time()+data['expires_in'])
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.tokens))
        tmp.replace(self.path)

    def token(self):
        with self.lock:
            if self.tokens.get('expires_at',0) < time.time()+120:
                r = requests.post('https://id.twitch.tv/oauth2/token', data={
                    'client_id':os.environ['TWITCH_CLIENT_ID'], 'client_secret':os.environ.get('TWITCH_CLIENT_SECRET',''),
                    'grant_type':'refresh_token', 'refresh_token':self.tokens['refresh_token']}, timeout=15)
                r.raise_for_status()
                self.save_tokens(r.json())
            return self.tokens['access_token']

    def connect(self):
        with self.lock:
            if self.busy:
                return self.auth
            if not os.environ.get('TWITCH_CLIENT_ID') or not os.environ.get('TWITCH_BROADCASTER_ID'):
                raise ValueError('Set TWITCH_CLIENT_ID and TWITCH_BROADCASTER_ID in the Hub .env first.')
            r = requests.post('https://id.twitch.tv/oauth2/device', data={'client_id':os.environ['TWITCH_CLIENT_ID'], 'scopes':AUTH_SCOPES}, timeout=15)
            r.raise_for_status()
            data = r.json()
            self.auth = dict(url=data['verification_uri'], code=data['user_code'])
            self.busy = True
            threading.Thread(target=self.poll_auth, args=(data,), daemon=True).start()
            return self.auth

    def poll_auth(self, data):
        deadline = time.monotonic()+data['expires_in']
        interval = max(5,data.get('interval',5))
        try:
            while time.monotonic() < deadline and not self.stop.wait(interval):
                r = requests.post('https://id.twitch.tv/oauth2/token', data={
                    'client_id':os.environ['TWITCH_CLIENT_ID'], 'client_secret':os.environ.get('TWITCH_CLIENT_SECRET',''),
                    'device_code':data['device_code'], 'scopes':AUTH_SCOPES,
                    'grant_type':'urn:ietf:params:oauth:grant-type:device_code'}, timeout=15)
                if r.ok:
                    with self.lock:
                        self.save_tokens(r.json())
                    self.message = 'Authorized. Connecting to Twitch…'
                    return
                error = str(r.json())
                if 'slow_down' in error:
                    interval += 5
                elif 'authorization_pending' not in error:
                    break
            self.message = 'Authorization expired or declined. Connect Twitch to retry.'
        except Exception:
            self.message = 'Authorization failed. Check the channel account and try again.'
        finally:
            self.busy = False
            self.auth = None

    def listen(self):
        import websocket
        while not self.stop.is_set():
            if not self.tokens:
                self.stop.wait(2)
                continue
            sock = None
            try:
                token = self.token()
                valid = requests.get('https://id.twitch.tv/oauth2/validate', headers={'Authorization':'OAuth '+token}, timeout=15)
                if valid.status_code == 401:
                    with self.lock:
                        self.tokens['expires_at'] = 0
                    token = self.token()
                else:
                    valid.raise_for_status()
                sock = websocket.create_connection('wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30', timeout=35)
                self.socket = sock
                session = json.loads(sock.recv())['payload']['session']['id']
                channel = os.environ['TWITCH_BROADCASTER_ID']
                unavailable = []
                for event, version, label in EVENTS:
                    condition = {'to_broadcaster_user_id':channel} if event == 'channel.raid' else {'broadcaster_user_id':channel}
                    if event == 'channel.follow':
                        condition['moderator_user_id'] = channel
                    r = requests.post('https://api.twitch.tv/helix/eventsub/subscriptions', headers={
                        'Client-Id':os.environ['TWITCH_CLIENT_ID'], 'Authorization':'Bearer '+token}, json={
                        'type':event, 'version':version, 'condition':condition,
                        'transport':{'method':'websocket', 'session_id':session}}, timeout=15)
                    if not r.ok:
                        unavailable.append(label)
                if len(unavailable) == len(EVENTS):
                    raise ValueError('No subscriptions could be created')
                self.connected = True
                self.message = ('Connected. Unavailable events: '+', '.join(unavailable)+'. Check Twitch permissions/channel eligibility.'
                                if unavailable else 'Listening for raids, follows, subs, gifts and cheers.')
                started = time.monotonic()
                while not self.stop.is_set() and time.monotonic()-started < 3300:
                    msg = json.loads(sock.recv())
                    kind = msg.get('metadata',{}).get('message_type')
                    if kind == 'notification':
                        self.notification(msg)
                    elif kind == 'revocation':
                        raise ValueError('Subscription revoked')
                    elif kind == 'session_reconnect':
                        url = msg['payload']['session']['reconnect_url']
                        parsed = urlparse(url)
                        if parsed.scheme != 'wss' or parsed.hostname != 'eventsub.wss.twitch.tv':
                            raise ValueError('Invalid reconnect URL')
                        replacement = websocket.create_connection(url, timeout=35)
                        json.loads(replacement.recv())['payload']['session']
                        sock.close()
                        sock = replacement
                        self.socket = sock
            except Exception:
                self.message = 'Twitch disconnected. Retrying; reconnect authorization if this persists.'
            finally:
                self.connected = False
                if sock:
                    sock.close()
                self.socket = None
            self.stop.wait(5)

    def notification(self, msg):
        metadata, event = msg['metadata'], msg['payload']['event']
        kind = next((k for t,v,k in EVENTS if t == metadata.get('subscription_type')), None)
        if not kind or event.get('to_broadcaster_user_id' if kind == 'raid' else 'broadcaster_user_id') != os.environ.get('TWITCH_BROADCASTER_ID'):
            return
        if kind == 'subscribe' and event.get('is_gift'):
            return  # The aggregate gift event already celebrates this batch.
        name = event.get('from_broadcaster_user_name') if kind == 'raid' else event.get('user_name')
        self.receive(kind, name or 'Anonymous legend', event.get('viewers',event.get('total',event.get('bits',1))), metadata['message_id'])

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
AUTH_SCOPES = SCOPES + ' clips:edit user:write:chat'
EVENTS = [('channel.raid','1','raid'), ('channel.follow','2','follow'),
          ('channel.subscribe','1','subscribe'), ('channel.subscription.gift','1','gift'),
          ('channel.cheer','1','cheer'), ('channel.subscription.message','1','resub')]


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
        self.subscriptions = {}
        self.last_event = None
        self.last_validated = 0
        self.chat_identity = None

    def validate_token(self, token):
        with self.lock:
            self.chat_identity = None
        response = requests.get('https://id.twitch.tv/oauth2/validate',
                                headers={'Authorization':'OAuth '+token}, timeout=15)
        response.raise_for_status()
        info = response.json()
        if info.get('user_id') != os.environ.get('TWITCH_BROADCASTER_ID') or info.get('client_id') != os.environ.get('TWITCH_CLIENT_ID'):
            raise ValueError('Saved Twitch authorization belongs to another account or application. Connect Twitch again.')
        self.last_validated = time.monotonic()
        with self.lock:
            self.chat_identity = dict(info, token=token)
        return info

    def chat_status(self, channel):
        with self.lock:
            info = self.chat_identity or {}
            ready = bool(self.tokens and info.get('token') == self.tokens.get('access_token') and
                         time.monotonic()-self.last_validated < 3300 and
                         info.get('login','').lower() == channel and 'user:write:chat' in info.get('scopes',[]))
            message = ('Ready · replies from @'+channel if ready else
                       'Connect Twitch to enable replies' if not self.tokens else
                       'Checking Twitch authorization' if not info else
                       'Chat channel must match the connected broadcaster' if info.get('login','').lower()!=channel else
                       'Reconnect Twitch in Twitch Celebrations to allow chat replies')
            return dict(ready=ready,message=message)

    def chat_authorization(self, channel):
        if not self.chat_status(channel)['ready']:
            raise ValueError('Twitch chat authorization is unavailable')
        token = self.token()
        with self.lock:
            if not self.chat_status(channel)['ready'] or self.stop.is_set():
                raise ValueError('Twitch chat authorization changed')
            identity = self.chat_identity
            return dict(token=token,client_id=identity['client_id'],
                        broadcaster_id=identity['user_id'],sender_id=identity['user_id'])

    def save_tokens(self, data):
        info = self.validate_token(data['access_token'])
        if info.get('user_id') != os.environ.get('TWITCH_BROADCASTER_ID') or not set(SCOPES.split()) <= set(info.get('scopes', [])):
            raise ValueError('Authorize the channel owner with all requested celebration permissions.')
        self.tokens = dict(access_token=data['access_token'], refresh_token=data.get('refresh_token', self.tokens.get('refresh_token')), expires_at=time.time()+data['expires_in'])
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

    def subscribe(self, session, token):
        channel = os.environ['TWITCH_BROADCASTER_ID']
        states = {}
        for event, version, label in EVENTS:
            condition = {'to_broadcaster_user_id':channel} if event == 'channel.raid' else {'broadcaster_user_id':channel}
            if event == 'channel.follow':
                condition['moderator_user_id'] = channel
            r = requests.post('https://api.twitch.tv/helix/eventsub/subscriptions', headers={
                'Client-Id':os.environ['TWITCH_CLIENT_ID'], 'Authorization':'Bearer '+token}, json={
                'type':event, 'version':version, 'condition':condition,
                'transport':{'method':'websocket', 'session_id':session}}, timeout=10)
            states[label] = {'enabled':r.status_code == 202, 'status':r.status_code}
        self.subscriptions = states
        if not any(state['enabled'] for state in states.values()):
            raise ValueError('Twitch refused every event subscription. Connect Twitch again to authorize this channel.')
        unavailable = [label for label, state in states.items() if not state['enabled']]
        self.message = ('Connected. Unavailable events: '+', '.join(unavailable)+'. Check Twitch permissions/channel eligibility.'
                        if unavailable else 'Listening for raids, follows, subs, gifts and cheers.')

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
                try:
                    self.validate_token(token)
                except requests.HTTPError as exc:
                    if exc.response is None or exc.response.status_code != 401:
                        raise
                    with self.lock:
                        self.tokens['expires_at'] = 0
                    token = self.token()
                sock = websocket.create_connection('wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30', timeout=35)
                self.socket = sock
                welcome = json.loads(sock.recv())
                if welcome.get('metadata',{}).get('message_type') != 'session_welcome':
                    raise ValueError('Unexpected Twitch handshake')
                session = welcome['payload']['session']['id']
                self.subscribe(session, token)
                self.connected = True
                while not self.stop.is_set():
                    # Twitch requires validation at startup and at least hourly.
                    # Keep healthy sockets open so refresh does not drop raids.
                    if time.monotonic()-self.last_validated > 3300:
                        token = self.token()
                        self.validate_token(token)
                    msg = json.loads(sock.recv())
                    kind = msg.get('metadata',{}).get('message_type')
                    if kind == 'notification':
                        self.notification(msg)
                    elif kind == 'revocation':
                        label = next((label for typ,ver,label in EVENTS if typ == msg['payload']['subscription']['type']), None)
                        if label:
                            self.subscriptions[label] = {'enabled':False, 'status':msg['payload']['subscription']['status']}
                            self.message = f'{label.title()} subscription revoked. Connect Twitch to restore permissions.'
                        if not any(x['enabled'] for x in self.subscriptions.values()):
                            raise ValueError('All event subscriptions were revoked')
                    elif kind == 'session_reconnect':
                        url = msg['payload']['session']['reconnect_url']
                        parsed = urlparse(url)
                        if parsed.scheme != 'wss' or parsed.hostname != 'eventsub.wss.twitch.tv':
                            raise ValueError('Invalid reconnect URL')
                        replacement = websocket.create_connection(url, timeout=35)
                        handoff = json.loads(replacement.recv())
                        if handoff.get('metadata',{}).get('message_type') != 'session_welcome':
                            replacement.close()
                            raise ValueError('Unexpected Twitch reconnect handshake')
                        sock.close()
                        sock = replacement
                        self.socket = sock
            except ValueError as exc:
                self.message = str(exc)
            except requests.HTTPError as exc:
                status = exc.response.status_code if exc.response is not None else 'unknown'
                self.message = f'Twitch authorization/API returned {status}. Retrying; Connect Twitch if this persists.'
            except Exception:
                self.message = 'Twitch disconnected. Retrying automatically; check network if this persists.'
            finally:
                self.connected = False
                self.subscriptions = {}
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
        if kind == 'gift' and event.get('is_anonymous'):
            name = 'Anonymous legend'
        details = {'tier':event.get('tier')}
        if kind == 'resub':
            details.update(months=event.get('cumulative_months'), streak=event.get('streak_months'),
                           message=(event.get('message') or {}).get('text'), renewal=True)
            kind = 'subscribe'
        self.last_event = dict(kind=kind, name=name or 'Anonymous legend', received_at=time.time())
        args = (kind, name or 'Anonymous legend', event.get('viewers',event.get('total',event.get('bits',1))), metadata['message_id'])
        if kind in ('subscribe','gift'):
            self.receive(*args, details=details)
        else:
            self.receive(*args)

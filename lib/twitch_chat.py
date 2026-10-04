"""Hub chat lifecycle: anonymous read-only IRC plus optional authorized Helix replies."""
import random
import re
import threading
import time
import websocket
import events
from lib.chat_overlay.settings import read

_reader = None
_sender = None


def start(stop):
    global _reader, _sender
    from .twitch_chat_replies import ReplySender
    _reader = ChatReader(stop)
    _sender = ReplySender(stop, _reader.channel_provider).start()
    _reader.replies = _sender
    _reader.start()
    return _reader


def status():
    state = _reader.snapshot() if _reader else dict(channel='',connected=False,status='Chat reader is not running')
    state['delivery'] = _sender.snapshot() if _sender else dict(ready=False,message='Chat replies are not running')
    return state


def reply(channel, text, parent, *, allowed):
    return bool(_sender and _sender.enqueue(channel,text,parent,allowed=allowed))


def parse_message(line, channel):
    match = re.fullmatch(r'@([^ ]+) :([A-Za-z0-9_]+)![^ ]+ PRIVMSG #([A-Za-z0-9_]+) :(.*)',line)
    if not match or match[3].lower()!=channel:
        return None
    tags = dict(tag.split('=',1) if '=' in tag else (tag,'') for tag in match[1].split(';'))
    # A shared-chat guest's moderator badge belongs to their source channel.
    if tags.get('source-room-id') and tags.get('source-room-id') != tags.get('room-id'):
        return None
    if not tags.get('user-id') or not tags.get('id'):
        return None
    return dict(user=match[2].lower(), channel=channel, text=match[4], id=tags['id'],
                user_id=tags['user-id'], moderator=tags.get('mod')=='1',
                sent_at=tags.get('tmi-sent-ts',''))


class ChatReader:
    def __init__(self, stop, channel_provider=None):
        self.stop = stop
        self.channel_provider = channel_provider or (lambda:read()['channel'])
        self.lock = threading.RLock()
        self.socket = None
        self.channel = ''
        self.status = 'Waiting for a Twitch channel'
        self.connected = False
        self.thread = None

    def snapshot(self):
        with self.lock:
            return dict(channel=self.channel,connected=self.connected,status=self.status)

    def run(self):
        while not self.stop.is_set():
            sock = None
            try:
                channel = self.channel_provider().lower().lstrip('#')
                if not re.fullmatch(r'[a-z0-9_]{1,25}',channel):
                    self.stop.wait(5)
                    continue
                with self.lock:
                    self.channel = channel
                    self.status = 'Connecting to Twitch chat'
                sock = websocket.create_connection('wss://irc-ws.chat.twitch.tv:443',timeout=2)
                with self.lock:
                    self.socket = sock
                sock.send('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n')
                sock.send('NICK justinfan'+str(random.randint(10000,99999))+'\r\n')
                sock.send('JOIN #'+channel+'\r\n')
                sock.settimeout(1)
                buffer = ''
                last_check = last_received = time.monotonic()
                while not self.stop.is_set():
                    if time.monotonic()-last_check>5:
                        last_check = time.monotonic()
                        if self.channel_provider().lower().lstrip('#')!=channel:
                            break
                    try:
                        raw = sock.recv()
                    except websocket.WebSocketTimeoutException:
                        if time.monotonic()-last_received>90:
                            raise OSError('Twitch chat keepalive timed out')
                        continue
                    if not isinstance(raw,str) or not raw:
                        break
                    last_received = time.monotonic()
                    buffer += raw
                    if len(buffer)>65536:
                        raise ValueError('Oversized Twitch message')
                    while '\r\n' in buffer:
                        line,buffer = buffer.split('\r\n',1)
                        if line.startswith('PING '):
                            sock.send('PONG '+line[5:]+'\r\n')
                        elif ' RECONNECT' in line or 'Login authentication failed' in line:
                            raise OSError('Twitch requested reconnect')
                        elif ' ROOMSTATE #'+channel in line:
                            with self.lock:
                                self.connected = True
                                self.status = 'Listening to #'+channel+' (read only)'
                        else:
                            message = parse_message(line,channel)
                            if message:
                                try:
                                    fresh = abs(time.time()-int(message['sent_at'])/1000)<=30
                                except (ValueError,TypeError):
                                    fresh = False
                                if fresh:
                                    events.emit('twitch.chat.message',**message)
            except Exception:
                with self.lock:
                    self.status = 'Twitch chat unavailable; retrying'
            finally:
                with self.lock:
                    self.connected = False
                    self.socket = None
                if sock is not None:
                    sock.close()
            self.stop.wait(5)

    def start(self):
        self.thread = threading.Thread(target=self.run,name='twitch-chat-reader',daemon=True)
        self.thread.start()
        return self

    def join(self):
        with self.lock:
            sock = self.socket
        if sock:
            sock.close()
        if self.thread:
            self.thread.join(3)
        if getattr(self,'replies',None):
            self.replies.join()

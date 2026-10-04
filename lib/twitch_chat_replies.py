"""One Hub-owned bounded Helix delivery worker; no feature policy or token storage."""
import queue
import re
import threading
import time
import unicodedata
import requests
from .twitch_chat_session import chat_sessions


def clean(text):
    text = ''.join(c if not unicodedata.category(c).startswith('C') else ' ' for c in str(text))
    return ' '.join(text.split())[:400]


class ReplySender:
    def __init__(self, stop, channel_provider, *, sessions=chat_sessions, post=requests.post, clock=time.monotonic):
        self.stop, self.channel_provider = stop, channel_provider
        self.sessions, self.post, self.clock = sessions, post, clock
        self.inbox = queue.Queue(maxsize=32)
        self.lock = threading.Lock()
        self.last = None
        self.next_send = 0
        self.thread = None

    def snapshot(self):
        session = self.sessions.get()
        state = session.status(self.channel_provider()) if session and not session.stop.is_set() else dict(ready=False, message='Connect Twitch in Twitch Celebrations to enable replies')
        with self.lock:
            return {**state, 'last': self.last.copy() if self.last else None}

    def enqueue(self, channel, text, parent, *, allowed):
        session = self.sessions.get()
        channel = str(channel).lower().lstrip('#')
        if self.stop.is_set() or not session or session.stop.is_set() or not allowed():
            return False
        if not re.fullmatch(r'[a-z0-9_]{1,25}',channel) or channel != self.channel_provider():
            return False
        if not isinstance(parent,str) or not re.fullmatch(r'[A-Za-z0-9-]{1,100}',parent):
            return False
        text = clean(text)
        if not text or not session.status(channel).get('ready'):
            return False
        try:
            self.inbox.put_nowait((session, channel, text, parent, allowed, self.clock()+15))
            return True
        except queue.Full:
            return False

    def _valid(self, item):
        session, channel, _, _, allowed, deadline = item
        return (not self.stop.is_set() and not session.stop.is_set() and
                self.sessions.get() is session and self.clock() < deadline and
                channel == self.channel_provider() and allowed())

    def deliver(self, item):
        if not self._valid(item):
            return
        session, channel, text, parent, _, _ = item
        try:
            auth = session.authorize(channel)
            # Refresh can block; recheck lifecycle/channel/permission before any write.
            if not self._valid(item):
                return
            response = self.post('https://api.twitch.tv/helix/chat/messages',
                headers={'Authorization':'Bearer '+auth['token'], 'Client-Id':auth['client_id']},
                json={'broadcaster_id':auth['broadcaster_id'], 'sender_id':auth['sender_id'],
                      'message':text, 'reply_parent_message_id':parent}, timeout=3)
            if response.status_code == 429:
                self.next_send = max(self.next_send, self.clock()+30)
                result = dict(sent=False, message='Twitch rate limit; this reply was skipped')
            else:
                response.raise_for_status()
                data = response.json().get('data',[])
                sent = bool(data and data[0].get('is_sent') is True)
                result = dict(sent=sent, message='Reply sent' if sent else 'Twitch declined this reply')
        except Exception:
            # Never retry an uncertain write or expose HTTP exceptions containing credentials.
            result = dict(sent=False, message='Reply unavailable; check Twitch connection')
        with self.lock:
            self.last = {**result, 'at':time.time()}

    def run(self):
        while not self.stop.is_set():
            try:
                item = self.inbox.get(timeout=.5)
            except queue.Empty:
                continue
            if self.stop.wait(max(0,self.next_send-self.clock())):
                break
            self.deliver(item)
            self.next_send = max(self.next_send,self.clock()+2)

    def start(self):
        self.thread = threading.Thread(target=self.run,name='twitch-chat-replies',daemon=True)
        self.thread.start()
        return self

    def join(self):
        if self.thread:
            self.thread.join(3)

"""Runtime chat authorization contract; credentials stay with their existing owner."""
from dataclasses import dataclass
import threading


@dataclass(frozen=True)
class ChatSession:
    authorize: object
    status: object
    stop: object


class ChatSessions:
    def __init__(self):
        self.lock = threading.Lock()
        self.owner = self.session = None

    def register(self, owner, *, authorize, status, stop):
        with self.lock:
            self.owner, self.session = owner, ChatSession(authorize, status, stop)

    def unregister(self, owner):
        with self.lock:
            if self.owner is owner:
                self.owner = self.session = None

    def get(self):
        with self.lock:
            return self.session


chat_sessions = ChatSessions()

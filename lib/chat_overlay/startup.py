"""One finite launch attempt after the Hub's own HTTP server becomes ready."""
import threading
import time

from . import settings
from .desktop import activate


class ChatStartup:
    def __init__(self):
        self.lock = threading.Lock()
        self.thread = None

    def start(self, stop, ready, *, port):
        with self.lock:
            if self.thread and self.thread.is_alive():
                return
            self.thread = threading.Thread(target=self._run, args=(stop, ready, port),
                                           name='chat-overlay-startup', daemon=True)
            self.thread.start()

    def _run(self, stop, ready, port):
        try:
            if not settings.read()['auto_start']:
                return
            deadline = time.monotonic() + 20
            while not stop.is_set():
                if ready.wait(.1):
                    if not stop.is_set():
                        print('[chat-overlay] ' + activate(port)['message'])
                    return
                if time.monotonic() >= deadline:
                    print('[chat-overlay] Hub page was not ready; automatic launch skipped.')
                    return
        except Exception as exc:
            # A missing host or changed personal host configuration cannot stop Hub startup.
            print(f'[chat-overlay] Automatic launch skipped: {exc}')

    def join(self):
        with self.lock:
            thread = self.thread
        if thread:
            thread.join(timeout=2)


startup = ChatStartup()

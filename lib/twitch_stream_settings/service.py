"""One startup check in the user's normal Chrome session via a local extension."""
import os
from pathlib import Path
import secrets
import subprocess
import threading
import time

from .policy import channel_name


class StreamSettingsService:
    def __init__(self):
        self.lock = threading.RLock()
        self.stop = None
        self.thread = None
        self.port = 7420
        self.nonce = None
        self.done = threading.Event()
        self.state = dict(state='idle', message='Twitch startup check has not run.', busy=False)

    def snapshot(self):
        with self.lock:
            return dict(self.state)

    def start(self, stop, *, port=7420):
        with self.lock:
            self.stop, self.port = stop, port
        self.retry()

    def retry(self, *, login=False):
        with self.lock:
            if self.stop is None or self.stop.is_set() or self.state['busy']:
                return False
            self.nonce = secrets.token_urlsafe(24)
            self.done = threading.Event()
            self.state = dict(state='checking', message='Checking VOD and rewind settings in your signed-in Chrome session…', busy=True)
            self.thread = threading.Thread(target=self._run, args=(self.nonce, self.done),
                                           daemon=True, name='twitch-stream-settings')
            self.thread.start()
            return True

    def report(self, data):
        with self.lock:
            nonce = data.get('nonce')
            if (not isinstance(nonce, str) or not self.nonce or
                    not secrets.compare_digest(nonce, self.nonce) or not self.state['busy'] or self.stop.is_set()):
                return False
            state = data.get('state')
            messages = {
                'ready': 'Store past broadcasts, Always Publish VODs and Stream Rewind are enabled.',
                'error': 'Twitch settings could not be verified. Check the dashboard and retry.',
                'login_required': 'Sign in to Twitch in your normal Chrome window, then retry.',
            }
            if state not in messages:
                return False
            self.state.update(state=state, message=messages[state], busy=False)
            self.done.set()
            return True

    def _run(self, nonce, done):
        try:
            channel = channel_name(os.environ.get('TWITCH_CHANNEL', ''))
            candidates = [Path(os.environ.get(variable, '')) / 'Google/Chrome/Application/chrome.exe'
                          for variable in ('ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA')]
            executable = next((path for path in candidates if path.is_file()), None)
            if executable is None:
                raise RuntimeError('Google Chrome is required.')
            url = (f'https://dashboard.twitch.tv/u/{channel}/settings/stream'
                   f'#streaming-hub={nonce}&hub-port={self.port}')
            # Normal Chrome, normal profile, existing login. No debugger or login copying.
            subprocess.Popen([str(executable), url], stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
            deadline = time.monotonic() + 75
            while not self.stop.is_set() and time.monotonic() < deadline:
                if done.wait(.25):
                    return
            with self.lock:
                if self.nonce == nonce and self.state['busy']:
                    self.state.update(state='extension_required', busy=False,
                        message='Install the Streaming Hub Twitch extension in your Chrome profile, then click Check again.')
        except Exception:
            with self.lock:
                self.state.update(state='error', busy=False,
                    message='Could not open Twitch settings in Chrome. Check TWITCH_CHANNEL and your Chrome installation.')

    def join(self):
        if self.thread is not None:
            self.thread.join(timeout=2)


service = StreamSettingsService()
